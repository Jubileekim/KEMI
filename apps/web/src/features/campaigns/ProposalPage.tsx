import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";

const ProposalMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/ProposalMock"))
  : null;
export default function ProposalPage() {
  if (mockEnabled && ProposalMock)
    return (
      <Suspense fallback={<p role="status">의뢰 화면 준비 중…</p>}>
        <ProposalMock />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">제안·협의 연결 준비 중</h1>
      <p>
        협의와 선정 분리·철회·채팅 API 계약 조율 후 연결해요. 실제 제안·대화는
        아직 저장되지 않아요.
      </p>
    </section>
  );
}
