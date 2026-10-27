import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  TERMS_TEXT_FIELDS,
  type TermsDocument,
  type TermsValues,
  type TermsVersion,
} from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi, newCommandId } from "../../shared/api/kemi";
import { dateTime, label, termsStatusLabels, won } from "../live/labels";
import { Card, Facts, Field } from "../live/ui";
import { errorText } from "../live/errors";

const fieldLabels: Record<(typeof TERMS_TEXT_FIELDS)[number], string> = {
  specification: "영상 사양",
  scope: "작업 범위",
  materials: "제공 자료",
  deadline: "납품 기한",
  revisions: "수정 횟수",
  usageRights: "사용 범위",
  cancellation: "취소·환불",
};

function VersionView({ version }: { version: TermsVersion }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="type-title">{version.versionNo}번째 버전</h3>
        <Badge variant="secondary">
          {label(termsStatusLabels, version.status)}
        </Badge>
      </div>
      <Facts
        items={[
          [
            "최종 금액",
            version.values.amountKrw ? won(version.values.amountKrw) : "미정",
          ],
          ...TERMS_TEXT_FIELDS.map((field): [string, string] => [
            fieldLabels[field],
            version.values[field] ?? "미정",
          ]),
        ]}
      />
      {version.signing && (
        <p className="text-muted-foreground">
          서명 기한 {dateTime(version.signing.expiresAt)} · 서명{" "}
          {version.signatures.length}/2
          {version.signatures
            .map((s) => ` · ${s.signerName}(${dateTime(s.signedAt)})`)
            .join("")}
        </p>
      )}
    </div>
  );
}

function Editor({
  requestId,
  base,
  onDone,
}: {
  requestId: string;
  base: TermsVersion | undefined;
  onDone: () => void;
}) {
  const [commandId] = useState(newCommandId);
  const save = useMutation({
    mutationFn: (values: TermsValues) =>
      kemi.saveTerms(requestId, {
        commandId,
        baseVersionNo: base?.versionNo ?? 0,
        values,
      }),
    onSuccess: onDone,
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const text = (name: string) =>
          String(form.get(name) ?? "").trim() || null;
        const amount = Number(form.get("amountKrw"));
        save.mutate({
          amountKrw: Number.isInteger(amount) && amount > 0 ? amount : null,
          specification: text("specification"),
          scope: text("scope"),
          materials: text("materials"),
          deadline: text("deadline"),
          revisions: text("revisions"),
          usageRights: text("usageRights"),
          cancellation: text("cancellation"),
        });
      }}
    >
      <Field id="terms-amount" label="최종 금액 (원)">
        <Input
          id="terms-amount"
          name="amountKrw"
          type="number"
          min="1"
          step="1"
          defaultValue={base?.values.amountKrw ?? undefined}
        />
      </Field>
      {TERMS_TEXT_FIELDS.map((field) => (
        <Field key={field} id={`terms-${field}`} label={fieldLabels[field]}>
          <Textarea
            id={`terms-${field}`}
            name={field}
            rows={2}
            maxLength={4000}
            defaultValue={base?.values[field] ?? ""}
          />
        </Field>
      ))}
      <p className="text-sm text-muted-foreground">
        비어 있는 항목이 있어도 저장할 수 있어요. 서명은 모든 항목이 채워진
        버전에만 요청할 수 있어요.
      </p>
      {save.error && (
        <p role="alert">
          {errorText(save.error, "조건서를 저장하지 못했어요.")}
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        새 버전으로 저장
      </Button>
    </form>
  );
}

function SignForm({
  requestId,
  version,
  onDone,
}: {
  requestId: string;
  version: TermsVersion;
  onDone: () => void;
}) {
  const [consent, setConsent] = useState(false);
  const sign = useMutation({
    mutationFn: (signerName: string) =>
      kemi.sign(requestId, version.versionNo, {
        signerName,
        consent: true,
        termsHash: version.termsHash,
      }),
    onSuccess: onDone,
  });
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const name = String(
          new FormData(event.currentTarget).get("signerName") ?? "",
        ).trim();
        if (name && consent) sign.mutate(name);
      }}
    >
      <Field id="sign-name" label="서명자 이름">
        <Input id="sign-name" name="signerName" required maxLength={100} />
      </Field>
      <label htmlFor="sign-consent" className="flex items-center gap-2">
        <input
          id="sign-consent"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        위 {version.versionNo}번째 버전 조건에 동의하고 서명합니다.
      </label>
      {sign.error && (
        <p role="alert">{errorText(sign.error, "서명하지 못했어요.")}</p>
      )}
      <Button type="submit" disabled={sign.isPending || !consent}>
        서명하기
      </Button>
    </form>
  );
}

