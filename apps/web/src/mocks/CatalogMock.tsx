import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { recordMockEvent } from "../shared/analytics/events";
import Button from "../components/ui/button";
import PortfolioCard from "../features/portfolio/PortfolioCard";
import loadCatalog from "./catalog-api";
import sampleVideo from "./assets/catalog-sample.webm?url";
import ScreenLinks from "../app/ScreenLinks";
import { session } from "../app/session";
import { catalogRoleLabels } from "./catalog-model";

export default function CatalogMock() {
  const { workId } = useParams();
  const [params, setParams] = useSearchParams();
  const [failed, setFailed] = useState(false);
  const search = workId
    ? new URLSearchParams({
        workId,
        ...(params.get("creatorId")
          ? { creatorId: params.get("creatorId") ?? "" }
          : {}),
      }).toString()
    : params.toString();
  const query = useQuery({
    queryKey: ["mock-catalog", session.epoch(), search],
    queryFn: ({ signal }) => loadCatalog(search, signal),
  });
  const { data } = query;
  useEffect(() => {
    if (data && !workId) recordMockEvent("feed_view", "feed");
  }, [data, workId]);
  const filter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  return (
    <section className="grid min-w-0 gap-6">
      <p className="rounded-xl bg-muted p-4">
        개발용 Mock · 합성 샘플과 이 탭에서 공개한 작업물이에요. 실제 API·영상
        저장소는 미연결이에요. 분류·페이지 크기·노출 순서 D21은 검토 예시예요.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link to="/">작품 피드</Link>
        <Link to="/campaigns">공개 모집 둘러보기</Link>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            setFailed(false);
            query.refetch();
          }}
        >
          최신 공개 상태 확인
        </Button>
      </div>
      {query.isFetching && <p role="status">공개 작품을 불러오고 있어요.</p>}
      {query.error && (
        <p role="alert">
          공개 작품을 확인하지 못했어요. 비공개·삭제·서비스 중단 또는 조회
          실패일 수 있어요. 최신 공개 상태를 다시 확인해 주세요.
        </p>
      )}
      {data &&
        !query.error &&
        (workId && data.work ? (
          <article className="showcase-card grid min-w-0 gap-4">
            <h1 className="type-heading-lg">{data.work.title}</h1>
            {data.work.playable && !failed ? (
              <video
                key={workId}
                className="aspect-video w-full rounded-xl bg-foreground"
                controls
                preload="metadata"
                aria-label="공개 샘플 영상"
                src={sampleVideo}
                onError={() => setFailed(true)}
                onPlaying={() => {
                  if (workId) recordMockEvent("work_play", workId);
                }}
              >
                <track kind="captions" />
                동영상 재생을 지원하는 브라우저가 필요해요.
              </video>
            ) : (
              <p role="status">
                영상 재생을 확인하지 못했어요. 실제 저장소는 미연결이며 외부
                URL은 D02 결정 대기예요. 최신 상태 확인 후 재시도할 수 있어요.
              </p>
            )}
            <p>{data.work.description}</p>
            <p>
              {data.work.origin === "SAMPLE"
                ? "자작 샘플 · 거래 실적 아님"
                : "공개 동의 고객 작업"}
            </p>
            <p>
              담당 역할:{" "}
              {data.work.roles
                .map((r) => catalogRoleLabels[r] ?? r)
                .join(" · ")}
            </p>
            <p>
              {data.work.style} · {data.work.workType}
            </p>
            <p>출처: {data.work.source}</p>
            <Button asChild>
              <Link to={`/creators/${encodeURIComponent(data.work.creatorId)}`}>
                제작자·공개 패키지 보기
              </Link>
            </Button>
          </article>
        ) : (
          <>
            <div className="showcase-card grid gap-4">
              <p className="type-label-md text-primary">WORKS TOGETHER</p>
              <h1 className="type-heading-lg">작품에서 시작하는 새로운 연결</h1>
              <p>
                마음에 드는 영상의 제작자를 만나보세요. 샘플에서도 의뢰를 시작할
                수 있어요.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                ["style", "스타일", data.styles],
                ["type", "작업 유형", data.types],
              ].map(
                ([key, label, options]) =>
                  typeof key === "string" &&
                  typeof label === "string" &&
                  Array.isArray(options) && (
                    <label
                      key={key}
                      htmlFor={`feed-${key}`}
                      className="grid gap-2"
                    >
                      {label}
                      <select
                        id={`feed-${key}`}
                        aria-label={label}
                        className="rounded-xl border p-3"
                        value={params.get(key) ?? ""}
                        onChange={(e) => filter(key, e.target.value)}
                      >
                        <option value="">전체</option>
                        {params.get(key) &&
                          !options.includes(params.get(key) ?? "") && (
                            <option>{params.get(key)}</option>
                          )}
                        {options.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  ),
              )}
            </div>
            <p role="status">
              공개 작품 {data.total}개 · {data.page}/{data.pages}페이지
            </p>
            {!data.works.length && (
              <p>조건에 맞는 공개 작품이 없어요. 필터를 바꿔보세요.</p>
            )}
            <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.works.map((work) => (
                <PortfolioCard
                  key={`${work.creatorId}-${work.id}`}
                  work={work}
                />
              ))}
            </div>
            <nav aria-label="작품 페이지" className="flex gap-4">
              <Button
                variant="outline"
                disabled={data.page <= 1}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(data.page - 1));
                  setParams(next);
                }}
              >
                이전 페이지
              </Button>
              <Button
                variant="outline"
                disabled={data.page >= data.pages}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(data.page + 1));
                  setParams(next);
                }}
              >
                다음 페이지
              </Button>
            </nav>
            <ScreenLinks />
          </>
        ))}
    </section>
  );
}
