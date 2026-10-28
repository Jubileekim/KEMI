import { describe, expect, it } from "vitest";
import feedMediaMode, {
  MEDIA_REFRESH_GAP_MS,
  shouldRefreshMedia,
} from "../src/features/portfolio/feed-media";

const url = { url: "https://storage.test/signed" };

describe("피드 카드 영상 자동재생", () => {
  it("영상 주소가 있으면 영상을 재생한다", () => {
    expect(feedMediaMode({ video: url, thumbnail: url }, false)).toBe("video");
    expect(feedMediaMode({ video: url, thumbnail: null }, false)).toBe("video");
  });
  it("움직임 줄이기·재생 실패면 대표 이미지로 돌아간다", () => {
    expect(feedMediaMode({ video: url, thumbnail: url }, true)).toBe("image");
  });
  it("영상이 없으면 대표 이미지, 둘 다 없으면 빈 자리", () => {
    expect(feedMediaMode({ video: null, thumbnail: url }, false)).toBe("image");
    expect(feedMediaMode({ video: null, thumbnail: null }, false)).toBe(
      "empty",
    );
    expect(feedMediaMode(undefined, false)).toBe("empty");
  });
});

describe("만료된 영상 주소 갱신", () => {
  it("받은 지 1분이 지난 주소가 끊기면 새 주소를 받는다", () => {
    expect(shouldRefreshMedia(0, 10 * 60_000)).toBe(true);
    expect(shouldRefreshMedia(0, MEDIA_REFRESH_GAP_MS)).toBe(true);
  });
  it("방금 받은 주소도 실패하면 갱신을 반복하지 않는다", () => {
    expect(shouldRefreshMedia(0, MEDIA_REFRESH_GAP_MS - 1)).toBe(false);
  });
});
