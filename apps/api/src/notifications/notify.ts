import type { NotificationType } from "@kemi/shared";
import type { Prisma } from "../generated/prisma/client.js";

export interface NotificationInput {
  recipientUserId: bigint;
  type: NotificationType;
  // 같은 수신자에게 같은 사건 키로는 한 번만 저장한다(재시도·중복 호출 방지).
  eventKey: string;
  title: string;
  // 개인정보(이메일·연락처)는 넣지 않는다.
  body: string;
  projectId?: bigint;
  workRequestId?: bigint;
}

// 알림은 원인이 된 상태 변경과 같은 트랜잭션에서 만든다. 상태 변경이 되돌려지면 알림도 남지 않는다.
export default async function notify(
  tx: Prisma.TransactionClient,
  items: NotificationInput[],
): Promise<void> {
  if (items.length === 0) return;
  await tx.notification.createMany({
    data: items.map((item) => ({
      recipientUserId: item.recipientUserId,
      eventType: item.type,
      eventKey: item.eventKey,
      title: item.title,
      body: item.body,
      projectId: item.projectId ?? null,
      workRequestId: item.workRequestId ?? null,
    })),
    skipDuplicates: true,
  });
}
