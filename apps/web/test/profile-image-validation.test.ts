import { expect, it } from "vitest";
import profileImageError from "../src/features/profiles/profile-image-validation";

it("accepts only nonempty supported image files up to 10 MiB", () => {
  expect(profileImageError({ type: "image/png", size: 1024 })).toBeUndefined();
  expect(
    profileImageError({ type: "image/jpeg", size: 10 * 1024 * 1024 }),
  ).toBeUndefined();
});

it("rejects unsupported, empty and oversized image files", () => {
  expect(
    profileImageError({ type: "application/pdf", size: 128 }),
  ).toBeTruthy();
  expect(profileImageError({ type: "image/webp", size: 0 })).toBeTruthy();
  expect(
    profileImageError({ type: "image/png", size: 10 * 1024 * 1024 + 1 }),
  ).toBeTruthy();
});
