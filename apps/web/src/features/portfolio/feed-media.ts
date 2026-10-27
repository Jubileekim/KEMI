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
