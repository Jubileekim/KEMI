import { useEffect, useState } from "react";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Label from "../../components/ui/label";
import { assetSchema, demoFileLimit, type LocalAsset } from "./local-preview";

// Local-only staging. This component never uploads bytes or grants publication rights.
export default function FileUpload({
  value,
  onChange,
  disabled,
}: {
  value: LocalAsset | null;
  onChange: (value: LocalAsset | null) => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [playable, setPlayable] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <section className="grid gap-3" aria-label="로컬 영상 준비">
      <Label htmlFor="work-file">영상 파일 (로컬 Mock)</Label>
      <Input
        id="work-file"
        type="file"
        accept="video/mp4,video/webm"
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby="work-file-help work-file-error"
        onChange={(event) => {
          setUrl("");
          setError("");
          setFailed(false);
          setPlayable(false);
          onChange(null);
          const file = event.target.files?.[0];
          if (!file) return;
          const parsed = assetSchema.safeParse({
            name: file.name,
            mime: file.type,
            size: file.size,
            ready: false,
          });
          if (!parsed.success) {
            setError(
              `모의 미리보기는 MP4/WebM, 비어 있지 않은 ${demoFileLimit / 1024 / 1024}MiB 이하 파일만 지원해요. 실제 업로드 정책은 미확정이에요.`,
            );
            return;
          }
          setUrl(URL.createObjectURL(file));
          onChange(parsed.data);
        }}
      />
      <p id="work-file-help" className="text-sm text-muted-foreground">
        파일 선택 → 로컬 미리보기 → Mock 업로드 완료 → 작업물 저장 순서예요.
        파일 bytes는 전송하지 않아요.
      </p>
      <p id="work-file-error" role={error ? "alert" : undefined}>
        {error}
      </p>
      {value && (
        <p className="break-words">
          선택 파일: {value.name} ·{" "}
          {value.ready
            ? "모의 업로드 완료 (메타데이터만)"
            : "선택됨 · 업로드 전"}
        </p>
      )}
      {url && !failed && (
        <video
          className="aspect-video w-full rounded-xl bg-foreground"
          src={url}
          controls
          muted
          playsInline
          preload="auto"
          aria-label="선택한 영상 미리보기"
          onCanPlay={() => setPlayable(true)}
          onError={() => {
            setFailed(true);
            setPlayable(false);
            onChange(value ? { ...value, ready: false } : null);
          }}
        />
      )}
      {failed && (
        <p role="alert">
          영상을 재생하지 못했어요. 다른 파일을 선택해 주세요. 공개 저장은
          차단해요.
        </p>
      )}
      {!url && value && (
        <p>
          이전 파일의 메타데이터만 있어요. 재생하려면 이 기기에서 파일을 다시
          선택해 주세요.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={
            disabled || !value || value.ready || failed || !url || !playable
          }
          onClick={() => {
            if (value) onChange({ ...value, ready: true });
          }}
        >
          Mock 업로드 완료 처리
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || !value}
          onClick={() => {
            setUrl("");
            setFailed(false);
            setError("");
            setPlayable(false);
            onChange(null);
          }}
        >
          선택 파일 해제
        </Button>
      </div>
    </section>
  );
}
