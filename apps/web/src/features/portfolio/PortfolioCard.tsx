import { Link } from "react-router";
import type { CatalogWork } from "../../mocks/catalog-model";
import { catalogRoleLabels } from "../../mocks/catalog-model";
import poster from "../../mocks/assets/catalog-poster.png";

export default function PortfolioCard({ work }: { work: CatalogWork }) {
  return (
    <article className="showcase-card grid min-w-0 gap-3">
      <Link
        to={`/works/${encodeURIComponent(work.id)}?creatorId=${encodeURIComponent(work.creatorId)}`}
        className="grid gap-3"
      >
        {work.playable ? (
          <img
            className="aspect-video w-full rounded-xl object-cover"
            src={poster}
            alt="합성 샘플 영상의 첫 장면"
          />
        ) : (
          <div
            className="grid aspect-video place-content-center rounded-xl bg-muted p-6 text-center text-primary"
            aria-hidden="true"
          >
            영상 미리보기 준비 중
          </div>
        )}
        <h2 className="type-heading-md">{work.title}</h2>
      </Link>
      <p className="text-sm text-muted-foreground">
        {work.workType} · {work.style}
      </p>
      <p>
        {work.origin === "SAMPLE" ? "자작 샘플" : "고객 공개 동의 작업"} ·{" "}
        {work.roles.map((r) => catalogRoleLabels[r] ?? r).join(" · ")}
      </p>
      <Link to={`/creators/${encodeURIComponent(work.creatorId)}`}>
        {work.creatorName}
      </Link>
    </article>
  );
}
