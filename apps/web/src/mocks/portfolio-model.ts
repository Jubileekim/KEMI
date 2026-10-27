import { z } from "zod";
import { productionRoleSchema } from "@kemi/shared";
import { assetSchema } from "../shared/files/local-preview";

export const workSchema = z.object({
  title: z.string().trim().max(4000),
  description: z.string().trim().max(4000),
  roles: z.array(productionRoleSchema),
  style: z.string().trim().max(4000),
  workType: z.string().trim().max(4000),
  origin: z.enum(["SAMPLE", "EXTERNAL", "PLATFORM"]),
  source: z.string().trim().max(4000),
  mediaKind: z.enum(["FILE", "URL"]),
  externalUrl: z.string().trim().max(2048),
  asset: assetSchema.nullable(),
  rights: z.boolean(),
  consent: z.boolean(),
});
export const workItemSchema = workSchema.extend({
  id: z.string(),
  visibility: z.enum(["DRAFT", "PUBLIC", "PRIVATE"]),
});
export type WorkValues = z.infer<typeof workSchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
export const emptyWork: WorkValues = {
  title: "",
  description: "",
  roles: [],
  style: "",
  workType: "",
  origin: "SAMPLE",
  source: "",
  mediaKind: "FILE",
  externalUrl: "",
  asset: null,
  rights: false,
  consent: false,
};
export const originLabels = {
  SAMPLE: "자작 샘플",
  EXTERNAL: "외부 고객 작업",
  PLATFORM: "플랫폼 작업",
};
export function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function workProblems(values: WorkValues) {
  const problems: string[] = [];
  if (!values.title) problems.push("작업물 제목을 입력해 주세요.");
  if (!values.description) problems.push("작업물 설명을 입력해 주세요.");
  if (!values.roles.length) problems.push("본인의 담당 역할을 선택해 주세요.");
  if (!values.style || !values.workType)
    problems.push(
      "스타일·작업유형을 입력해 주세요. 선택 분류 D21은 미확정이에요.",
    );
  if (!values.source) problems.push("출처를 표시해 주세요.");
  if (!values.rights) problems.push("본인의 공개 권한을 확인해 주세요.");
  if (values.origin !== "SAMPLE" && !values.consent)
    problems.push(
      "고객 작업물의 공개 동의를 확인해 주세요. 거래물은 자동 공개하지 않아요.",
    );
  if (values.mediaKind === "FILE" && !values.asset?.ready)
    problems.push(
      "파일 선택 후 Mock 업로드 완료 처리를 해 주세요. 실제 파일 저장은 미연결이에요.",
    );
  // URL allowlisting/provider verification is unresolved. Never imply a URL is publishable.
  if (values.mediaKind === "URL")
    problems.push(
      "외부 URL 공개·재생 허용 범위 D02가 미결정이에요. URL은 초안으로만 저장할 수 있어요.",
    );
  return problems;
}
export const portfolioCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("save-work"),
    id: z.string(),
    values: workSchema,
    visibility: z.enum(["DRAFT", "PUBLIC", "PRIVATE"]),
  }),
  z.object({ type: z.literal("delete-work"), id: z.string() }),
  z.object({ type: z.literal("capture-work-reference"), id: z.string() }),
]);
export type PortfolioCommand = z.infer<typeof portfolioCommandSchema>;
export function changeWorks(
  state: { works: WorkItem[]; workReference: WorkItem | null },
  command: PortfolioCommand,
) {
  const next = structuredClone(state);
  if (command.type === "save-work") {
    const values = workSchema.parse(command.values);
    if (
      values.mediaKind === "URL" &&
      values.externalUrl &&
      !safeExternalUrl(values.externalUrl)
    )
      throw new Error(
        "외부 주소는 자격 정보가 없는 https URL로 입력해 주세요. 주소를 열거나 영상을 가져오지 않아요.",
      );
    if (command.visibility === "PUBLIC") {
      const issues = workProblems(values);
      if (issues.length) throw new Error(issues.join(" "));
    }
    // Irrelevant media values do not survive a source switch.
    const item = {
      ...values,
      asset: values.mediaKind === "FILE" ? values.asset : null,
      externalUrl: values.mediaKind === "URL" ? values.externalUrl : "",
      id: command.id,
      visibility: command.visibility,
    };
    if (next.works.some((w) => w.id === item.id))
      next.works = next.works.map((w) => (w.id === item.id ? item : w));
    else next.works.push(item);
  }
  if (command.type === "delete-work") {
    if (!next.works.some((w) => w.id === command.id))
      throw new Error("본인의 작업물을 찾을 수 없어요.");
    next.works = next.works.filter((w) => w.id !== command.id);
  }
  if (command.type === "capture-work-reference") {
    const item = next.works.find((w) => w.id === command.id);
    if (!item || next.workReference)
      throw new Error("작업물이 없거나 기존 모의 제출 참조가 있어요.");
    next.workReference = structuredClone(item);
  }
  return next;
}