// TERMS-01~03·CONTRACT-01: 최종 조건서 버전·서명 요청·양측 서명(실제 API).
// 같은 버전에 양측이 서명하면 계약이 생기고 이 후보가 선정된다.
export default function TermsLive({
  requestId,
  document,
}: {
  requestId: string;
  document: TermsDocument;
}) {
  const { user, role } = useSession();
  const client = useQueryClient();
  const refresh = () => {
    client.invalidateQueries({ queryKey: ["terms", requestId] });
    client.invalidateQueries({ queryKey: ["chat", requestId] });
  };
  const [editing, setEditing] = useState(false);
  const signing = useMutation({
    mutationFn: (versionNo: number) =>
      kemi.requestSigning(requestId, versionNo),
    onSuccess: refresh,
  });
  const latest = document.versions.at(-1);
  const { contract } = document;
  if (contract)
    return (
      <Card title="계약">
        <Facts
          items={[
            ["계약 금액", won(contract.amountKrw)],
            ["서명 완료", dateTime(contract.signedAt)],
            ["상태", contract.status === "SIGNED" ? "체결" : "취소됨"],
            ["조건서", `${contract.termsVersionNo}번째 버전`],
          ]}
        />
        <div className="flex flex-wrap gap-3">
          {role === "client" && (
            <Button asChild>
              <Link to={`/contracts/${contract.id}/payment`}>테스트 결제</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={`/contracts/${contract.id}/production`}>제작 준비</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/contracts/${contract.id}/deliveries`}>납품·수정</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/contracts/${contract.id}/settlement`}>정산·리뷰</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/contracts/${contract.id}/cancellation`}>취소·분쟁</Link>
          </Button>
        </div>
        {latest && <VersionView version={latest} />}
      </Card>
    );
  const open = document.workRequestStatus === "DISCUSSING";
  const signedByMe =
    latest?.signatures.some((s) => s.userId === user?.id) ?? false;
  return (
    <Card title="최종 조건서">
      {!open && (
        <p role="status">협의 중일 때만 조건서를 쓰고 서명할 수 있어요.</p>
      )}
      {latest ? (
        <VersionView version={latest} />
      ) : (
        <p>아직 저장된 조건서가 없어요.</p>
      )}
      {open && latest?.status === "DRAFT" && (
        <Button
          disabled={signing.isPending}
          onClick={() => signing.mutate(latest.versionNo)}
        >
          이 버전으로 서명 요청
        </Button>
      )}
      {open && latest?.status === "SIGNING" && !signedByMe && (
        <SignForm requestId={requestId} version={latest} onDone={refresh} />
      )}
      {open && latest?.status === "SIGNING" && signedByMe && (
        <p role="status">상대방의 서명을 기다리고 있어요.</p>
      )}
      {signing.error && <p role="alert">{errorText(signing.error)}</p>}
      {open &&
        (editing ? (
          <Editor
            requestId={requestId}
            base={latest}
            onDone={() => {
              setEditing(false);
              refresh();
            }}
          />
        ) : (
          <Button variant="outline" onClick={() => setEditing(true)}>
            {latest ? "조건 수정(새 버전)" : "조건서 작성"}
          </Button>
        ))}
    </Card>
  );
}
