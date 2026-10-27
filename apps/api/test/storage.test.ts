import { describe, expect, it } from "vitest";
import {
  createSupabaseStorage,
  readPrefix,
  StorageUnavailableError,
} from "../src/files/storage.js";

// 실제 저장소 대신 fetch만 바꿔 Supabase Storage 응답 형태를 흉내 낸다.
function storageWith(handler: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const storage = createSupabaseStorage({
    supabaseUrl: "https://example.supabase.co/",
    serviceRoleKey: "service-role-test",
    bucket: "kemi-files",
    fetchFn: async (input, init = {}) => {
      const url = String(input);
      calls.push({ url, init });
      return handler(url, init);
    },
  });
  return { storage, calls };
}

// 1MB 덩어리를 끝없이 보내는 본문. 몇 번 읽혔는지 센다.
function endlessBody() {
  const counter = { pulled: 0, canceled: false };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      counter.pulled += 1;
      controller.enqueue(new Uint8Array(1024 * 1024).fill(counter.pulled));
    },
    cancel() {
      counter.canceled = true;
    },
  });
  return { body, counter };
}

describe("Supabase Storage 어댑터", () => {
  it("Range를 무시하고 큰 파일을 보내도 앞부분만 읽고 스트림을 닫는다", async () => {
    const { body, counter } = endlessBody();
    const { storage, calls } = storageWith(
      () => new Response(body, { status: 200 }),
    );
    const head = await storage.readHead("u/1/a.mp4", 64);
    expect(head?.length).toBe(64);
    expect(counter.pulled).toBeLessThanOrEqual(2);
    expect(counter.canceled).toBe(true);
    expect(calls[0]?.init.headers).toMatchObject({ Range: "bytes=0-63" });
  });

  it("짧은 파일은 있는 만큼만 돌려준다", async () => {
    const short = new Response(new Uint8Array([1, 2, 3]));
    expect([...(await readPrefix(short, 64))]).toEqual([1, 2, 3]);
  });

  it("없는 파일은 null, 권한·서버 오류는 StorageUnavailableError", async () => {
    const statuses = [404, 403, 500];
    const results = await Promise.all(
      statuses.map(async (status) => {
        const { storage } = storageWith(() => new Response("{}", { status }));
        return storage.readHead("u/1/a.mp4", 16).then(
          (value) => value,
          (err: unknown) => err,
        );
      }),
    );
    expect(results[0]).toBeNull();
    expect(results[1]).toBeInstanceOf(StorageUnavailableError);
    expect(results[2]).toBeInstanceOf(StorageUnavailableError);

    const { storage } = storageWith(() => new Response("{}", { status: 403 }));
    await expect(storage.createDownloadUrl("u/1/a.mp4", 300)).rejects.toThrow(
      StorageUnavailableError,
    );
    await expect(storage.createUploadUrl("u/1/a.mp4")).rejects.toThrow(
      StorageUnavailableError,
    );
  });

  it("서명 URL은 Storage 주소 아래 경로로 만들고 만료 시간을 보낸다", async () => {
    const { storage, calls } = storageWith((url) =>
      url.includes("/upload/sign/")
        ? Response.json({
            url: "/object/upload/sign/kemi-files/u/1/a%20b.mp4?token=abc",
          })
        : Response.json({
            signedURL: "/object/sign/kemi-files/u/1/a%20b.mp4?token=xyz",
          }),
    );
    const upload = await storage.createUploadUrl("u/1/a b.mp4");
    expect(upload).toEqual({
      url: "https://example.supabase.co/storage/v1/object/upload/sign/kemi-files/u/1/a%20b.mp4?token=abc",
      token: "abc",
    });
    const download = await storage.createDownloadUrl("u/1/a b.mp4", 300);
    expect(download).toBe(
      "https://example.supabase.co/storage/v1/object/sign/kemi-files/u/1/a%20b.mp4?token=xyz",
    );
    expect(calls.map((call) => call.url)).toEqual([
      "https://example.supabase.co/storage/v1/object/upload/sign/kemi-files/u/1/a%20b.mp4",
      "https://example.supabase.co/storage/v1/object/sign/kemi-files/u/1/a%20b.mp4",
    ]);
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ expiresIn: 300 });
  });
});
