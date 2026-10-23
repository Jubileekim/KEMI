import { useRef, useState } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { formatDuration } from "./format";
import { Icon } from "./Icon";

export type PlayerState = "ready" | "playing" | "buffering" | "error";

export interface VideoPreviewPlayerProps {
  src?: string;
  posterUrl?: string;
  /** 메타데이터를 읽기 전 표시할 길이 */
  durationSeconds: number;
  /** 구매 전 미리보기에는 워터마크를 넣는다. false면 숨김 */
  watermark?: string | false;
  /** WebVTT. 지정하면 자막 토글이 생긴다 */
  captionsSrc?: string;
  captionsLang?: string;
  /** 문서·스토리에서 특정 상태를 고정해 보여줄 때만 사용 */
  forcedState?: PlayerState;
  onRetry?: () => void;
  className?: string;
}

/** 글래스는 이 컴포넌트의 컨트롤 바에만 쓴다. 자동재생은 소리 없이, reduced-motion이면 끈다(호출부 책임). */
export function VideoPreviewPlayer(props: VideoPreviewPlayerProps) {
  const { src, posterUrl, durationSeconds, watermark = "PREVIEW", captionsSrc, captionsLang = "ko", forcedState, onRetry, className } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>("ready");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [captions, setCaptions] = useState(false);
  const shown = forcedState ?? state;
  const playing = shown === "playing" || shown === "buffering";

  const toggle = () => {
    const v = videoRef.current;
    if (!v || forcedState) return;
    if (v.paused) v.play().catch(() => setState("error"));
    else v.pause();
  };
  const toggleCaptions = () => {
    const track = videoRef.current?.textTracks[0];
    if (track) track.mode = captions ? "hidden" : "showing";
    setCaptions(!captions);
  };
  const retry = () => {
    setState("ready");
    videoRef.current?.load();
    onRetry?.();
  };

  return (
    <div className={cx("player", className)} data-state={shown}>
      <video ref={videoRef} className="player__video" src={src} poster={posterUrl} playsInline preload="metadata"
        onPlaying={() => setState("playing")} onPause={() => setState("ready")} onEnded={() => setState("ready")}
        onWaiting={() => setState("buffering")} onError={() => setState("error")}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}>
        {captionsSrc && <track kind="captions" src={captionsSrc} srcLang={captionsLang} label="자막" />}
      </video>
      {watermark && <div className="player__watermark" aria-hidden="true">{watermark}</div>}
      {shown === "buffering" && <div className="player__buffering" role="status"><span className="sr-only">불러오는 중</span></div>}
      <div className="player__controls">
        <button type="button" className="player__btn" aria-label={playing ? "일시정지" : "재생"} onClick={toggle}>
          <Icon name={playing ? "pause" : "play"} size={14} />
        </button>
        <div className="player__progress" role="progressbar" aria-label="재생 위치" aria-valuemin={0} aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)} aria-valuetext={`${formatDuration(time)} / ${formatDuration(duration)}`}>
          <span style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
        </div>
        <span className="player__time">{formatDuration(time)} / {formatDuration(duration)}</span>
        {captionsSrc && (
          <button type="button" className="player__btn" aria-label="자막" aria-pressed={captions} onClick={toggleCaptions}>
            <Icon name="captions" size={16} />
          </button>
        )}
      </div>
      {shown === "error" && (
        <div className="player__error" role="alert">
          <span>영상을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.</span>
          <Button variant="secondary" size="sm" onClick={retry}>다시 시도</Button>
        </div>
      )}
    </div>
  );
}
