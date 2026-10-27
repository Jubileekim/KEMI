import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import {
  VIDEO_PURPOSES,
  type Portfolio,
  type ServicePackage,
} from "@kemi/shared";
import { useEffect } from "react";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import ScreenLinks from "../../app/ScreenLinks";
import { kemi, query } from "../../shared/api/kemi";
import {
  label,
  purposeLabels,
  roleLabels,
  styleLabels,
  won,
} from "../live/labels";
import { Card, Facts, Failure, Field, Loading } from "../live/ui";
import { selectClass } from "../live/errors";
import track from "../../shared/analytics/track";

// 공개 작업물 썸네일. 서명 주소는 만료되므로 화면에서 그때그때 받는다.
function Thumbnail({ portfolio }: { portfolio: Portfolio }) {
  const media = useQuery({
    queryKey: ["portfolio-media", portfolio.id],
    enabled: !!portfolio.thumbnailFileId,
    queryFn: ({ signal }) => kemi.portfolioMedia(portfolio.id, signal),
    staleTime: 5 * 60_000,
  });
  if (!media.data?.thumbnail)
    return <div className="aspect-video rounded-xl bg-muted" aria-hidden />;
  return (
    <img
      src={media.data.thumbnail.url}
      alt={`${portfolio.title} 대표 이미지`}
      className="aspect-video w-full rounded-xl object-cover"
      loading="lazy"
    />
  );
}

export function PackageCard({
  pkg,
  creatorId,
}: {
  pkg: ServicePackage;
  creatorId: string;
}) {
  const { role } = useSession();
  return (
    <li className="showcase-card grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="type-title">{pkg.title}</h3>
        {pkg.isRepresentative && <Badge>대표</Badge>}
      </div>
      {pkg.description && (
        <p className="whitespace-pre-wrap">{pkg.description}</p>
      )}
      <p className="text-muted-foreground">
        {pkg.priceKrw ? won(pkg.priceKrw) : "가격 미정"} ·{" "}
        {pkg.deliveryDays ?? "-"}일 · 수정 {pkg.revisionCount ?? 0}회
      </p>
      {pkg.includes.length > 0 && (
        <p className="text-sm">포함: {pkg.includes.join(", ")}</p>
      )}
      {role === "client" && (
        <Button asChild className="justify-self-start">
          <Link to={`/creators/${creatorId}/request?packageId=${pkg.id}`}>
            이 패키지로 직접 의뢰
          </Link>
        </Button>
      )}
    </li>
  );
}

