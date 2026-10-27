import { describe, expect, it } from "vitest";
import feedMediaMode from "../src/features/portfolio/feed-media";

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
