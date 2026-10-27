import { z } from "zod";
import {
  emptyStudio,
  packageItemSchema,
  type StudioState,
} from "./studio-model";
import { emptyWork, workProblems, type WorkItem } from "./portfolio-model";

// Explicit synthetic catalog, independent of reviews or completed transactions.
export const catalogWorkSchema = z.strictObject({
  id: z.string(),
  creatorId: z.string(),
  creatorName: z.string(),
  title: z.string(),
  description: z.string(),
  style: z.string(),
  workType: z.string(),
  roles: z.array(z.string()),
  origin: z.enum(["SAMPLE", "EXTERNAL", "PLATFORM"]),
  source: z.string(),
  playable: z.boolean(),
});
export type CatalogWork = z.infer<typeof catalogWorkSchema>;
export const catalogRoleLabels: Record<string, string> = {
  FILMING: "촬영",
  EDITING: "편집",
  PLANNING: "기획",
  OTHER: "기타",
};
export const catalogCreatorSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  primaryId: z.string().nullable(),
  packages: z.array(packageItemSchema),
  works: z.array(catalogWorkSchema),
});
export const catalogViewSchema = z.strictObject({
  works: z.array(catalogWorkSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pages: z.number().int().positive(),
  styles: z.array(z.string()),
  types: z.array(z.string()),
  creator: catalogCreatorSchema.nullable(),
  work: catalogWorkSchema.nullable(),
});
export function catalogFixture(): StudioState {
  return {
    ...emptyStudio(),
    service: "PUBLIC",
    profileGate: "READY",
    primaryId: "sample-package",
    packages: [
      {
        id: "sample-package",
        visibility: "PUBLIC",
        title: "브랜드 영상 편집",
        description: "공개 샘플의 분위기를 바탕으로 함께 협의해요.",
        price: "100000",
        specification: "1920×1080 MP4",
        quantity: "1",
        included: "컷 편집·색보정",
        excluded: "현장 촬영",
        materials: "의뢰인 촬영본",
        days: "7",
        revisions: "1",
        originals: "협의 후 제공",
        usage: "브랜드 광고 사용 가능",
        commercial: true,
      },
    ],
    works: Array.from({ length: 5 }, (_, i) => ({
      ...emptyWork,
      id: `sample-work-${i + 1}`,
      title:
        [
          "일상에 머무는 빛",
          "제품의 작은 순간",
          "차분한 브랜드 이야기",
          "리듬 있는 하루",
          "새로운 시작",
        ][i] ?? "샘플",
      description:
        "KEMI 개발 검증용 합성 영상이에요. 실제 고객 작업·거래 실적이 아니에요.",
      roles: i % 2 ? ["FILMING", "EDITING"] : ["EDITING"],
      style: i % 2 ? "경쾌한" : "차분한",
      workType: i % 2 ? "제품 소개" : "브랜드 영상",
      source: "저장소 자체 제작 검증 영상",
      rights: true,
      asset: {
        name: "catalog-sample.webm",
        mime: "video/webm",
        size: 11810,
        ready: true,
      },
      visibility: "PUBLIC",
    })),
  };
}
export function publicWorks(
  studio: StudioState,
  id: string,
  name: string,
): CatalogWork[] {
  if (studio.service !== "PUBLIC") return [];
  return studio.works
    .filter(
      (w: WorkItem) => w.visibility === "PUBLIC" && !workProblems(w).length,
    )
    .map((w) => ({
      id: w.id,
      creatorId: id,
      creatorName: name,
      title: w.title,
      description: w.description,
      style: w.style,
      workType: w.workType,
      roles: w.roles,
      origin: w.origin,
      source: w.source,
      playable:
        id === "mock-creator" &&
        /^sample-work-[1-5]$/.test(w.id) &&
        w.asset?.name === "catalog-sample.webm",
    }));
}