// FEED-01: 공개 작업물 피드
function Feed() {
  const { role } = useSession();
  const [params, setParams] = useSearchParams();
  const search = query({
    purpose: params.get("purpose") ?? undefined,
    page: params.get("page") ?? undefined,
  });
  const feed = useQuery({
    queryKey: ["feed", search],
    queryFn: ({ signal }) => kemi.feed(search, signal),
  });
  const page = Number(params.get("page") ?? "1");
  useEffect(() => {
    if (feed.isSuccess) track("feed_view", "feed");
  }, [feed.isSuccess]);
  return (
    <>
      <h1 className="type-heading-lg">작품 피드</h1>
      <div className="showcase-card grid gap-4 sm:grid-cols-3">
        <Field id="feed-purpose" label="영상 목적">
          <select
            id="feed-purpose"
            className={selectClass}
            value={params.get("purpose") ?? ""}
            onChange={(event) => {
              const next = new URLSearchParams();
              if (event.target.value) next.set("purpose", event.target.value);
              setParams(next);
            }}
          >
            <option value="">전체</option>
            {VIDEO_PURPOSES.map((value) => (
              <option key={value} value={value}>
                {label(purposeLabels, value)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {feed.isPending && <Loading text="작품을 불러오고 있어요." />}
      {feed.error && <Failure error={feed.error} />}
      {feed.data?.items.length === 0 && (
        <Card>
          <h2 className="type-heading-md">
            {params.has("purpose") || page > 1
              ? "조건에 맞는 작품이 없어요."
              : "아직 공개된 작품이 없어요."}
          </h2>
          {params.has("purpose") || page > 1 ? (
            <Button variant="outline" onClick={() => setParams({})}>
              전체 작품 보기
            </Button>
          ) : (
            <p className="text-muted-foreground">
              {role === "creator"
                ? "작업물을 공개하고, 패키지 관리에서 공개된 대표 패키지를 지정한 뒤 제작 서비스를 공개하면 피드에 표시돼요."
                : "공개 모집을 둘러보거나 회원가입 후 의뢰와 작품 등록을 시작해 보세요."}
            </p>
          )}
          <ScreenLinks />
        </Card>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {feed.data?.items.map((item) => (
          <li key={item.portfolio.id} className="showcase-card grid gap-2">
            <Link to={`/works/${item.portfolio.id}`} className="grid gap-2">
              <Thumbnail portfolio={item.portfolio} />
              <span className="type-title">{item.portfolio.title}</span>
            </Link>
            <Link
              to={`/creators/${item.creator.userId}`}
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              {item.creator.name}
            </Link>
            <p className="text-sm">
              {item.portfolio.purpose
                ? label(purposeLabels, item.portfolio.purpose)
                : ""}
              {item.startingPriceKrw
                ? ` · ${won(item.startingPriceKrw)}부터`
                : ""}
            </p>
          </li>
        ))}
      </ul>
      {feed.data && feed.data.total > feed.data.pageSize && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() =>
              setParams({
                ...Object.fromEntries(params),
                page: String(page - 1),
              })
            }
          >
            이전
          </Button>
          <Button
            variant="outline"
            disabled={page * feed.data.pageSize >= feed.data.total}
            onClick={() =>
              setParams({
                ...Object.fromEntries(params),
                page: String(page + 1),
              })
            }
          >
            다음
          </Button>
        </div>
      )}
    </>
  );
}

// FEED-02·03: 작품 상세(영상 재생, 제작자·패키지 연결)
function WorkDetail({ id }: { id: string }) {
  const work = useQuery({
    queryKey: ["portfolio", id],
    queryFn: ({ signal }) => kemi.portfolio(id, signal),
  });
  const media = useQuery({
    queryKey: ["portfolio-media", id],
    enabled: !!work.data,
    queryFn: ({ signal }) => kemi.portfolioMedia(id, signal),
  });
  const pkg = useQuery({
    queryKey: ["package", work.data?.packageId],
    enabled: !!work.data?.packageId,
    queryFn: ({ signal }) =>
      kemi.servicePackage(work.data?.packageId ?? "", signal),
  });
  if (work.isPending) return <Loading text="작품을 불러오고 있어요." />;
  if (work.error) return <Failure error={work.error} />;
  const w = work.data;
  return (
    <>
      <h1 className="type-heading-lg">{w.title}</h1>
      <Card>
        {media.data?.video ? (
          <video
            controls
            onPlaying={() => track("work_play", w.id)}
            preload="metadata"
            className="aspect-video w-full rounded-xl bg-black"
            src={media.data.video.url}
            poster={media.data.thumbnail?.url}
          >
            <track kind="captions" />
          </video>
        ) : (
          <p className="text-muted-foreground">
            {media.isPending
              ? "영상을 준비하고 있어요."
              : "재생할 영상이 없어요."}
          </p>
        )}
        {w.description && (
          <p className="whitespace-pre-wrap">{w.description}</p>
        )}
        <Facts
          items={[
            ["목적", w.purpose ? label(purposeLabels, w.purpose) : "-"],
            [
              "스타일",
              w.styles.map((s) => label(styleLabels, s)).join(", ") || "-",
            ],
            [
              "본인 역할",
              w.roles.map((r) => label(roleLabels, r)).join(", ") || "-",
            ],
          ]}
        />
        <Button asChild variant="outline" className="justify-self-start">
          <Link to={`/creators/${w.creatorId}`}>제작자 페이지</Link>
        </Button>
      </Card>
      {pkg.data && (
        <ul className="grid gap-4">
          <PackageCard pkg={pkg.data} creatorId={w.creatorId} />
        </ul>
      )}
    </>
  );
}

// 공개 제작자 페이지(서비스가 공개된 크리에이터만)
export function CreatorDetailLive() {
  const { creatorId = "" } = useParams();
  const creator = useQuery({
    queryKey: ["creator", creatorId],
    queryFn: ({ signal }) => kemi.creator(creatorId, signal),
  });
  useEffect(() => {
    if (creator.isSuccess) track("creator_view", creatorId);
  }, [creator.isSuccess, creatorId]);
  if (creator.isPending)
    return <Loading text="제작자 정보를 불러오고 있어요." />;
  if (creator.error) return <Failure error={creator.error} />;
  const c = creator.data;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="type-heading-lg">{c.name}</h1>
        {c.isAvailable && <Badge variant="secondary">작업 가능</Badge>}
      </div>
      <Card>
        {c.introduction && (
          <p className="whitespace-pre-wrap">{c.introduction}</p>
        )}
        {c.image && (
          <img
            src={c.image.url}
            alt={`${c.name} 프로필`}
            className="h-24 w-24 rounded-xl object-cover"
          />
        )}
        {c.career && <p className="whitespace-pre-wrap">경력: {c.career}</p>}
        <div className="flex flex-wrap gap-4">
          {[
            { url: c.websiteUrl, title: "웹사이트" },
            { url: c.socialUrl, title: "SNS" },
          ]
            .filter((link) => link.url && /^https?:\/\//.test(link.url))
            .map((link) => (
              <a
                key={link.title}
                href={link.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {link.title}
              </a>
            ))}
        </div>
        <Facts
          items={[
            [
              "역할",
              c.productionRoles.map((r) => label(roleLabels, r)).join(", ") ||
                "-",
            ],
            [
              "리뷰",
              c.review.count > 0
                ? `★ ${c.review.averageRating?.toFixed(1) ?? "-"} (${c.review.count}개)`
                : "아직 없음",
            ],
          ]}
        />
      </Card>
      <h2 className="type-heading-md">패키지</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {[
          c.representativePackage,
          ...c.packages.filter((pkg) => pkg.id !== c.representativePackage.id),
        ].map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} creatorId={c.userId} />
        ))}
      </ul>
      <h2 className="type-heading-md">작업물</h2>
      {c.portfolios.length === 0 && <p>공개된 작업물이 없어요.</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {c.portfolios.map((p) => (
          <li key={p.id} className="showcase-card grid gap-2">
            <Link to={`/works/${p.id}`} className="grid gap-2">
              <Thumbnail portfolio={p} />
              <span className="type-title">{p.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

// 작품 피드(/)와 작품 상세(/works/:workId)
export default function CatalogLive() {
  const { workId } = useParams();
  return workId ? <WorkDetail id={workId} /> : <Feed />;
}
