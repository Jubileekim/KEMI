import type { ReadableStreamReadResult } from "node:stream/web";

// Supabase Storage(비공개 버킷) 어댑터. 서버는 service role 키로 서명 URL 발급과 파일 확인만 한다.
// 파일 바이트는 서버를 거치지 않는다(브라우저 → Storage 직접 업로드).
// 요청·응답 형태는 단위 테스트(test/storage.test.ts)로 확인한다. 실제 버킷 호출은 배포 전 점검(runbook)에서 확인한다.

export const STORAGE_TIMEOUT_MS = 10_000;

export interface StoredObjectInfo {
  sizeBytes: number;
}

export interface FileStorage {
  createUploadUrl(path: string): Promise<{ url: string; token: string }>;
  // 없으면 null
  stat(path: string): Promise<StoredObjectInfo | null>;
  // 형식 판정용으로 앞부분만 읽는다. 없으면 null
  readHead(path: string, bytes: number): Promise<Uint8Array | null>;
  createDownloadUrl(path: string, expiresInSeconds: number): Promise<string>;
  // 운영 점검용: 키로 버킷을 읽을 수 있는지 본다. 실패해도 예외 없이 결과만 돌려준다.
  checkBucket(): Promise<StorageCheck>;
}

// ok: 버킷 접근 가능, missing_bucket: 버킷 이름이 없음, unauthorized: 키 거부, error: 연결·기타 오류
export type StorageCheck = "ok" | "missing_bucket" | "unauthorized" | "error";

// network: 연결 실패·시간 초과, http: 저장소가 오류 상태로 응답, response: 응답 형식이 예상과 다름
export type StorageFailure = "network" | "http" | "response";

export class StorageUnavailableError extends Error {
  constructor(
    readonly reason: StorageFailure = "response",
    readonly storageStatus?: number,
  ) {
    super(`storage request failed (${reason})`);
    this.name = "StorageUnavailableError";
  }
}

