import { z } from "zod";
import { creatorServiceStatusSchema } from "@kemi/shared";
import {
  workItemSchema,
  portfolioCommandSchema,
  changeWorks,
} from "./portfolio-model";

// Candidate UI fixtures only. These are NOT product API DTOs or approved policies.
export const packageFields = {
  title: "상품명",
  description: "설명",
  price: "가격 (원)",
  specification: "규격",
  quantity: "수량",
  included: "포함 작업",
  excluded: "제외 작업",
  materials: "필요 자료",
  days: "기간 (일)",
  revisions: "수정 횟수",
  originals: "원본 제공 조건",
  usage: "사용권·광고 활용 조건",
} as const;
const text = z.string().trim().max(4000);
export const packageSchema = z.object({
  title: text,
  description: text,
  price: text,
  specification: text,
  quantity: text,
  included: text,
  excluded: text,
  materials: text,
  days: text,
  revisions: text,
  originals: text,
  usage: text,
  commercial: z.boolean(),
});
export type PackageValues = z.infer<typeof packageSchema>;
export const emptyPackage: PackageValues = {
  title: "",
  description: "",
  price: "",
  specification: "",
  quantity: "",
  included: "",
  excluded: "",
  materials: "",
  days: "",
  revisions: "",
  originals: "",
  usage: "",
  commercial: false,
};
export const packageItemSchema = packageSchema.extend({
  id: z.string(),
  visibility: z.enum(["DRAFT", "PUBLIC", "PRIVATE"]),
});
export type PackageItem = z.infer<typeof packageItemSchema>;
export const studioSchema = z.object({
  revision: z.number().int().nonnegative(),
  service: creatorServiceStatusSchema,
  profileGate: z.enum(["UNKNOWN", "READY", "MISSING"]),
  primaryId: z.string().nullable(),
  packages: z.array(packageItemSchema),
  // A separate synthetic reference lets tests demonstrate immutable historic values.
  reference: packageItemSchema.nullable(),
  works: z.array(workItemSchema),
  workReference: workItemSchema.nullable(),
});
export type StudioState = z.infer<typeof studioSchema>;
export function emptyStudio(): StudioState {
  return {
    revision: 0,
    service: "DRAFT",
    profileGate: "UNKNOWN",
    primaryId: null,
    packages: [],
    reference: null,
    works: [],
    workReference: null,
  };
}
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("save-package"),
    id: z.string(),
    values: packageSchema,
    visibility: z.enum(["DRAFT", "PUBLIC", "PRIVATE"]),
  }),
  z.object({ type: z.literal("primary"), id: z.string() }),
  z.object({ type: z.literal("service"), public: z.boolean() }),
  z.object({
    type: z.literal("profile-gate"),
    value: z.enum(["UNKNOWN", "READY", "MISSING"]),
  }),
  z.object({ type: z.literal("capture-reference"), id: z.string() }),
  ...portfolioCommandSchema.options,
]);
export type StudioCommand = z.infer<typeof commandSchema>;
export function packageProblems(values: PackageValues) {
  const problems: string[] = [];
  Object.entries(packageFields).forEach(([key, label]) => {
    if (!String(Reflect.get(values, key)).trim())
      problems.push(`${label}을 입력해 주세요.`);
  });
  (["price", "quantity", "days", "revisions"] as const).forEach((key) => {
    const value = values[key];
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) < (key === "revisions" ? 0 : 1)
    )
      problems.push(
        `${packageFields[key]}은 ${key === "revisions" ? "0 이상의" : "양의"} 정수로 입력해 주세요.`,
      );
  });
  if (!values.commercial)
    problems.push(
      "비상업용 전용 상품은 공개할 수 없어요. 광고 활용 가능 여부를 확인해 주세요.",
    );
  return problems;
}
export function applyStudio(
  state: StudioState,
  command: StudioCommand,
): StudioState {
  const next = structuredClone(state);
  if (
    command.type === "save-work" ||
    command.type === "delete-work" ||
    command.type === "capture-work-reference"
  ) {
    const changed = changeWorks(next, command);
    next.works = changed.works;
    next.workReference = changed.workReference;
  }
  if (command.type === "save-package") {
    const old = next.packages.find((item) => item.id === command.id);
    if (command.visibility === "PUBLIC") {
      const problems = packageProblems(command.values);
      if (problems.length) throw new Error(problems.join(" "));
    }
    if (command.visibility !== "PUBLIC" && next.primaryId === command.id) {
      if (next.service === "PUBLIC")
        throw new Error(
          "다른 공개 패키지를 대표로 지정하거나 서비스를 먼저 비공개로 바꿔 주세요. 자동 전환 정책은 미결정이에요.",
        );
      next.primaryId = null;
    }
    const item = {
      ...command.values,
      id: command.id,
      visibility: command.visibility,
    };
    if (old)
      next.packages = next.packages.map((p) => (p.id === item.id ? item : p));
    else next.packages.push(item);
  }
  if (command.type === "primary") {
    if (
      !next.packages.some(
        (p) => p.id === command.id && p.visibility === "PUBLIC",
      )
    )
      throw new Error("본인의 공개 패키지만 대표로 지정할 수 있어요.");
    next.primaryId = command.id;
  }
  if (command.type === "service") {
    if (command.public) {
      if (next.profileGate !== "READY")
        throw new Error(
          "D01 필수 프로필 기준이 미결정이에요. 내 프로필을 확인하고 개발 도구에서 모의 충족 상태를 선택해 검증해 주세요.",
        );
      if (
        !next.packages.some(
          (p) => p.id === next.primaryId && p.visibility === "PUBLIC",
        )
      )
        throw new Error(
          "공개 패키지를 저장한 뒤 대표로 지정해 주세요. 작업물은 필수 조건이 아니에요.",
        );
    }
    next.service = command.public ? "PUBLIC" : "PRIVATE";
  }
  if (command.type === "profile-gate") {
    if (next.service === "PUBLIC" && command.value !== "READY")
      throw new Error(
        "서비스를 먼저 비공개로 전환한 뒤 모의 조건을 변경해 주세요.",
      );
    next.profileGate = command.value;
  }
  if (command.type === "capture-reference") {
    const item = next.packages.find((p) => p.id === command.id);
    if (!item) throw new Error("패키지를 찾을 수 없어요.");
    if (next.reference) throw new Error("기존 모의 계약 참조는 유지해요.");
    next.reference = structuredClone(item);
  }
  next.revision += 1;
  return next;
}
export function visiblePackages(state: StudioState) {
  return state.service === "PUBLIC"
    ? state.packages.filter((p) => p.visibility === "PUBLIC")
    : [];
}
export function visibleWorks(state: StudioState) {
  return state.service === "PUBLIC"
    ? state.works.filter((work) => work.visibility === "PUBLIC")
    : [];
}
