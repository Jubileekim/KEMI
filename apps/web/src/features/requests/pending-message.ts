// Keep one attachment upload for every idempotent chat command. A message
// request may fail after the upload succeeded; retries must reuse both IDs.
export interface PendingMessage {
  id: string;
  body: string;
  file: File | null;
  attachmentId?: string;
}

interface SendBody {
  clientMessageId: string;
  body: string;
  attachmentFileIds: string[];
}

export default async function sendPendingMessage<T>(
  command: PendingMessage,
  save: (next: PendingMessage) => void,
  upload: (file: File) => Promise<string>,
  send: (body: SendBody) => Promise<T>,
): Promise<T> {
  const attachmentId =
    command.attachmentId ??
    (command.file ? await upload(command.file) : undefined);
  if (attachmentId && !command.attachmentId) {
    save({ ...command, attachmentId });
  }
  return send({
    clientMessageId: command.id,
    body: command.body.trim(),
    attachmentFileIds: attachmentId ? [attachmentId] : [],
  });
}
