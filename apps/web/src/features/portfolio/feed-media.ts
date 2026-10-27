// 피드 카드가 영상을 자동재생할지 정한다.
// 영상 주소가 있고, 사용자가 움직임 줄이기를 켜지 않았을 때만 재생한다(소리 없음·반복).
export default function feedMediaMode(
  media: { video: unknown; thumbnail: unknown } | undefined,
  reducedMotion: boolean,
): "video" | "image" | "empty" {
  if (media?.video && !reducedMotion) return "video";
  if (media?.thumbnail) return "image";
  return "empty";
}

// 서명 주소(10분)가 만료돼 재생이 끊기면 새 주소를 받아 다시 재생한다.
// 직전 갱신 후 1분 안에 또 실패하면 만료가 아니라 저장소 문제로 보고 대표 이미지로 돌아간다.
export const MEDIA_REFRESH_GAP_MS = 60_000;
export const shouldRefreshMedia = (lastRefreshAt: number, now: number) =>
  now - lastRefreshAt >= MEDIA_REFRESH_GAP_MS;
