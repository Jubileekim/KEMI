import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "../../components/ui/button";
import Label from "../../components/ui/label";
import Textarea from "../../components/ui/textarea";
import TermsVersionView, { TermsReferences } from "./TermsVersionView";
import {
  emptyTerms,
  missingTerms,
  sameTerms,
  termsFields,
  termsValuesSchema,
  type TermsCommand,
  type TermsDocument,
  type TermsValues,
} from "../../mocks/terms-model";

export default function TermsEditor({
  document,
  requestId,
  editable,
  busy,
  unresolved,
  onSave,
}: {
  document: TermsDocument;
  requestId: string;
  editable: boolean;
  busy: boolean;
  unresolved: boolean;
  onSave: (
    command: TermsCommand,
    done: (document: TermsDocument) => void,
  ) => void;
}) {
  const latest = document.versions.at(-1);
  const [baseRevision, setBaseRevision] = useState(document.revision);
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<TermsValues>({
    resolver: zodResolver(termsValuesSchema),
    defaultValues: latest?.values ?? emptyTerms,
  });
  const conflict = baseRevision !== document.revision;
  const locked = busy || unresolved || !editable;
  const viewed = document.versions.find((v) => v.number === selected) ?? latest;
  const previous =
    viewed && document.versions.find((v) => v.number === viewed.number - 1);
  const copy = (values: TermsValues, message: string) => {
    reset(values, { keepDefaultValues: true });
    setNotice(message);
  };
  return (
    <div className="grid min-w-0 gap-4">
      <TermsReferences sources={document.sources} />
      <p>
        작성본은 서명 요청 전의 저장 이력이에요. 양측 서명·48시간
        만료·선정·결제는 후속 범위예요.
      </p>
      {!editable && (
        <p role="status">
          협의 종료 또는 계약 상태에서는 이력 조회만 가능해요.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={locked || isDirty}
          onClick={() =>
            copy(
              {
                ...emptyTerms,
                amount: document.sources.proposal.quote,
                scope: document.sources.proposal.direction,
                deadline: `${document.sources.proposal.days}일 · 시작 기준 확인 필요`,
              },
              "제안 값을 편집기에 불러왔어요. 최종 조건을 확인해 주세요.",
            )
          }
        >
          제안 값 불러오기
        </Button>
        <Button
          variant="outline"
          disabled={locked || isDirty || !document.sources.package}
          onClick={() => {
            const p = document.sources.package;
            if (p)
              copy(
                {
                  amount: p.price,
                  specification: `${p.specification}\n수량: ${p.quantity}`,
                  scope: `포함: ${p.included}\n제외: ${p.excluded}`,
                  materials: p.materials,
                  deadline: `${p.days}일 · 시작 기준 확인 필요`,
                  revisions: p.revisions,
                  usage: `${p.usage}\n원본: ${p.originals}`,
                  cancellation: "",
                },
                "패키지 값을 편집기에 불러왔어요. 취소 조건과 최종 값을 확인해 주세요.",
              );
          }}
        >
          패키지 값 불러오기
        </Button>
      </div>
      {conflict && (
        <div className="rounded-xl border p-4" role="status">
          <p>
            최신 저장본은 v{document.revision}이에요. 입력은 보존했어요. 아래
            이력과 비교한 뒤 기준을 갱신해 주세요.
          </p>
          <Button
            variant="outline"
            disabled={locked}
            onClick={() => setBaseRevision(document.revision)}
          >
            최신 버전 기준으로 다시 검토
          </Button>
        </div>
      )}
      <form
        className="grid gap-4"
        onSubmit={handleSubmit((values) => {
          if (locked || conflict) return;
          onSave(
            {
              id: crypto.randomUUID(),
              requestId,
              revision: baseRevision,
              sources: document.sources,
              values,
            },
            (saved) => {
              const confirmed = saved.versions.at(-1);
              if (!confirmed || !sameTerms(confirmed.values, values)) return;
              reset(values);
              setBaseRevision(saved.revision);
              setSelected(null);
            },
          );
        })}
      >
        <fieldset
          disabled={locked}
          className="grid min-w-0 gap-4 sm:grid-cols-2"
        >
          <legend className="type-heading-md mb-4">최종 조건 편집</legend>
          {Object.entries(termsFields).map(([key, label]) => {
            const field = termsValuesSchema.keyof().parse(key);
            return (
              <div className="field-stack" key={key}>
                <Label htmlFor={`terms-${key}`}>{label}</Label>
                <Textarea
                  id={`terms-${key}`}
                  maxLength={4000}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={
                    errors[field] ? `terms-${key}-error` : undefined
                  }
                  {...register(field)}
                />
                {errors[field] && (
                  <p id={`terms-${key}-error`} role="alert">
                    {errors[field]?.message}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
        <p>
          누락 값이 있어도 작성본을 저장할 수 있어요. 모든 조건을 갖추기 전에는
          서명을 요청할 수 없어요. 4,000자·금액 입력 검사는 Mock 보호 후보예요.
        </p>
        <Button
          type="submit"
          disabled={locked || conflict || (!isDirty && Boolean(latest))}
        >
          {busy ? "저장 상태 확인 중…" : "새 작성본 저장"}
        </Button>
      </form>
      {notice && <p role="status">{notice}</p>}
      <Button
        variant="outline"
        disabled={locked}
        onClick={() => {
          reset(latest?.values ?? emptyTerms);
          setBaseRevision(document.revision);
          setNotice("입력을 최신 저장본으로 되돌렸어요.");
        }}
      >
        입력 취소·최신 작성본 불러오기
      </Button>
      <Button disabled>서명 요청 · 후속 범위</Button>
      <Label htmlFor="terms-history">저장된 버전 이력</Label>
      <select
        id="terms-history"
        value={selected ?? latest?.number ?? ""}
        disabled={busy || !latest}
        onChange={(e) => setSelected(Number(e.target.value))}
      >
        {!latest && <option value="">저장된 작성본 없음</option>}
        {document.versions.map((v) => (
          <option key={v.id} value={v.number}>
            v{v.number}
            {v === latest ? " · 최신" : " · 이전"}
          </option>
        ))}
      </select>
      {viewed && (
        <>
          <p>미입력 조건: {missingTerms(viewed.values).join(", ") || "없음"}</p>
          <TermsVersionView version={viewed} previous={previous} />
          <Button
            variant="outline"
            disabled={locked || isDirty}
            onClick={() =>
              copy(
                viewed.values,
                `v${viewed.number}을 편집기에 불러왔어요. 저장하면 새 작성본이 생겨요.`,
              )
            }
          >
            선택 버전을 편집기에 불러오기
          </Button>
        </>
      )}
    </div>
  );
}
