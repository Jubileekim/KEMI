import {
  termsFields,
  termsValuesSchema,
  type TermsVersion,
  type TermsSources,
} from "../../mocks/terms-model";
import { packageFields, packageSchema } from "../../mocks/studio-model";

export function TermsReferences({ sources }: { sources: TermsSources }) {
  return (
    <details className="rounded-xl border p-4">
      <summary>참조 원본 사본 · 최종 조건과 별도</summary>
      <dl className="grid gap-2 break-words">
        {sources.campaign ? (
          <>
            <dt>공고</dt>
            <dd>
              {sources.campaign.title} · {sources.campaign.product}
            </dd>
            <dt>공고 예산·범위</dt>
            <dd>
              {sources.campaign.budget}원 · {sources.campaign.scope}
            </dd>
          </>
        ) : (
          <>
            <dt>의뢰 경로</dt>
            <dd>직접 의뢰 · 연결된 공개 공고 없음</dd>
          </>
        )}
        <dt>의뢰 견적·기간·방향</dt>
        <dd>
          {sources.proposal.quote}원 · {sources.proposal.days}일 ·{" "}
          {sources.proposal.direction}
        </dd>
        <dt>
          {sources.campaign ? "대표 공개 패키지" : "발송 당시 선택 패키지 사본"}
        </dt>
        <dd>{sources.package?.title ?? "참조 가능한 공개 패키지 없음"}</dd>
        {sources.package &&
          Object.entries(packageFields).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd className="whitespace-pre-wrap">
                {sources.package?.[packageSchema.keyof().parse(key)]}
              </dd>
            </div>
          ))}
      </dl>
      <p>
        직접 의뢰는 발송 당시, 공개 제안은 첫 작성본 저장 시 사본을 고정해요.
        원본 변경은 최종 값과 저장 이력에 자동 반영되지 않아요.
      </p>
    </details>
  );
}
export default function TermsVersionView({
  version,
  previous,
}: {
  version: TermsVersion;
  previous?: TermsVersion;
}) {
  return (
    <section
      aria-label={`작성본 v${version.number}`}
      className="rounded-xl border p-4"
    >
      <h3 className="type-heading-md">작성본 v{version.number}</h3>
      <p>
        저장자 {version.authorId} ·{" "}
        <time dateTime={version.createdAt}>
          {new Date(version.createdAt).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}{" "}
          (한국 시간)
        </time>
      </p>
      <dl className="grid gap-3 break-words">
        {Object.entries(termsFields).map(([key, label]) => {
          const field = termsValuesSchema.keyof().parse(key);
          const changed =
            previous && previous.values[field] !== version.values[field];
          return (
            <div key={key}>
              <dt className="font-semibold">
                {label}
                {changed && " · 이전 작성본에서 변경"}
              </dt>
              <dd className="whitespace-pre-wrap">
                {version.values[field] || "미입력"}
              </dd>
              {changed && (
                <dd className="text-muted-foreground whitespace-pre-wrap">
                  이전 값: {previous.values[field] || "미입력"}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
