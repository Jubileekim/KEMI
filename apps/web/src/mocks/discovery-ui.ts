import { useEffect, useState } from "react";
import { ApiError } from "../shared/api/client";

export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
export function failure(error: unknown) {
  if (error instanceof ApiError && error.status === 404)
    return "공개 공고를 찾을 수 없어요. 비공개 초안은 열람할 수 없어요.";
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return "로그인·본인 권한을 확인해 주세요.";
  if (error instanceof ApiError && error.status === 409)
    return "상태가 변경되었어요. 최신 상태를 확인한 뒤 다시 검토해 주세요.";
  return "응답을 확인하지 못했어요. 최신 상태를 다시 확인해 주세요. 자동으로 재시도하지 않아요.";
}
