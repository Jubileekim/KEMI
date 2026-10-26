// Supabase Storage(비공개 버킷) 어댑터. 서버는 service role 키로 서명 URL 발급과 파일 확인만 한다.
// 파일 바이트는 서버를 거치지 않는다(브라우저 → Storage 직접 업로드).
// [검증 필요] 실제 Supabase 프로젝트(KEMI-dev) 버킷으로는 아직 호출해 보지 않았다.

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
}

export class StorageUnavailableError extends Error {
  constructor() {
    super("storage request failed");
    this.name = "StorageUnavailableError";
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

  async function call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchFn(url, {
        ...init,
        headers: { ...headers, ...init.headers },
        signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
      });
    } catch {
      console.warn("[files] storage request failed");
      throw new StorageUnavailableError();
    }
  }

  async function json(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new StorageUnavailableError();
    }
  }

  const field = (value: unknown, key: string): unknown =>
    typeof value === "object" && value !== null
      ? Reflect.get(value, key)
      : undefined;

  return {
    async createUploadUrl(path) {
      const response = await call(
        `${base}/object/upload/sign/${objectPath(path)}`,
        { method: "POST" },
      );
      if (!response.ok) throw new StorageUnavailableError();
      const body = await json(response);
      const url = field(body, "url");
      if (typeof url !== "string") throw new StorageUnavailableError();
      const token = new URL(url, "http://local").searchParams.get("token");
      if (!token) throw new StorageUnavailableError();
      return { url: `${base}${url}`, token };
    },

    async stat(path) {
      const response = await call(
        `${base}/object/info/authenticated/${objectPath(path)}`,
        { method: "GET" },
      );
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) throw new StorageUnavailableError();
      const body = await json(response);
      const size =
        field(body, "size") ?? field(field(body, "metadata"), "size");
      return typeof size === "number" ? { sizeBytes: size } : null;
    },

    async readHead(path, bytes) {
      const response = await call(
        `${base}/object/authenticated/${objectPath(path)}`,
        { method: "GET", headers: { Range: `bytes=0-${bytes - 1}` } },
      );
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) throw new StorageUnavailableError();
      return new Uint8Array(await response.arrayBuffer()).slice(0, bytes);
    },

    async createDownloadUrl(path, expiresInSeconds) {
      const response = await call(`${base}/object/sign/${objectPath(path)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      });
      if (!response.ok) throw new StorageUnavailableError();
      const signed = field(await json(response), "signedURL");
      if (typeof signed !== "string") throw new StorageUnavailableError();
      return `${base}${signed}`;
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
