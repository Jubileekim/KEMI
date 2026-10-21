import type { SocialCallbackError } from "@kemi/shared";

// 소셜 로그인 콜백 실패. 라우터는 이 사유를 붙여 프론트엔드로 돌려보낸다(JSON 오류가 아님).
export default class SocialCallbackFailure extends Error {
  constructor(readonly reason: SocialCallbackError) {
    super(reason);
    this.name = "SocialCallbackFailure";
  }
}
