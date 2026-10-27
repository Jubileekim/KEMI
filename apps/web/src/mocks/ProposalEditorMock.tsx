import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router";
import { proposalInputSchema, type ProposalCommand } from "./proposal-model";
import type { proposalViewSchema } from "./proposal-api";
import Label from "../components/ui/label";
import Input from "../components/ui/input";
import Textarea from "../components/ui/textarea";
import Button from "../components/ui/button";
import ProposalConfirm from "./ProposalConfirm";

export default function ProposalEditorMock({
  campaignId,
  data,
  busy,
  error,
  submit,
}: {
  campaignId: string;
  data: z.infer<typeof proposalViewSchema>;
  busy: boolean;
  error: string;
  submit: (command: ProposalCommand, done?: () => void) => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [confirmed, setConfirmed] = useState<z.infer<
    typeof proposalInputSchema
  > | null>(null);
  const form = useForm<z.infer<typeof proposalInputSchema>>({
    resolver: zodResolver(proposalInputSchema),
    defaultValues: {
      direction: "",
      quote: "",
      days: "",
      workIds: [],
    },
  });
  const unavailable =
    !data.servicePublic ||
    !data.works.length ||
    data.campaign?.ended ||
    data.items.length > 0;
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">제안서 제출</h1>
      <p>{data.campaign?.title}</p>
      <p>
        공개 서비스와 본인의 공개 작업물이 필요해요. 제출 후 견적·작업물 제목
        사본을 보관해요. 선정과 계약은 별도예요.
      </p>
      {unavailable && (
        <p role="status">
          공개 서비스·작업물·기존 제출·종료 상태를 확인해 주세요.{" "}
          <Link to="/studio/packages">서비스 관리</Link> ·{" "}
          <Link to="/studio/portfolio">작업물 관리</Link> ·{" "}
          <Link to="/requests">내 제안 확인</Link>
        </p>
      )}
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit((values) => setConfirmed(values))}
      >
        <fieldset
          disabled={busy || !!unavailable}
          className="grid min-w-0 gap-4"
        >
          <div className="field-stack">
            <Label htmlFor="direction">제작 방향</Label>
            <Textarea
              id="direction"
              {...form.register("direction")}
              maxLength={4000}
            />
          </div>
          <div className="field-stack">
            <Label htmlFor="quote">제안 견적 (원)</Label>
            <Input id="quote" {...form.register("quote")} inputMode="numeric" />
          </div>
          <div className="field-stack">
            <Label htmlFor="proposal-days">작업 기간 (일)</Label>
            <Input
              id="proposal-days"
              {...form.register("days")}
              inputMode="numeric"
            />
          </div>
          <fieldset className="grid gap-2">
            <legend>관련 공개 작업물 (필수)</legend>
            {data.works.map((work) => (
              <label
                htmlFor={`work-${work.id}`}
                key={work.id}
                className="flex items-center gap-2"
              >
                <input
                  id={`work-${work.id}`}
                  type="checkbox"
                  value={work.id}
                  {...form.register("workIds")}
                />
                {work.title}
              </label>
            ))}
          </fieldset>
          {Object.keys(form.formState.errors).length > 0 && (
            <p role="alert">
              제작 방향·양의 정수 견적/기간·관련 작업물을 확인해 주세요. 글자수
              4,000·작업물 20개는 Mock 입력 보호 후보예요.
            </p>
          )}
          <Button type="submit">제안 내용 검토</Button>
        </fieldset>
      </form>
      {confirmed && (
        <div className="grid gap-3 rounded-xl border p-4">
          <h2 className="type-heading-md">제출 전 확인</h2>
          <p className="whitespace-pre-wrap break-words">
            {confirmed.direction}
          </p>
          <p>
            {Number(confirmed.quote).toLocaleString("ko-KR")}원 ·{" "}
            {confirmed.days}일
          </p>
          <p>
            {data.works
              .filter((work) => confirmed.workIds.includes(work.id))
              .map((work) => work.title)
              .join(", ")}
          </p>
          <ProposalConfirm
            label="제안 제출"
            description="개발용 Mock 제출이에요. 자동 선정·계약·결제를 만들지 않아요. 오류 시 내 제안에서 결과를 확인해 주세요."
            busy={busy || !!unavailable}
            error={error}
            onConfirm={(_, done) =>
              submit(
                { type: "submit", id, campaignId, values: confirmed },
                () => {
                  setConfirmed(null);
                  done();
                },
              )
            }
          />
        </div>
      )}
    </section>
  );
}
