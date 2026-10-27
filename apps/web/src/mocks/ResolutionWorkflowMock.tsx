import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import Textarea from "../components/ui/textarea";
import Input from "../components/ui/input";
import RefundStatusPanel from "../features/resolution/RefundStatusPanel";
import DisputePanel from "../features/resolution/DisputePanel";
import {
  resolutionCommandSchema,
  type ResolutionCommand,
  type resolutionViewSchema,
} from "./resolution-model";
import { uploadResolutionFile, downloadResolutionFile } from "./resolution-api";
import type { FinalAsset } from "./final-model";

function priorCommand(
  view: z.infer<typeof resolutionViewSchema>,
  id: string | undefined,
) {
  const saved = view.state.commands.find((c) => c.id === id);
  if (!saved) return undefined;
  try {
    const raw: unknown = JSON.parse(saved.fingerprint);
    const parsed = resolutionCommandSchema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
export default function ResolutionWorkflowMock({
  view,
  disabled,
  hideRecords,
  run,
  refresh,
}: {
  view: z.infer<typeof resolutionViewSchema>;
  disabled: boolean;
  hideRecords: boolean;
  run: (cmd: ResolutionCommand) => void;
  refresh: () => Promise<void>;
}) {
  const { user } = useSession();
  const [files, setFiles] = useState<File[]>([]);
  const [prepared, setPrepared] = useState<FinalAsset[]>([]);
  const [description, setDescription] = useState("");
  const [none, setNone] = useState(false);
  const [received, setReceived] = useState(false);
  const [fileError, setFileError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const upload = useMutation({
    mutationFn: async () => {
      const epoch = session.epoch();
      if (!files.length || files.length > 20)
        throw new Error("파일을 확인해 주세요.");
      const result = await Promise.all(
        files.map((f) => uploadResolutionFile(view.contractId, f)),
      );
      if (epoch === session.epoch()) setPrepared(result);
    },
  });
  const { workflow } = view.state;
  const latest = view.state.versions.at(-1);
  const agreed = latest?.confirmations.length === 2;
  const busy = disabled || upload.isPending || downloading;
  const base = { id: crypto.randomUUID(), revision: view.state.revision };
  const download = async (file: FinalAsset) => {
    if (busy) return;
    setDownloading(true);
    setFileError("");
    const epoch = session.epoch();
    try {
      const blob = await downloadResolutionFile(view.contractId, file);
      if (epoch !== session.epoch()) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      if (epoch === session.epoch())
        setFileError("파일을 내려받지 못했어요. 수령은 기록하지 않았어요.");
    } finally {
      if (epoch === session.epoch()) setDownloading(false);
    }
  };
  return (
    <div className="grid min-w-0 gap-4">
      {!hideRecords && (
        <RefundStatusPanel
          view={view}
          disabled={busy}
          onRefund={() => {
            if (!latest || !view.orderId) return;
            const record = workflow.refunds.at(-1);
            const prior =
              record && ["UNKNOWN", "PROCESSING"].includes(record.status)
                ? priorCommand(view, record.id)
                : undefined;
            run(
              prior?.type === "refund"
                ? prior
                : {
                    ...base,
                    type: "refund",
                    versionId: latest.id,
                    orderId: view.orderId,
                  },
            );
          }}
          onSettle={() => {
            if (!latest) return;
            const prior =
              workflow.settlement &&
              ["UNKNOWN", "PROCESSING"].includes(workflow.settlement.status)
                ? priorCommand(view, workflow.settlement.id)
                : undefined;
            run(
              prior?.type === "settle"
                ? prior
                : { ...base, type: "settle", versionId: latest.id },
            );
          }}
        />
      )}
      {agreed && latest && (
        <section
          className="grid min-w-0 gap-3 rounded-xl border p-4"
          aria-label="취소 합의 파일 인도"
        >
          <h2 className="type-heading-sm">합의 파일 인도·수령</h2>
          <p>
            이 취소 버전의 파일·원본·미완성·사용권 조건에 맞는 파일을 별도로
            인도해요. 다운로드만으로 수령 처리하지 않아요. 파일 제한은 D17 확정
            전 개발 예시예요.
          </p>
          {!hideRecords && workflow.handover && (
            <div className="grid gap-2" aria-label="인도된 합의 파일">
              <p>
                버전 {workflow.handover.versionId} ·{" "}
                {workflow.handover.description}
              </p>
              {!workflow.handover.files.length && (
                <p>
                  인도 파일 없음으로 제시됨 · 합의 내용과 일치하는지 확인 필요
                </p>
              )}
              {workflow.handover.files.map((file) => (
                <Button
                  key={file.id}
                  variant="outline"
                  disabled={busy}
                  onClick={() => download(file)}
                >
                  {file.name} 합의 파일 다운로드
                </Button>
              ))}
              <p>
                {workflow.receipt
                  ? "취소 합의 파일 전용 수령 기록 있음"
                  : "합의 파일 수령 미확인"}
              </p>
              {user?.role === "CLIENT" && !workflow.receipt && (
                <>
                  <label htmlFor="cancel-receipt" className="flex gap-2">
                    <input
                      id="cancel-receipt"
                      type="checkbox"
                      checked={received}
                      disabled={busy}
                      onChange={(e) => setReceived(e.target.checked)}
                    />
                    실제 인도 파일·미인도 항목·원본·사용권이 취소 합의와
                    일치해요
                  </label>
                  <Button
                    disabled={busy || !received}
                    onClick={() =>
                      run({
                        ...base,
                        type: "receive",
                        versionId: latest.id,
                        handoverId: workflow.handover?.id ?? "",
                        consent: true,
                      })
                    }
                  >
                    취소 합의 파일 수령 확인 (Mock)
                  </Button>
                </>
              )}
            </div>
          )}
          {user?.role === "CREATOR" && !workflow.receipt && (
            <div className="grid min-w-0 gap-3">
              <Label htmlFor="cancel-files">
                취소 합의 인도 파일 (MP4/WebM/ZIP·개발 예시 파일당 300MiB/20개)
              </Label>
              <Input
                id="cancel-files"
                type="file"
                multiple
                accept=".mp4,.webm,.zip"
                disabled={busy}
                onChange={(e) => {
                  setFiles(Array.from(e.target.files ?? []));
                  setPrepared([]);
                }}
              />
              <Button
                variant="outline"
                disabled={busy || !files.length}
                onClick={() => upload.mutate()}
              >
                취소 합의 파일 준비 (Mock)
              </Button>
              {upload.error && (
                <p role="alert">
                  파일 준비 실패 · 종류·크기·권한을 확인해 주세요.
                </p>
              )}
              <p aria-label="준비한 취소 파일">
                {prepared.map((f) => f.name).join(", ")}
              </p>
              <label htmlFor="cancel-no-files" className="flex gap-2">
                <input
                  id="cancel-no-files"
                  type="checkbox"
                  checked={none}
                  disabled={busy}
                  onChange={(e) => setNone(e.target.checked)}
                />
                파일 없는 인도로 제시해요 (의뢰인이 합의와 일치하는지 별도 확인)
              </label>
              <Label htmlFor="cancel-description">
                취소 합의 파일 인도 설명
              </Label>
              <Textarea
                id="cancel-description"
                value={description}
                maxLength={2000}
                disabled={busy}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button
                disabled={
                  busy || !description.trim() || (!none && !prepared.length)
                }
                onClick={() =>
                  run({
                    ...base,
                    type: "handover",
                    versionId: latest.id,
                    fileIds: none ? [] : prepared.map((f) => f.id),
                    description: description.trim(),
                  })
                }
              >
                취소 합의 파일 정식 인도 (Mock)
              </Button>
            </div>
          )}
          {fileError && <p role="alert">{fileError}</p>}
          <Button variant="outline" disabled={busy} onClick={refresh}>
            파일·환불 결과 재조회
          </Button>
        </section>
      )}
      <DisputePanel
        workflow={workflow}
        disabled={busy}
        hideRecords={hideRecords}
        onSubmit={(reason, evidence) =>
          run({ ...base, type: "dispute", reason, evidence })
        }
      />
    </div>
  );
}
