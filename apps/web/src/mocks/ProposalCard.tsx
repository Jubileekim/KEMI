import { Link } from "react-router";
import type { AuthUser } from "@kemi/shared";
import {
  hasRoom,
  proposalLabels,
  type Proposal,
  type ProposalCommand,
} from "./proposal-model";
import Button from "../components/ui/button";
import ProposalConfirm from "./ProposalConfirm";
import RequestInbox from "../features/requests/RequestInbox";
import { packageFields, packageSchema } from "./studio-model";

export default function ProposalCard({
  item,
  user,
  busy,
  error,
  submit,
}: {
  item: Proposal & { unread: number; lastMessage: string };
  user: AuthUser;
  busy: boolean;
  error: string;
  submit: (command: ProposalCommand, done?: () => void) => void;
}) {
  const active =
    ["PENDING", "DISCUSSING"].includes(item.status) && !item.contracted;
  let statusLabel = proposalLabels[item.status];
  if (item.direct && item.status === "PENDING") statusLabel = "응답 대기";
  if (item.direct && item.status === "DECLINED") statusLabel = "제작자 거절";
  return (
    <article className="showcase-card grid gap-4 break-words">
      <Link to={`/reports/new?type=request&target=${item.id}`}>
        이 의뢰 상대방 신고
      </Link>
      <h2 className="type-heading-md">
        {item.title} ·{" "}
        {user.role === "CLIENT" ? item.creatorName : item.clientName}
      </h2>
      <p>
        {item.direct && "직접 의뢰 · "}
        {item.contracted ? "선정 완료" : statusLabel}
        {item.contracted ? " · 확정 계약" : " · 계약 미확정"}
      </p>
      <p className="whitespace-pre-wrap">{item.direction}</p>
      {item.direct && (
        <div className="grid gap-2">
          <p>발송 당시 패키지: {item.direct.snapshot.title}</p>
          <p className="whitespace-pre-wrap">
            희망 조건: {item.direct.conditions}
          </p>
          <p>
            최초 응답 기한:{" "}
            <time dateTime={item.direct.respondDueAt}>
              {new Date(item.direct.respondDueAt).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}{" "}
              (한국 시간)
            </time>{" "}
            · 48시간
          </p>
          <p>수락은 협의 시작이며 계약·결제는 별도예요.</p>
          <details>
            <summary>발송 당시 패키지 전체 조건</summary>
            <dl className="grid gap-2">
              {Object.entries(packageFields).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd className="whitespace-pre-wrap">
                    {item.direct?.snapshot[packageSchema.keyof().parse(key)]}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      )}
      {item.direct && (
        <RequestInbox key={`${item.id}-${item.revision}`} item={item} />
      )}
      <dl className="grid gap-2">
        <div>
          <dt>제안 견적</dt>
          <dd>{Number(item.quote).toLocaleString("ko-KR")}원</dd>
        </div>
        <div>
          <dt>작업 기간</dt>
          <dd>{item.days}일</dd>
        </div>
        <div>
          <dt>제출 당시 작업물 제목</dt>
          <dd>{item.works.map((work) => work.title).join(", ")}</dd>
        </div>
      </dl>
      {item.reason && <p>종료 사유: {item.reason}</p>}
      {hasRoom(item) && (
        <>
          <p>
            미확인 메시지 {item.unread}개 · 최근 대화:{" "}
            {item.lastMessage || "아직 없어요"}
          </p>
          <Button asChild>
            <Link to={`/workspace/${item.id}`}>대화·작업 공간 열기</Link>
          </Button>
        </>
      )}
      <Link to={`/requests/${item.id}`}>의뢰 상세</Link>
      {active && !item.direct && (
        <div className="flex flex-wrap gap-3">
          {user.role === "CLIENT" && item.status === "PENDING" && (
            <ProposalConfirm
              label="협의 요청"
              description="후보별 방을 생성·재사용해요. 협의는 선정이 아니며 다른 후보는 유지돼요."
              busy={busy}
              error={error}
              onConfirm={(_, done) =>
                submit(
                  {
                    type: "discuss",
                    id: item.id,
                    revision: item.revision,
                    reason: "",
                  },
                  done,
                )
              }
            />
          )}
          <ProposalConfirm
            label={user.role === "CLIENT" ? "제안 거절" : "제안 철회"}
            description="계약 전 제안을 종료하고 기존 협의방을 읽기 전용으로 바꿔요. 이력은 보존해요. 재지원은 D06 결정 대기예요."
            reasonRequired
            busy={busy}
            error={error}
            onConfirm={(reason, done) =>
              submit(
                {
                  type: user.role === "CLIENT" ? "decline" : "withdraw",
                  id: item.id,
                  revision: item.revision,
                  reason,
                },
                done,
              )
            }
          />
        </div>
      )}
    </article>
  );
}
