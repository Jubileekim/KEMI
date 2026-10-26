-- 기능명세서 APPLY-02·03, CAMP-06 (단계 2): 협의 요청은 선정이 아니다. 철회·무선정 종료 추가.
-- 선정은 양측 서명으로 일어난다(20261026090000_terms_contracts).

-- 미선정 사유에 무선정 종료(NO_SELECTION)를 추가한다.
ALTER TABLE "work_requests" DROP CONSTRAINT "work_requests_closed_reason_check";
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_closed_reason_check" CHECK ("closed_reason" IS NULL OR "closed_reason" IN ('OTHER_SELECTED', 'PROJECT_DELETED', 'NO_SELECTION'));

-- 알림 종류: '선정됨'(APPLICATION_ACCEPTED)을 '협의 요청'(DISCUSSION_REQUESTED)으로 바꾸고, 철회·무선정 종료를 추가한다.
-- 이미 저장된 알림이 있으면 새 이름으로 옮긴다(제약을 다시 만들기 전에).
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_event_type_check";
UPDATE "notifications" SET "event_type" = 'DISCUSSION_REQUESTED' WHERE "event_type" = 'APPLICATION_ACCEPTED';
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check" CHECK ("event_type" IN ('APPLICATION_SUBMITTED', 'DISCUSSION_REQUESTED', 'APPLICATION_AUTO_REJECTED', 'APPLICATION_DECLINED', 'PROJECT_CLOSED', 'APPLICATION_WITHDRAWN', 'PROJECT_ENDED_NO_SELECTION', 'TERMS_SIGNING_REQUESTED', 'CONTRACT_SIGNED', 'PAYMENT_SUCCEEDED'));
