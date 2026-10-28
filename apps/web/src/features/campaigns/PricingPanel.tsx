import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  pricingAnalysisRequestSchema,
  type AiReportApplyRequest,
  type PricingAnalysisRequest,
  type PricingAnalysisResponse,
} from "@kemi/shared";
import Button from "../../components/ui/button";
import { kemi } from "../../shared/api/kemi";
import { won } from "../live/labels";
import { errorText } from "../live/errors";
import { analysisError } from "./pricing-form";

// AI-01·02: 공고에 적은 조건으로 참고 제작비를 분석하고, 의뢰인이 확인한 뒤에만 예산에 반영한다.
// 분석하지 않거나 실패해도 예산은 직접 입력해 저장·공개할 수 있다.

export default function PricingPanel({
  conditions,
  target,
  onApply,
}: {
  // 분석 버튼을 누른 순간의 폼 값을 읽는다
  conditions: () => PricingAnalysisRequest;
  // 이미 저장된 초안·공고면 서버에도 반영 기록을 남긴다(AI-02). 없으면 입력란만 채운다.
  target: () => AiReportApplyRequest | null;
  onApply: (amountKrw: number) => void;
}) {
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const analyze = useMutation({
    mutationFn: (body: PricingAnalysisRequest) => kemi.analyzePricing(body),
    onMutate: () => setNotice(""),
  });
  const apply = useMutation({
    mutationFn: async (report: PricingAnalysisResponse) => {
      const where = target();
      if (report.reportId && where)
        await kemi.applyPricingReport(report.reportId, where);
      return report;
    },
    onSuccess: (report) => {
      onApply(report.estimatedBudgetKrw);
      setNotice(
        `${won(report.estimatedBudgetKrw)}을 예산에 넣었어요. 저장하거나 공개해야 공고에 반영돼요.`,
      );
    },
  });
  const report = analyze.data;
  return (
    <section
      aria-label="AI 참고 제작비"
      className="grid min-w-0 gap-3 rounded-2xl border p-4"
    >
      <div className="grid gap-1">
        <h3 className="type-heading-sm">AI 참고 제작비 (선택)</h3>
        <p className="text-sm text-muted-foreground">
          위에 적은 제목·설명·목적·스타일로 작업 항목과 참고 금액을 계산해요.
          개인정보는 설명에 적지 말아 주세요. 분석만으로 예산은 바뀌지 않아요.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        disabled={analyze.isPending}
        onClick={() => {
          setProblem("");
          const checked = pricingAnalysisRequestSchema.safeParse(conditions());
          if (!checked.success) {
            setProblem("설명을 10자 이상 적은 뒤 분석해 주세요.");
            return;
          }
          apply.reset();
          analyze.mutate(checked.data);
        }}
      >
        {analyze.isPending ? "분석 중… (최대 30초)" : "참고 제작비 분석"}
      </Button>
      {problem && <p role="alert">{problem}</p>}
      {analyze.error && <p role="alert">{analysisError(analyze.error)}</p>}
      {report && (
        <div className="grid min-w-0 gap-3 break-words" aria-live="polite">
          <p>{report.summary}</p>
          <ul className="grid gap-2">
            {report.workUnits.map((unit) => (
              <li
                key={`${unit.name}-${unit.unitPriceKrw}`}
                className="grid gap-1"
              >
                <p className="font-medium">
                  {unit.name} · {unit.quantity} × {won(unit.unitPriceKrw)} ={" "}
                  {won(unit.subtotalKrw)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {unit.rationale}
                </p>
              </li>
            ))}
          </ul>
          <p className="type-title">
            참고 합계 {won(report.estimatedBudgetKrw)}
          </p>
          {report.assumptions.length > 0 && (
            <p className="text-sm">가정: {report.assumptions.join(" / ")}</p>
          )}
          <p className="text-sm text-muted-foreground">{report.notice}</p>
          <Button
            type="button"
            className="justify-self-start"
            disabled={apply.isPending || apply.isSuccess}
            onClick={() => apply.mutate(report)}
          >
            참고 합계를 예산에 넣기
          </Button>
          {apply.error && (
            <p role="alert">
              {errorText(apply.error, "예산에 반영하지 못했어요.")}
            </p>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
