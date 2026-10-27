import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import Label from "../../components/ui/label";

const fields = [
  ["reason", "취소 사유"],
  ["progress", "현재 진행 내역"],
  ["files", "인도할 파일 목록·규격"],
  ["unfinished", "미완성 작업 처리"],
  ["originals", "촬영 원본·프로젝트 인도 조건"],
  ["rights", "사용권·이용 범위"],
] as const;
const required = z.string().trim().min(1, "내용을 입력해 주세요.").max(2000);
const formSchema = z.strictObject({
  reason: required,
  progress: required,
  compensation: z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/, "0 이상의 정수 원을 입력해 주세요."),
  files: required,
  unfinished: required,
  originals: required,
  rights: required,
});
export type CancellationFormValues = z.infer<typeof formSchema>;
export default function CancellationForm({
  disabled,
  amount,
  onSubmit,
}: {
  disabled: boolean;
  amount: number;
  onSubmit: (values: CancellationFormValues) => void;
}) {
  const schema = formSchema.refine(
    (v) =>
      Number.isSafeInteger(Number(v.compensation)) &&
      Number(v.compensation) <= amount,
    {
      path: ["compensation"],
      message: "계약 금액 이하의 정수 원을 입력해 주세요.",
    },
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CancellationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: "",
      progress: "",
      compensation: "0",
      files: "",
      unfinished: "",
      originals: "",
      rights: "",
    },
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={handleSubmit(onSubmit)}
      aria-label="취소 요청 작성"
    >
      <fieldset disabled={disabled} className="grid min-w-0 gap-4">
        <legend className="type-heading-sm">취소 조건 제안</legend>
        <p>
          희망 금액이며 상대방 확인 전에는 확정되지 않아요. 인도할 파일이 없으면
          그 사실과 사용권 조건을 적어 주세요.
        </p>
        {fields.map(([name, label]) => (
          <div className="grid gap-2" key={name}>
            <Label htmlFor={`cancel-${name}`}>{label}</Label>
            <Textarea
              id={`cancel-${name}`}
              {...register(name)}
              maxLength={2000}
              aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `error-${name}` : undefined}
            />
            {errors[name] && (
              <p id={`error-${name}`} role="alert">
                {errors[name].message}
              </p>
            )}
          </div>
        ))}
        <Label htmlFor="cancel-compensation">희망 완료 대가 (원)</Label>
        <Input
          id="cancel-compensation"
          inputMode="numeric"
          {...register("compensation")}
          aria-invalid={Boolean(errors.compensation)}
          aria-describedby="error-compensation"
        />
        <p
          id="error-compensation"
          role={errors.compensation ? "alert" : undefined}
        >
          {errors.compensation?.message ??
            `계약 금액 ${amount.toLocaleString("ko-KR")}원 이하 · 환불액은 차액으로 표시해요.`}
        </p>
        <Button type="submit">새 취소 조건 제안 (Mock)</Button>
      </fieldset>
    </form>
  );
}
