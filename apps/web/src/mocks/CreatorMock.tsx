import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import Button from "../components/ui/button";
import { session, useSession } from "../app/session";
import loadCatalog from "./catalog-api";
import { packageFields, packageSchema } from "./studio-model";
import PortfolioCard from "../features/portfolio/PortfolioCard";

export default function CreatorMock() {
  const { creatorId = "" } = useParams();
  const { role } = useSession();
  const query = useQuery({
    queryKey: ["mock-catalog-creator", session.epoch(), creatorId],
    queryFn: ({ signal }) =>
      loadCatalog(new URLSearchParams({ creatorId }).toString(), signal),
  });
  const creator = query.data?.creator;
  return (
    <section className="grid min-w-0 gap-6">
      <p className="rounded-xl bg-muted p-4">
        개발용 Mock · 공개 프로필의 검토 예시예요. 실제 API·거래 실적은
        미연결이에요.
      </p>
      <Link to="/works">작품에서 찾아보기</Link>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        제작자 최신 공개 상태 확인
      </Button>
      {query.isFetching && <p role="status">제작자를 불러오고 있어요.</p>}
      {query.error && (
        <p role="alert">
          공개 제작자를 확인하지 못했어요. 비공개·중단 또는 조회 오류일 수
          있어요. 다시 확인해 주세요.
        </p>
      )}
      {creator && !query.error && (
        <>
          <header className="showcase-card grid gap-4">
            <p className="type-label-md text-primary">CREATOR</p>
            <h1 className="type-heading-lg">{creator.name}</h1>
            <p>작품으로 먼저 만나고, 원하는 범위는 함께 협의해요.</p>
            <p>후기·거래 실적 없이 공개한 샘플도 볼 수 있어요.</p>
          </header>
          <h2 className="type-heading-md">공개 패키지</h2>
          <p>
            표시 가격은 협의 출발점이에요. 선택만으로 결제·계약이 확정되지
            않아요.
          </p>
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            {creator.packages.map((p) => (
              <article
                key={p.id}
                className="showcase-card grid min-w-0 gap-4"
                aria-label={`패키지 ${p.title}`}
              >
                <h3 className="type-heading-md">
                  {p.title}
                  {p.id === creator.primaryId && " · 대표"}
                </h3>
                <p>{p.description}</p>
                <p>
                  협의 시작 가격 {Number(p.price).toLocaleString("ko-KR")}원 ·{" "}
                  {p.days}일 · 수정 {p.revisions}회
                </p>
                <details>
                  <summary>규격·포함 범위·사용권 전체 보기</summary>
                  <dl className="grid gap-3 break-words">
                    {Object.entries(packageFields).map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd className="whitespace-pre-wrap">
                          {String(p[packageSchema.keyof().parse(key)])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
                {role === "guest" || role === "client" ? (
                  <Button asChild>
                    <Link
                      to={`/creators/${encodeURIComponent(creator.id)}/request?packageId=${encodeURIComponent(p.id)}`}
                    >
                      {role === "guest"
                        ? "로그인하고 이 패키지로 의뢰"
                        : "이 패키지로 직접 의뢰"}
                    </Link>
                  </Button>
                ) : (
                  <p>직접 의뢰 발송은 의뢰인 계정으로 이용해요.</p>
                )}
              </article>
            ))}
          </div>
          <h2 className="type-heading-md">공개 작품</h2>
          <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {creator.works.map((work) => (
              <PortfolioCard key={work.id} work={work} />
            ))}
          </div>
          {!creator.works.length && (
            <p>
              공개한 작품이 없어요. 공개 서비스와 패키지에서 의뢰를 시작할 수
              있어요.
            </p>
          )}
        </>
      )}
    </section>
  );
}
