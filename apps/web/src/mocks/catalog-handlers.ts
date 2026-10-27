import { http, HttpResponse, delay } from "msw";
import { allMockStudios } from "./studio-handlers";
import { readMockDisplayName } from "./auth-handlers";
import { catalogFixture, publicWorks } from "./catalog-model";
import { readMockPublicIntroduction } from "./profile-handlers";

export function catalogStudios() {
  const studios = new Map(allMockStudios());
  if (!studios.has("mock-creator"))
    studios.set("mock-creator", catalogFixture());
  return studios;
}
export function catalogCreator(id: string) {
  const studio = catalogStudios().get(id);
  if (!studio || studio.service !== "PUBLIC") return null;
  const packages = studio.packages.filter((p) => p.visibility === "PUBLIC");
  if (!packages.some((p) => p.id === studio.primaryId)) return null;
  const name = readMockDisplayName(id);
  const synthetic = id === "mock-creator" && !new Map(allMockStudios()).has(id);
  return {
    id,
    name,
    introduction:
      readMockPublicIntroduction(id) ??
      (synthetic
        ? "개발용 샘플 제작자 소개 · 편집과 영상의 흐름을 검토해요."
        : ""),
    primaryId: studio.primaryId,
    packages: [...packages].sort(
      (a, b) =>
        Number(b.id === studio.primaryId) - Number(a.id === studio.primaryId),
    ),
    works: publicWorks(studio, id, name, synthetic),
  };
}
let scenario = "success";
export default [
  http.post("/__mock__/catalog/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/__mock__/catalog", async ({ request }) => {
    const selected = scenario;
    await delay(selected === "delay" ? 1500 : 80);
    if (selected === "network") return HttpResponse.error();
    if (selected === "500")
      return HttpResponse.json({ message: "모의 조회 실패" }, { status: 500 });
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const p = new URL(request.url).searchParams;
    const all = Array.from(catalogStudios().keys()).flatMap(
      (id) => catalogCreator(id)?.works ?? [],
    );
    const filtered =
      selected === "empty"
        ? []
        : all.filter(
            (w) =>
              (!p.get("style") || w.style === p.get("style")) &&
              (!p.get("type") || w.workType === p.get("type")),
          );
    // D21: three per page and insertion order are QA examples, not ranking policy.
    const pages = Math.max(1, Math.ceil(filtered.length / 3));
    const rawPage = Number(p.get("page") ?? 1);
    const page =
      Number.isSafeInteger(rawPage) && rawPage > 0
        ? Math.min(rawPage, pages)
        : 1;
    const work =
      all.find(
        (w) =>
          w.id === p.get("workId") &&
          (!p.get("creatorId") || w.creatorId === p.get("creatorId")),
      ) ?? null;
    const creator = catalogCreator(p.get("creatorId") ?? "");
    if ((p.has("workId") && !work) || (p.has("creatorId") && !creator))
      return HttpResponse.json(
        { message: "공개 작품·제작자를 찾을 수 없어요." },
        { status: 404 },
      );
    return HttpResponse.json({
      works: filtered.slice((page - 1) * 3, page * 3),
      total: filtered.length,
      page,
      pages,
      styles: [...new Set(all.map((w) => w.style))],
      types: [...new Set(all.map((w) => w.workType))],
      creator,
      work,
    });
  }),
];
