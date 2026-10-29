import type { QueryClient } from "@tanstack/react-query";

// 계약 이후 변경은 의뢰 목록·상세·활동에도 반영한다.
export default function invalidateRequestProgress(client: QueryClient) {
  return Promise.all(
    ["activity", "direct-requests", "direct-request", "terms"].map((key) =>
      client.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
