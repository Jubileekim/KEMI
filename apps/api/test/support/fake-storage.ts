import type { FileStorage } from "../../src/files/storage.js";

// 테스트용 메모리 저장소. put()으로 "브라우저 업로드"를 흉내 낸다.
export function createFakeStorage() {
  const objects = new Map<string, Uint8Array>();
  const storage: FileStorage = {
    createUploadUrl: async (path) => ({
      url: `https://storage.test/upload/${path}?token=t`,
      token: "t",
    }),
    stat: async (path) => {
      const bytes = objects.get(path);
      return bytes ? { sizeBytes: bytes.length } : null;
    },
    readHead: async (path, n) => objects.get(path)?.slice(0, n) ?? null,
    createDownloadUrl: async (path, seconds) =>
      `https://storage.test/download/${path}?expires=${seconds}`,
    checkBucket: async () => "ok",
  };
  return {
    storage,
    put: (path: string, bytes: Uint8Array) => objects.set(path, bytes),
  };
}

// 형식별 최소 매직 바이트로 시작하는 파일 내용
export function fileBytes(kind: "png" | "jpeg" | "mp4" | "zip", size = 64) {
  const heads: Record<typeof kind, number[]> = {
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    jpeg: [0xff, 0xd8, 0xff, 0xe0],
    mp4: [0, 0, 0, 0x18, ...[..."ftypisom"].map((c) => c.charCodeAt(0))],
    zip: [0x50, 0x4b, 0x03, 0x04],
  };
  const bytes = new Uint8Array(size);
  bytes.set(heads[kind]);
  return bytes;
}
