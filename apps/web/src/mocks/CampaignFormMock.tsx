import { Link } from "react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNow } from "./discovery-ui";
import { recruitmentStatus } from "./discovery-model";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Textarea from "../components/ui/textarea";
import Label from "../components/ui/label";
import PricingMock from "./PricingMock";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "../components/ui/dialog";
import {
  campaignFields,
  campaignValuesSchema,
  campaignProblems,
  campaignTime,
  emptyCampaign,
  type Campaign,
  type CampaignCommand,
} from "./campaign-model";

export default function CampaignFormMock({
  item,
  busy,
  onSave,
}: {
  item?: Campaign;
  busy: boolean;
  onSave: (command: CampaignCommand) => Promise<boolean>;
}) {
  const now = useNow();
  const form = useForm({
    defaultValues: item
      ? {
          title: item.title,
          product: item.product,
          purpose: item.purpose,
          scope: item.scope,
          budget: item.budget,
          references: item.references,
          days: item.days,
          pricingApplication: item.pricingApplication,
        }
      : emptyCampaign,
    resolver: zodResolver(campaignValuesSchema),
  });
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [confirm, setConfirm] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const pending = busy || form.formState.isSubmitting;
  const published = !!item && item.status !== "DRAFT";
  const currentValues = useWatch({ control: form.control });
  const conditionsKey = JSON.stringify([
    currentValues.title,
    currentValues.product,
    currentValues.purpose,
    currentValues.scope,
    currentValues.references,
    currentValues.days,
  ]);
  let heading = item ? "초안 재편집" : "새 캠페인";
  if (published) heading = "공개한 캠페인";
  async function submit(type: CampaignCommand["type"]) {
    setFailed(false);
    await form.handleSubmit(async (values) => {
      const issues = type === "publish" ? campaignProblems(values) : [];
      setProblems(issues);
      if (issues.length) return;
      if (await onSave({ type, id, values })) setConfirm(false);
      else setFailed(true);
    })();
  }
  return (
    <form
      noValidate
      className="showcase-card grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!published) submit("save");
      }}
    >
      <h2 className="type-heading-sm">{heading}</h2>
      <p>
        브랜드 정보 없이 개인도 작성·공개할 수 있어요. 미완성 초안은 비공개예요.
      </p>
      <p id="campaign-policy">
        D04 미결정 · 아래 필수값·문자 수·예산 검사는 모의 후보 기준이에요. 실제
        정책은 조율 중이에요. 참고 자료는 텍스트만 보관해요.
      </p>
      <fieldset
        disabled={pending || published}
        aria-describedby="campaign-policy"
        className="grid min-w-0 gap-4 sm:grid-cols-2"
      >
        {campaignFields.map(([key, label]) => {
          const error = form.formState.errors[key];
          const props = {
            id: `campaign-${key}`,
            ...form.register(key),
            maxLength: 4000,
            "aria-invalid": !!error,
            "aria-describedby": error ? `campaign-${key}-error` : undefined,
          };
          return (
            <div key={key} className="grid min-w-0 gap-2">
              <Label htmlFor={props.id}>{label}</Label>
              {["scope", "references"].includes(key) ? (
                <Textarea {...props} rows={4} />
              ) : (
                <Input
                  {...props}
                  inputMode={key === "budget" ? "numeric" : "text"}
                />
              )}
              {error && (
                <p role="alert" id={`campaign-${key}-error`}>
                  4,000자 이내로 작성해 주세요. (Mock 입력 보호 한도)
                </p>
              )}
            </div>
          );
        })}
        <div className="grid gap-2">
          <Label htmlFor="campaign-days">모집 기간</Label>
          <select id="campaign-days" {...form.register("days")}>
            <option value="3">3일</option>
            <option value="7">7일 (기본)</option>
            <option value="14">14일</option>
          </select>
          <p>
            공개 처리 시각부터 선택 일수 뒤 같은 시각에 마감해요. 저장만으로
            모집이 시작되지 않아요.
          </p>
        </div>
      </fieldset>
      {!published && (
        <PricingMock
          disabled={pending || confirm}
          conditionsKey={conditionsKey}
          onApply={(report, amountKrw) => {
            form.setValue("budget", String(amountKrw), {
              shouldDirty: true,
              shouldValidate: true,
            });
            form.setValue(
              "pricingApplication",
              { report, amountKrw },
              { shouldDirty: true },
            );
          }}
        />
      )}
      {currentValues.pricingApplication && (
        <p className="min-w-0 break-words">
          마지막 명시 반영 기록 (Mock):{" "}
          {currentValues.pricingApplication.amountKrw?.toLocaleString("ko-KR")}
          원 · 리포트 {currentValues.pricingApplication.report?.id}. 이후 수동
          수정한 현재 예산과 다를 수 있어요. 계약 금액에는 연결되지 않아요.
        </p>
      )}
      {problems.length > 0 && (
        <div role="alert">
          <p>공개 전 모의 확인이 필요해요.</p>
          <ul className="list-inside list-disc">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {published && item.publishedAt && item.recruitmentEndAt ? (
        <div role="status" className="grid gap-2">
          <p>
            모의 공개 완료 ·{" "}
            {recruitmentStatus(item, now) === "CLOSED"
              ? "모집 마감"
              : "모집 중"}
          </p>
          <Link to={`/campaigns/${item.id}`}>모집 상세에서 상태 확인</Link>
          <p>공개: {campaignTime(item.publishedAt)}</p>
          <p>마감: {campaignTime(item.recruitmentEndAt)}</p>
          <p>
            공개 후 수정·삭제는 후속 범위예요. 실제 공개 목록·제안 접수는
            미연결이에요.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "처리 중…" : "임시 저장"}
          </Button>
          <Dialog
            open={confirm}
            onOpenChange={(open) => {
              if (!pending) setConfirm(open);
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" variant="outline" disabled={pending}>
                공개 내용 확인
              </Button>
            </DialogTrigger>
            <DialogContent
              onEscapeKeyDown={(event) => {
                if (pending) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (pending) event.preventDefault();
              }}
            >
              <DialogHeader>
                <DialogTitle>캠페인 공개 확인</DialogTitle>
                <DialogDescription>
                  실제 공개가 아닌 개발용 Mock이에요. 입력 내용을 확인한 뒤
                  명시적으로 공개해 주세요.
                </DialogDescription>
              </DialogHeader>
              <div className="grid max-h-[50vh] gap-3 overflow-y-auto break-words">
                {campaignFields.map(([key, label]) => (
                  <p key={key}>
                    <strong>{label}:</strong> {form.getValues(key) || "미입력"}
                  </p>
                ))}
                <p>
                  모집 {form.getValues("days")}일 · 공개 처리 시각 기준으로 같은
                  시각에 마감하며, 확정 마감은 응답 후 한국 시간으로 표시해요.
                </p>
                <p>
                  D04 필수값은 모의 후보 기준이에요. AI 분석 없이 수동 예산으로
                  진행할 수 있어요. 분석 결과는 명시 반영한 경우에만 예산에
                  적용돼요.
                </p>
                {problems.length > 0 && (
                  <p role="alert">{problems.join(" ")}</p>
                )}
                {failed && (
                  <p role="alert">
                    공개 응답을 확인하지 못했어요. 입력은 보존했어요. 닫은 뒤
                    최신 값 확인으로 공개 결과를 먼저 확인해 주세요.
                  </p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={pending}>
                    공개 취소
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => submit("publish")}
                >
                  {pending ? "공개 처리 중…" : "모의 공개 확정"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </form>
  );
}