// 응답 본문을 앞에서부터 bytes만큼만 읽고 스트림을 닫는다.
export async function readPrefix(
  response: Response,
  bytes: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const out = new Uint8Array(bytes);
  const pull = async (filled: number): Promise<number> => {
    if (filled >= bytes) return filled;
    const chunk: ReadableStreamReadResult<Uint8Array> = await reader.read();
    if (chunk.done) return filled;
    const { value } = chunk;
    const take = value.subarray(0, bytes - filled);
    out.set(take, filled);
    return pull(filled + take.length);
  };
  try {
    const filled = await pull(0);
    return out.slice(0, filled);
  } catch {
    throw new StorageUnavailableError("network");
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export function createSupabaseStorage({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  fetchFn = fetch,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  fetchFn?: typeof fetch;
}): FileStorage {
  const base = `${supabaseUrl.replace(/\/$/, "")}/storage/v1`;
  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };
  const objectPath = (path: string) =>
    `${encodeURIComponent(bucket)}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

  const field = (value: unknown, key: string): unknown =>
    typeof value === "object" && value !== null
      ? Reflect.get(value, key)
      : undefined;

  // op는 로그에 남길 작업 이름. 키·서명 주소는 로그에 남기지 않는다.
  async function call(
    op: string,
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    try {
      return await fetchFn(url, {
        ...init,
        headers: { ...headers, ...init.headers },
        signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
      });
    } catch {
      console.warn(`[files] storage ${op} failed: network or timeout`);
      throw new StorageUnavailableError("network");
    }
  }

  // 저장소가 거절한 이유(예: Bucket not found, invalid signature)를 로그에 남기고 실패로 바꾼다.
  async function rejected(op: string, response: Response): Promise<never> {
    const body: unknown = await response.json().catch(() => undefined);
    const hint = [field(body, "error"), field(body, "message")]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .replace(/https?:\/\/\S+/g, "<url>")
      .slice(0, 160);
    console.warn(
      `[files] storage ${op} rejected: http ${response.status}${hint ? ` ${hint}` : ""}`,
    );
    throw new StorageUnavailableError("http", response.status);
  }

  async function json(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new StorageUnavailableError("response");
    }
  }

  return {
    async createUploadUrl(path) {
      const response = await call(
        "upload-sign",
        `${base}/object/upload/sign/${objectPath(path)}`,
        { method: "POST" },
      );
      if (!response.ok) return rejected("upload-sign", response);
      const body = await json(response);
      const url = field(body, "url");
      if (typeof url !== "string")
        throw new StorageUnavailableError("response");
      const token = new URL(url, "http://local").searchParams.get("token");
      if (!token) throw new StorageUnavailableError("response");
      return { url: `${base}${url}`, token };
    },

    async stat(path) {
      const response = await call(
        "stat",
        `${base}/object/info/authenticated/${objectPath(path)}`,
        { method: "GET" },
      );
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) return rejected("stat", response);
      const body = await json(response);
      const size =
        field(body, "size") ?? field(field(body, "metadata"), "size");
      return typeof size === "number" ? { sizeBytes: size } : null;
    },

    async readHead(path, bytes) {
      const response = await call(
        "read-head",
        `${base}/object/authenticated/${objectPath(path)}`,
        { method: "GET", headers: { Range: `bytes=0-${bytes - 1}` } },
      );
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) return rejected("read-head", response);
      // 저장소가 Range를 무시하고 전체 파일(최대 수백 MB)을 보내도 앞부분만 읽고 나머지는 받지 않는다.
      return readPrefix(response, bytes);
    },

    async createDownloadUrl(path, expiresInSeconds) {
      const response = await call(
        "download-sign",
        `${base}/object/sign/${objectPath(path)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: expiresInSeconds }),
        },
      );
      if (!response.ok) return rejected("download-sign", response);
      const signed = field(await json(response), "signedURL");
      if (typeof signed !== "string")
        throw new StorageUnavailableError("response");
      return `${base}${signed}`;
    },

    async checkBucket() {
      try {
        const response = await call(
          "check-bucket",
          `${base}/bucket/${encodeURIComponent(bucket)}`,
          { method: "GET" },
        );
        if (response.ok) return "ok";
        // Supabase Storage는 HTTP 400에 실제 이유를 본문 statusCode·error로 담기도 한다.
        const body: unknown = await response.json().catch(() => undefined);
        const code = String(field(body, "statusCode") ?? response.status);
        const text = [field(body, "error"), field(body, "message")]
          .filter((value): value is string => typeof value === "string")
          .join(" ")
          .toLowerCase();
        console.warn(
          `[files] storage check-bucket rejected: http ${response.status} ${code} ${text.slice(0, 160)}`,
        );
        if (
          code === "401" ||
          code === "403" ||
          /unauthori|signature|jwt|invalid.*key/.test(text)
        )
          return "unauthorized";
        if (code === "404" || text.includes("not found"))
          return "missing_bucket";
        return "error";
      } catch {
        return "error";
      }
    },
  };
}

// 확장자를 믿지 않고 파일 앞부분(매직 바이트)으로 실제 형식을 판정한다(결정 기록 4장).
export function detectMimeType(head: Uint8Array): string | null {
  const at = (offset: number, ...values: number[]) =>
    values.every((value, i) => head[offset + i] === value);
  const ascii = (offset: number, text: string) =>
    at(offset, ...[...text].map((c) => c.charCodeAt(0)));
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (
    at(0, 0x50, 0x4b) &&
    (at(2, 0x03, 0x04) || at(2, 0x05, 0x06) || at(2, 0x07, 0x08))
  ) {
    return "application/zip";
  }
  if (ascii(4, "ftyp")) {
    // QuickTime(MOV)은 브랜드가 "qt  "이다. 나머지 ISO 미디어는 MP4로 본다.
    return ascii(8, "qt  ") ? "video/quicktime" : "video/mp4";
  }
  return null;
}
