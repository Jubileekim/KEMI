import { ArrowRight, Play } from "lucide-react";
import { useSearchParams, Link } from "react-router";
import { VIDEO_PURPOSES } from "@kemi/shared";
import { useQuery } from "@tanstack/react-query";
import { kemi, query } from "../../shared/api/kemi";
import { purposeLabels, won } from "../live/labels";
import { Failure } from "../live/ui";
import { Thumbnail } from "../portfolio/CatalogLive";
import "./landing.css";

export default function LandingPage() {
  const [params, setParams] = useSearchParams();
  const purpose =
    VIDEO_PURPOSES.find((value) => value === params.get("purpose")) ?? "";
  const search = query({ purpose: purpose || undefined });
  const feed = useQuery({
    queryKey: ["feed", search],
    queryFn: ({ signal }) => kemi.feed(search, signal),
  });
  // Keep the hero stable while filtering the grid. With no filter this shares
  // the existing feed query/cache; media uses the same signed URLs as the feed.
  const featured = useQuery({
    queryKey: ["feed", ""],
    queryFn: ({ signal }) => kemi.feed("", signal),
  });
  const browse = (value: string) => {
    setParams(value ? { purpose: value } : {}, { preventScrollReset: true });
  };
  return (
    <div className="landing">
      <section
        className="landing-hero landing-container"
        aria-labelledby="landing-title"
      >
        <div className="landing-intro">
          <p className="landing-eyebrow">함께 만드는 KEMI</p>
          <h1 id="landing-title">
            당신의 이야기에,
            <br />
            <span>딱 맞는 크리에이터.</span>
          </h1>
          <p className="landing-description">
            마음에 드는 작품에서,
            <br className="landing-mobile-break" /> 함께할 영상 전문가를
            만나보세요.
          </p>
          <div className="landing-actions">
            <a className="landing-button" href="#landing-works">
              작품 둘러보기 <ArrowRight size={18} aria-hidden="true" />
            </a>
            <Link
              className="landing-button landing-button-outline"
              to="/campaigns"
            >
              공개 모집 살펴보기
            </Link>
          </div>
        </div>
        <div
          className="landing-collage"
          aria-label="공개 작품 미리보기"
          aria-busy={featured.isFetching}
        >
          {featured.isPending && (
            <p className="landing-hero-state" role="status">
              대표 작품을 불러오고 있어요.
            </p>
          )}
          {featured.isError && (
            <div className="landing-hero-state">
              <Failure error={featured.error} />
              <button
                className="landing-button landing-button-outline"
                type="button"
                disabled={featured.isFetching}
                onClick={() => featured.refetch()}
              >
                대표 작품 다시 불러오기
              </button>
            </div>
          )}
          {featured.isSuccess && featured.data.items.length === 0 && (
            <p className="landing-hero-state">
              함께할 크리에이터의 새로운 작품을 기다리고 있어요.
            </p>
          )}
          {featured.isSuccess &&
            featured.data.items.slice(0, 3).map((item, index) => (
              <Link
                key={item.portfolio.id}
                className={`landing-highlight landing-highlight-${index}`}
                to={`/works/${item.portfolio.id}`}
                aria-label={`${item.portfolio.title} 작품 보기`}
              >
                <Thumbnail portfolio={item.portfolio} autoplay />
                <span className="landing-play">
                  <Play size={17} fill="currentColor" aria-hidden="true" />
                </span>
                <span className="landing-highlight-label">
                  {item.portfolio.title}{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
            ))}
        </div>
      </section>

      <section
        className="landing-works landing-container"
        id="landing-works"
        aria-labelledby="landing-works-title"
      >
        <div
          className="landing-filters"
          role="group"
          aria-label="영상 목적 필터"
        >
          <p>어떤 영상을 찾고 있나요?</p>
          <div className="landing-chips">
            {["", ...VIDEO_PURPOSES].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={purpose === value}
                onClick={() => browse(value)}
              >
                {value ? purposeLabels[value] : "전체"}
              </button>
            ))}
          </div>
        </div>
        <div className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">함께 만드는 KEMI</p>
            <h2 id="landing-works-title">마음이 가는 작품을 발견해보세요.</h2>
          </div>
          <Link className="landing-text-link" to={`/${search}`}>
            전체 작품 보기 <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div aria-live="polite" aria-busy={feed.isFetching}>
          {feed.isPending && (
            <p className="landing-state" role="status">
              작품을 불러오고 있어요.
            </p>
          )}
          {feed.isError && (
            <div className="landing-state">
              <Failure error={feed.error} />
              <button
                className="landing-button landing-button-outline"
                type="button"
                onClick={() => {
                  feed.refetch();
                }}
                disabled={feed.isFetching}
              >
                작품 다시 불러오기
              </button>
            </div>
          )}
          {feed.isSuccess && feed.data.items.length === 0 && (
            <div className="landing-state">
              <p>
                {purpose
                  ? "이 카테고리에는 아직 공개된 작품이 없어요."
                  : "아직 공개된 작품이 없어요."}
              </p>
              {purpose && (
                <button
                  className="landing-button landing-button-outline"
                  type="button"
                  onClick={() => browse("")}
                >
                  전체 작품 보기
                </button>
              )}
              <Link className="landing-text-link" to="/campaigns">
                공개 모집 둘러보기 <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          )}
          {feed.isSuccess && feed.data.items.length > 0 && (
            <ul className="landing-grid">
              {feed.data.items.slice(0, 9).map((item) => (
                <li className="landing-work-card" key={item.portfolio.id}>
                  <Link
                    to={`/works/${item.portfolio.id}`}
                    className="landing-work-link"
                  >
                    <div className="landing-work-image">
                      <Thumbnail portfolio={item.portfolio} autoplay />
                    </div>
                    <h3>{item.portfolio.title}</h3>
                  </Link>
                  <Link
                    className="landing-creator"
                    to={`/creators/${item.creator.userId}`}
                  >
                    {item.creator.name}
                  </Link>
                  <p className="landing-work-meta">
                    {item.portfolio.purpose
                      ? purposeLabels[item.portfolio.purpose]
                      : ""}
                    {item.startingPriceKrw
                      ? `${item.portfolio.purpose ? " · " : ""}${won(item.startingPriceKrw)}부터`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {feed.isSuccess && feed.data.items.length > 0 && (
          <div className="landing-more">
            <Link
              className="landing-button landing-button-outline"
              to={`/${search}`}
            >
              작품 더 보기 <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section
        className="landing-container"
        aria-labelledby="landing-cta-title"
      >
        <div className="landing-cta">
          <div>
            <h2 id="landing-cta-title">좋은 영상의 시작, 좋은 만남부터.</h2>
            <p>지금, 공개 모집에서 함께할 크리에이터를 찾아보세요.</p>
          </div>
          <Link className="landing-button" to="/campaigns">
            공개 모집 살펴보기 <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
