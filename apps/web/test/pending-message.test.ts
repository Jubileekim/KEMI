import { describe, expect, it, vi } from "vitest";
import sendPendingMessage from "../src/features/requests/pending-message";

describe("채팅 메시지 전송 재시도", () => {
  it("파일 업로드 성공 뒤 메시지 실패 시 같은 파일 ID와 명령 ID를 재사용한다", async () => {
    const file = new File(["contents"], "sample.txt", {
      type: "text/plain",
    });
    const command = { id: "cmd-1", body: "  안녕하세요  ", file };
    const upload = vi.fn(async () => "file-1");
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ id: "message-1" });

    await expect(
      sendPendingMessage(command, upload, send),
    ).rejects.toThrow("network");
    await expect(sendPendingMessage(command, upload, send)).resolves.toEqual({
      id: "message-1",
    });
    expect(upload).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, {
      clientMessageId: "cmd-1",
      body: "안녕하세요",
      attachmentFileIds: ["file-1"],
    });
    expect(send).toHaveBeenNthCalledWith(2, {
      clientMessageId: "cmd-1",
      body: "안녕하세요",
      attachmentFileIds: ["file-1"],
    });
  });

  it("파일 업로드가 실패하면 메시지를 보내지 않고 재시도 때만 다시 업로드한다", async () => {
    const command = {
      id: "cmd-2",
      body: "",
      file: new File(["contents"], "sample.txt"),
    };
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error("upload"))
      .mockResolvedValueOnce("file-2");
    const send = vi.fn(async () => ({ id: "message-2" }));
    await expect(
      sendPendingMessage(command, upload, send),
    ).rejects.toThrow("upload");
    expect(send).not.toHaveBeenCalled();
    await sendPendingMessage(command, upload, send);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({
      clientMessageId: "cmd-2",
      body: "",
      attachmentFileIds: ["file-2"],
    });
  });

  it("첨부 없는 메시지는 업로드 없이 한 번만 전송한다", async () => {
    const upload = vi.fn(async () => "unused");
    const send = vi.fn(async () => ({ id: "message-3" }));
    await sendPendingMessage(
      { id: "cmd-3", body: "메시지", file: null },
      upload,
      send,
    );
    expect(upload).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({
      clientMessageId: "cmd-3",
      body: "메시지",
      attachmentFileIds: [],
    });
  });
});
