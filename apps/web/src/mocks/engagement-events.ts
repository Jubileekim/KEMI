import type { AuthUser } from "@kemi/shared";
import type { z } from "zod";
import { readMockProposals } from "./proposal-handlers";
import { participant } from "./proposal-model";
import { readMockSignatureRounds } from "./signature-handlers";
import { readMockPaidOrder } from "./payment-handlers";
import { readMockProduction } from "./production-handlers";
import { readMockDelivery } from "./delivery-handlers";
import { readMockSettlement } from "./settlement-handlers";
import { readMockSafety } from "./safety-store";
import type { noticeSchema } from "./engagement-model";

// Project successful domain facts into notices. No client-generated success state
// and no PII/body text is copied. Polling does not mutate a transaction.
export default function engagementEvents(user: AuthUser) {
  const events: z.infer<typeof noticeSchema>[] = [];
  const add = (id: string, label: string, path: string, at: string) =>
    events.push({ id, label, path, at, read: false });
  readMockProposals()
    .items.filter((p) => participant(p, user))
    .forEach((p) => {
      const room = `/requests/${p.id}`;
      if (
        (user.role === "CLIENT" && !p.direct) ||
        (user.role === "CREATOR" && p.direct)
      )
        add(`request:${p.id}`, "새 의뢰·제안 도착", room, p.createdAt);
      if (p.roomCreated)
        add(
          `room:${p.id}`,
          "협의 공간 생성",
          `/workspace/${p.id}`,
          p.createdAt,
        );
      readMockSignatureRounds(p.id).forEach((r) => {
        r.signatures.forEach((s) =>
          add(
            `sign:${r.versionId}:${s.userId}`,
            "조건 버전 서명 확인",
            `/workspace/${p.id}#signature-${r.versionId}`,
            s.at,
          ),
        );
        if (!r.contractId) return;
        const id = r.contractId;
        add(
          `contract:${id}`,
          "계약 확정",
          `/workspace/${p.id}`,
          r.signatures.at(-1)?.at ?? r.requestedAt,
        );
        const paid = readMockPaidOrder(id);
        if (paid)
          add(
            `paid:${paid.id}`,
            "테스트 결제 확인",
            `/contracts/${id}/production`,
            new Date().toISOString(),
          );
        readMockProduction(id).history.forEach((h) =>
          add(
            `production:${h.id}`,
            "제작 준비 상태 변경",
            `/contracts/${id}/production#production-${h.id}`,
            h.at,
          ),
        );
        const delivery = readMockDelivery(id);
        delivery.versions.forEach((v) =>
          add(
            `video:${v.id}`,
            "영상 제출 확인",
            `/contracts/${id}/deliveries?version=${v.id}`,
            v.at,
          ),
        );
        if (delivery.final.receipt)
          add(
            `receipt:${delivery.final.receipt.id}`,
            "최종 파일 수령 확인",
            `/contracts/${id}/review`,
            delivery.final.receipt.at,
          );
        const settled = readMockSettlement(id);
        if (settled?.status === "SUCCEEDED" && settled.confirmedAt)
          add(
            `settled:${settled.id}`,
            "모의 정산 완료",
            `/contracts/${id}/settlement?settlement=${settled.id}`,
            settled.confirmedAt,
          );
      });
    });
  readMockSafety().forEach((r) => {
    if (r.reporterId === user.id)
      add(
        `report:${r.id}`,
        "신고 접수 확인",
        "/reports/new",
        r.history[0]?.at ?? new Date().toISOString(),
      );
    if (r.reporterId === user.id || r.subjectId === user.id)
      r.history
        .filter((h) => h.action !== "RECEIVED")
        .forEach((h) =>
          add(
            `operation:${h.id}`,
            "신고·이용 안내 상태 변경",
            "/reports/new",
            h.at,
          ),
        );
  });
  return events;
}
