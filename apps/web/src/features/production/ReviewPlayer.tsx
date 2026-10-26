import { useEffect, useRef, useState } from "react";
import Button from "../../components/ui/button";

export default function ReviewPlayer({
  blob,
  name,
}: {
  blob: Blob;
  name: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const local = URL.createObjectURL(blob);
    const element = video.current;
    if (element) element.src = local;
    return () => {
      if (element) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
      URL.revokeObjectURL(local);
    };
  }, [blob]);
  return (
    <section className="grid min-w-0 gap-3" aria-label="검토 영상 플레이어">
      <p>{name} · 검토 전용 · 다운로드 버튼 없음</p>
      <video
        ref={video}
        className="aspect-video w-full rounded-xl bg-muted"
        controls
        controlsList="nodownload"
        playsInline
        preload="metadata"
        aria-label={`검토 영상 ${name}`}
        onError={() => setFailed(true)}
      >
        <track kind="captions" />
      </video>
      {failed && (
        <p role="alert">
          영상을 재생하지 못했어요. 지원 코덱과 파일 손상을 확인해 주세요.
        </p>
      )}
      {failed && (
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            video.current?.load();
          }}
        >
          영상 재생 재시도
        </Button>
      )}
      <p className="type-body-sm text-muted-foreground">
        자막 파일 연결은 준비 중이에요. 녹화·복제의 완전 차단을 보장하지 않아요.
      </p>
    </section>
  );
}
