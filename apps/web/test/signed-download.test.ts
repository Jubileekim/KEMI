import { describe, expect, it, vi } from "vitest";
import openSignedDownload from "../src/shared/files/signed-download";

describe("서명 다운로드 새 창", () => {
  it("주소 조회를 기다리기 전에 새 창을 열고 opener를 분리한다", async () => {
    let release: (url: string) => void = () => {};
    const resolveUrl = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const popup = {
      opener: { secret: "parent" },
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    const notify = vi.fn();

    const task = openSignedDownload(resolveUrl, () => popup, notify);
    expect(popup.opener).toBeNull();
    expect(popup.location.replace).not.toHaveBeenCalled();

    release("https://storage.example.test/file");
    await task;
    expect(popup.location.replace).toHaveBeenCalledWith(
      "https://storage.example.test/file",
    );
    expect(popup.close).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("팝업이 차단되면 다운로드 URL을 조회하지 않고 안내한다", async () => {
    const resolveUrl = vi.fn(async () => "https://storage.example.test");
    const notify = vi.fn();
    await openSignedDownload(resolveUrl, () => null, notify);
    expect(resolveUrl).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("팝업 차단"));
  });

  it("서명 주소 조회 실패 시 빈 창을 닫고 안내한다", async () => {
    const popup = {
      opener: null,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    const notify = vi.fn();
    await openSignedDownload(
      async () => {
        throw new Error("network error");
      },
      () => popup,
      notify,
    );
    expect(popup.close).toHaveBeenCalledOnce();
    expect(popup.location.replace).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("파일 주소"));
  });
});
