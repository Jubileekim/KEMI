# 다른 개발자·AI에게 전달할 지침

다음 내용을 새 서비스 기획서와 함께 전달하세요.

---

KEMI 브랜드를 사용하는 프리랜서 플랫폼을 개발한다. 첨부한 KEMI-Design-System의 GUIDE.md와 tokens, brand를 디자인 기준으로 사용한다.

1. 이름은 KEMI, 로고는 brand/svg의 기존 에셋을 그대로 사용한다. 로고를 새로 그리거나 UI 팔레트로 재색칠하지 않는다.
2. 색상·타이포그래피·간격·라운드·모션은 tokens/tokens.css에서 가져온다. --surface-base, --text-primary 같은 의미 토큰을 우선 사용한다. 기존 프로젝트 CSS 변수와 충돌하면 대상 범위로 제한한다.
3. Primary Color는 Leaf Green #539863이다. 일반 주요 버튼에는 --action-primary(#367345)와 --button-primary-text(흰색)를 사용한다. hover·pressed 토큰을 연결한다. 홈·홍보 CTA에만 --gradient-cta와 --button-marketing-text(#0F3D2E)를 사용한다. 로고는 재색칠하지 않는다.
4. brand 폴더를 public/brand로 복사하고 svg·icons 구조를 유지한다. 파비콘·홈 화면 아이콘·매니페스트를 연결한다. 실제 서비스가 하위 경로에 배포되면 URL을 그 경로에 맞춘다.
5. 기존 reference/KEMI_Design_System_1.1.html은 시각 참고 자료다. 영상 구매·라이선스 선택·권리 고지 흐름을 새 플랫폼 요구사항으로 간주하지 않는다.
6. 전문가 카드·프로젝트 카드·검색·상세·협업 상태는 새 서비스 기획서에 따라 구현한다. GUIDE의 화면 구성은 제안이며 확정된 기능 범위가 아니다.
7. 입력·필터·계약·결제·긴 본문은 단색 표면을 쓴다. Liquid Glass는 작은 포인트로 제한한다.
8. 로딩·오류·빈 결과·포커스·비활성·처리 중 상태를 구현한다. 문의·저장·제안 완료는 실제 동작과 일치하게 표시한다.
9. 금액·기간·평점·수수료·정산·권리·계약 정책은 기획서와 실제 데이터로 결정한다. 미정인 항목은 미정으로 표시하고 임의로 기능을 확정하지 않는다.
10. 기본·모바일 화면과 키보드 탐색을 확인한다. 다크 모드는 기존 보완안이므로 적용 여부를 기획에 맞춰 정한다.

## HTML 연결 예시

brand를 공개 경로 /brand에 복사한 경우다. CSS 로딩 경로는 사용하는 빌드 도구에 맞춰 설정한다.

```html
<link rel="icon" href="/brand/icons/favicon.ico" sizes="any">
<link rel="icon" href="/brand/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/brand/icons/apple-touch-icon.png">
<link rel="manifest" href="/brand/icons/site.webmanifest">
<a href="/" aria-label="KEMI 홈">
  <img src="/brand/svg/logo-primary.svg" alt="KEMI" width="170" style="height:auto">
</a>
```

## CSS 연결 후 사용 예시

```css
.project-card {
  color: var(--text-primary);
  background: var(--surface-raised);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  padding: var(--space-6);
}
.primary-cta {
  color: var(--button-primary-text);
  background: var(--action-primary);
  border: 0;
  border-radius: var(--radius-button);
  padding: var(--space-3) var(--space-6);
  font: inherit;
}
.primary-cta:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
```

이 코드는 연결 방식 예시이며 완성된 버튼 컴포넌트가 아니다. 실제 버튼의 비활성·처리 중·오류 동작은 대상 서비스에서 구현한다.
