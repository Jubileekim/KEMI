import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Button from "../components/ui/button";
import Textarea from "../components/ui/textarea";
import Input from "../components/ui/input";
import Label from "../components/ui/label";
import { ApiError } from "../shared/api/client";
import analyzePricing from "./pricing-api";
import {
  pricingAnalysisRequestSchema,
  type PricingReport,
} from "./pricing-model";

export default function PricingMock({
  disabled,
  conditionsKey,
  onApply,
}: {
  disabled: boolean;
  conditionsKey: string;
  onApply: (report: PricingReport, amountKrw: number) => void;
}) {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<{
    report: PricingReport;
    key: string;
    rows: {
      id: string;
      unit: PricingReport["response"]["workUnits"][number];
    }[];
  }>();
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const key = JSON.stringify([description.trim(), conditionsKey]);
  const mutation = useMutation({
    mutationFn: async () => {
      const abort = new AbortController();
      controller.current = abort;
      return { report: await analyzePricing(description, abort.signal), key };
    },
    onSuccess: (value) => {
      if (!mounted.current) return;
      setResult({
        ...value,
        rows: value.report.response.workUnits.map((unit) => ({
          id: crypto.randomUUID(),
          unit,
        })),
      });
      setAmount(String(value.report.response.estimatedBudgetKrw));
      setNotice(
        "분석만으로 예산은 바뀌지 않아요. 금액을 확인한 뒤 반영해 주세요.",
      );
    },
  });
  const validInput = pricingAnalysisRequestSchema.safeParse({
    description,
  }).success;
  const current = result?.key === key && !mutation.isPending && !mutation.error;
  const validAmount =
    /^\d+$/.test(amount) &&
    Number.isSafeInteger(Number(amount)) &&
    Number(amount) > 0 &&
    Number(amount) <= 1_000_000_000;
  let error =
    "분석 응답을 확인하지 못했어요. 수동 예산으로 진행하거나 다시 분석해 주세요.";
  if (mutation.error instanceof ApiError && mutation.error.status === 429)
    error = "분석 호출 한도를 초과했어요. 수동 예산으로 진행할 수 있어요.";
  if (
    mutation.error instanceof ApiError &&
    [401, 403].includes(mutation.error.status)
  )
    error = "분석 권한·로그인을 확인해 주세요. 수동 입력은 보존했어요.";
  return (
    <section
      aria-label="선택 AI 분석"
      className="grid min-w-0 gap-4 rounded-3xl border p-4 sm:p-6"
    >
      <h3 className="type-heading-sm">선택 AI 참고 제작비</h3>
      <p>
        개발용 고정 Mock · 실제 AI 호출이 아니에요. 분석하지 않거나 실패해도
        수동 예산으로 저장·공개할 수 있어요.
      </p>
      <p id="pricing-policy">
        분석에 보낼 제작 조건만 직접 작성해 주세요. 수량·길이·촬영·편집·납기
        등을 포함하고 개인정보·비공개 자료는 제외해 주세요. 다른 공고
        필드·파일은 전송하지 않아요. D16 입력·금액·저장·호출 정책은
        미결정이에요.
      </p>
      <Label htmlFor="pricing-description">분석용 제작 조건 (선택)</Label>
      <Textarea
        id="pricing-description"
        value={description}
        maxLength={5000}
        rows={4}
        disabled={disabled}
        aria-describedby="pricing-policy pricing-input"
        onChange={(event) => {
          setDescription(event.target.value);
          setNotice("");
        }}
      />
      <p id="pricing-input">
        기존 shared 요청 기준 10~5,000자. 캠페인 조건을 바꾸면 분석용 조건도
        확인하고 다시 분석해 주세요.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !validInput || mutation.isPending}
          onClick={() => {
            setResult(undefined);
            setNotice("");
            mutation.mutate();
          }}
        >
          {mutation.isPending ? "분석 중…" : "참고 제작비 분석"}
        </Button>
        {mutation.isPending && (
          <Button
            type="button"
            variant="outline"
            onClick={() => controller.current?.abort()}
          >
            분석 취소
          </Button>
        )}
      </div>
      <details>
        <summary>2-B 개발 전용 시나리오</summary>
        <Label htmlFor="pricing-scenario">Mock 분석 응답</Label>
        <select
          id="pricing-scenario"
          disabled={disabled || mutation.isPending}
          defaultValue="success"
          onChange={(event) => {
            fetch("/__mock__/pricing/scenario", {
              method: "POST",
              body: event.target.value,
            });
          }}
        >
          {[
            "success",
            "delay",
            "401",
            "403",
            "429",
            "503",
            "network",
            "malformed",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </details>
      {mutation.isPending && (
        <p role="status">
          참고 제작비를 분석하고 있어요. 수동 입력·저장은 계속할 수 있어요.
        </p>
      )}
      {mutation.error && <p role="alert">{error}</p>}
      {result && (
        <div
          className="grid min-w-0 gap-3 break-words"
          aria-label="참고 리포트"
        >
          <h4 className="type-heading-sm">참고 리포트</h4>
          <p>{result.report.response.summary}</p>
          <ul className="grid gap-3">
            {result.rows.map(({ id, unit }) => (
              <li key={id}>
                <p>
                  {unit.name} · {unit.quantity} ×{" "}
                  {unit.unitPriceKrw.toLocaleString("ko-KR")}원 ={" "}
                  {unit.subtotalKrw.toLocaleString("ko-KR")}원
                </p>
                <p>산정 이유: {unit.rationale}</p>
              </li>
            ))}
          </ul>
          <p>
            참고 합계:{" "}
            {result.report.response.estimatedBudgetKrw.toLocaleString("ko-KR")}
            원
          </p>
          <p>
            가정·누락 정보:{" "}
            {result.report.response.assumptions.join(" / ") ||
              "명시된 가정 없음 · 제작 조건을 직접 확인해 주세요."}
          </p>
          <p>{result.report.response.notice}</p>
          <p>
            비용 범위·누락 정보 전용 필드·실제 모델/프롬프트 버전은 현재 API에
            없어요. 이 예시는 단일 금액·Mock 버전만 제공해요.
          </p>
          {!current && (
            <p role="status">
              조건이 바뀌었거나 새 분석이 필요해요. 이전 결과는 반영할 수
              없어요.
            </p>
          )}
          <Label htmlFor="pricing-amount">예산에 반영할 금액 (원)</Label>
          <Input
            id="pricing-amount"
            inputMode="numeric"
            value={amount}
            maxLength={10}
            disabled={disabled || !current}
            onChange={(event) => {
              setAmount(event.target.value);
              setNotice("");
            }}
            aria-describedby="pricing-amount-help"
          />
          <p id="pricing-amount-help">
            참고 합계를 직접 조정할 수 있어요. 1~1,000,000,000원은 기존 분석
            응답 범위에 맞춘 Mock 보호 한도이며 팀 정책이 아니에요.
          </p>
          <Button
            type="button"
            disabled={disabled || !current || !validAmount}
            onClick={() => {
              onApply(result.report, Number(amount));
              setNotice(
                `${Number(amount).toLocaleString("ko-KR")}원을 예산 입력란에 반영했어요. 저장·공개는 별도로 진행해 주세요.`,
              );
            }}
          >
            확인한 금액을 예산에 반영
          </Button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
