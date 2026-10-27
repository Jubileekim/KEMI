import {
  type AnalyticsEventName,
  analyticsEventSchema,
  ONCE_PER_OBJECT_EVENTS,
} from "@kemi/shared";
import { kemi } from "../api/kemi";
import { session } from "../../app/session";

// 행동 기록 (METRIC-01). 이벤트 이름·공개 대상 ID·시각만 보낸다(개인 입력값 없음).
// 화면 동작을 막지 않도록 모아서 보내고, 실패해도 조용히 버린다(거래 결과에 영향 없음).
// 개발 Mock 모드에서는 보내지 않는다.

const mockMode = import.meta.env.VITE_ENABLE_MOCKS === "true";
const queue: { name: AnalyticsEventName; objectId: string; at: string }[] = [];
const sentOnce = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let epoch = session.epoch();

// 전송을 기다리던 기록을 다음 로그인 계정의 토큰으로 보내지 않는다.
session.subscribe(() => {
  if (epoch === session.epoch()) return;
  epoch = session.epoch();
  queue.length = 0;
  sentOnce.clear();
  clearTimeout(timer);
  timer = undefined;
});

function flush() {
  timer = undefined;
  const events = queue.splice(0, 20);
  if (events.length === 0) return;
  kemi.analytics({ events }).catch(() => undefined);
  if (queue.length > 0) timer = setTimeout(flush, 1000);
}

export default function track(name: AnalyticsEventName, objectId: string) {
  if (mockMode) return false;
  const event = { name, objectId, at: new Date().toISOString() };
  if (!analyticsEventSchema.safeParse(event).success) return false;
  const key = `${name}:${objectId}`;
  if (ONCE_PER_OBJECT_EVENTS.includes(name)) {
    if (sentOnce.has(key)) return false;
    sentOnce.add(key);
  }
  // 분석 서버 장애나 과도한 UI 이벤트가 메모리를 계속 늘리지 않게 한다.
  if (queue.length >= 100) return false;
  queue.push(event);
  timer ??= setTimeout(flush, 1000);
  return true;
}
