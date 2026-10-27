import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { session } from "../app/session";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Textarea from "../components/ui/textarea";
import Label from "../components/ui/label";
import FinalReceiptPanel from "../features/production/FinalReceiptPanel";
import { downloadFinal, uploadFinal } from "./delivery-api";
import {
  finalAssetSchema,
  fileRoleLabels,
  type FinalFile,
  type FinalCommand,
} from "./final-model";
import type { DeliveryState } from "./delivery-model";

export default function FinalPanelMock({
  contractId,
  state,
  creator,
  terms,
  disabled,
  submit,
}: {
  contractId: string;
  state: DeliveryState;
  creator: boolean;
  terms: string;
  disabled: boolean;
  submit: (cmd: FinalCommand) => void;
}) {
  const [params] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<FinalFile[]>([]);
  const [role, setRole] = useState<FinalFile["role"]>("FINAL");
  const [description, setDescription] = useState("");
  const [clean, setClean] = useState(false);
  const [contract, setContract] = useState(false);
  const [notice, setNotice] = useState("");
  const upload = useMutation({
    mutationFn: (value: File) => uploadFinal(contractId, value),
  });
  const download = useMutation({
    mutationFn: (value: FinalFile) => downloadFinal(contractId, value.asset),
  });
  const { final } = state;
  const busy = disabled || upload.isPending || download.isPending;
  const selected = params.get("final");
  const wrong = Boolean(selected && selected !== final.delivery?.id);
  const addFile = () => {
    if (!file) return;
    if (
      !finalAssetSchema.safeParse({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mime: file.type,
      }).success
    ) {
      setNotice("Mock 지원 형식·빈 파일·크기를 확인해 주세요.");
      return;
    }
    const epoch = session.epoch();
    upload.mutate(file, {
      onSuccess: (asset) => {
        if (epoch !== session.epoch()) return;
        setFiles((previous) => [
          ...previous,
          { asset, role, description: description.trim() },
        ]);
        setFile(null);
        setDescription("");
        setClean(false);
        setContract(false);
        setNotice("최종 파일 준비 완료 · 아직 전달되지 않았어요.");
      },
    });
  };
  return (
    <section
      className="grid min-w-0 gap-4 rounded-xl border p-4 [&_button]:h-auto [&_button]:whitespace-normal [&_button]:py-2"
      aria-label="최종 파일 전달"
    >
      <h2 className="type-heading-md">최종 파일 전달·수령</h2>
      <p className="whitespace-pre-wrap">
        서명한 계약 파일 조건 원문: {terms || "계약 조건 확인 필요"}
      </p>
      <p>
        개발용 Mock · 실제 저장·워터마크/악성 파일/ZIP 검사 미연결.
        원본·프로젝트는 합의한 경우에만 제공해요.
      </p>
      {!final.approval && (
        <p>검토 승인 후 깨끗한 최종 파일을 준비할 수 있어요.</p>
      )}
      {final.approval && (
        <Link
          to={`?version=${final.approval.versionId}${final.delivery ? `&final=${final.delivery.id}` : ""}`}
        >
          승인된 검토 버전 보기
        </Link>
      )}
      {wrong && (
        <p role="alert">
          지정한 최종 전달을 찾을 수 없어요. 다른 전달로 바꾸지 않아요.
        </p>
      )}
      {creator && final.approval && !final.delivery && (
        <>
          <p>
            개발 입력 예시: MP4/WebM/ZIP, 파일당300MiB, 최대20개. D17 실제
            제한은 미결정이에요.
          </p>
          <Label htmlFor="final-file">최종 전달 파일</Label>
          <Input
            key={files.length}
            id="final-file"
            type="file"
            accept="video/mp4,video/webm,.zip"
            disabled={busy || files.length >= 20}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              upload.reset();
            }}
          />
          <Label htmlFor="final-role">계약 파일 종류</Label>
          <select
            id="final-role"
            className="w-full rounded-xl border p-3"
            value={role}
            disabled={busy}
            onChange={(e) => {
              const { value } = e.target;
              if (
                value === "FINAL" ||
                value === "SOURCE" ||
                value === "PROJECT" ||
                value === "WORKING"
              )
                setRole(value);
            }}
          >
            {Object.entries(fileRoleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Label htmlFor="final-description">파일별 설명</Label>
          <Textarea
            id="final-description"
            value={description}
            maxLength={2000}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={
              busy || !file || !description.trim() || files.length >= 20
            }
            onClick={addFile}
          >
            최종 파일 준비 (Mock 업로드)
          </Button>
          {upload.isPending && <p role="status">최종 파일 준비 중…</p>}
          {upload.error && (
            <p role="alert">
              파일 준비 실패 · 입력을 유지했어요. 전달 안내는 생성하지 않았어요.
            </p>
          )}
          <ol aria-label="준비한 최종 파일" className="grid gap-3">
            {files.map((value) => (
              <li key={value.asset.id} className="min-w-0 break-words">
                <p>
                  {fileRoleLabels[value.role]} · {value.asset.name} ·{" "}
                  {value.asset.size} bytes · {value.description}
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setFiles(
                      files.filter((f) => f.asset.id !== value.asset.id),
                    );
                    setContract(false);
                    setClean(false);
                  }}
                >
                  준비 목록에서 {value.asset.name} 제외
                </Button>
              </li>
            ))}
          </ol>
          <Label>
            <input
              type="checkbox"
              checked={clean}
              disabled={busy}
              onChange={(e) => setClean(e.target.checked)}
            />
            승인 버전과 일치하는 워터마크 없는 최종 파일을 준비했어요
          </Label>
          <Label>
            <input
              type="checkbox"
              checked={contract}
              disabled={busy}
              onChange={(e) => setContract(e.target.checked)}
            />
            규격·수량과 합의한 원본 등 계약 파일을 모두 준비했어요
          </Label>
          <Button
            disabled={
              busy ||
              !clean ||
              !contract ||
              !files.some((f) => f.role === "FINAL")
            }
            onClick={() => {
              if (final.approval)
                submit({
                  type: "deliver-final",
                  id: crypto.randomUUID(),
                  revision: state.revision,
                  versionId: final.approval.versionId,
                  files,
                  cleanConfirmed: true,
                  contractConfirmed: true,
                });
            }}
          >
            계약 최종 파일 정식 전달 (Mock)
          </Button>
        </>
      )}
      {!wrong && final.delivery && (
        <>
          <p>
            최종 전달 {final.delivery.id} · 승인 v
            {
              state.versions.find((v) => v.id === final.delivery?.versionId)
                ?.number
            }{" "}
            · {final.delivery.actorId} · {final.delivery.at}
          </p>
          <ol className="grid gap-3" aria-label="전달된 최종 파일">
            {final.delivery.files.map((value) => (
              <li
                key={value.asset.id}
                className="grid min-w-0 gap-2 rounded-xl bg-muted p-3"
              >
                <p>
                  {fileRoleLabels[value.role]} · {value.asset.name} ·{" "}
                  {value.asset.size} bytes
                </p>
                <p className="whitespace-pre-wrap">{value.description}</p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const epoch = session.epoch();
                    setNotice("");
                    download.mutate(value, {
                      onSuccess: (blob) => {
                        if (epoch !== session.epoch()) return;
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement("a");
                        anchor.href = url;
                        anchor.download = value.asset.name;
                        anchor.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        setNotice(
                          "파일 다운로드 요청 완료 · 수령 확인·정산은 변경하지 않았어요.",
                        );
                      },
                    });
                  }}
                >
                  {value.asset.name} 다운로드
                </Button>
              </li>
            ))}
          </ol>
          {download.error && (
            <p role="alert">
              다운로드 실패 · 접근 상태를 확인한 뒤 다시 시도해 주세요.
            </p>
          )}
          <FinalReceiptPanel
            state={state}
            creator={creator}
            disabled={busy}
            submit={submit}
          />
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
