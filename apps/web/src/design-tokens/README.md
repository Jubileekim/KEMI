# KEMI 자산 출처

2026-10-23 제공 키트 `KEMI-Design-System/KEMI-Design-System` 버전 1.1.0에서 복사했다.

| 앱 파일                           | 원본 키트 상대 경로            |
| --------------------------------- | ------------------------------ |
| `src/design-tokens/tokens.json`   | `tokens/tokens.json`           |
| `src/design-tokens/tokens.css`    | `tokens/tokens.css`            |
| `public/brand/logo-primary.svg`   | `brand/svg/logo-primary.svg`   |
| `public/brand/symbol-primary.svg` | `brand/svg/symbol-primary.svg` |

JSON은 키트의 수정 원본이며 CSS는 키트의 생성본이다. 이 복사본은 직접 수정하지 않고 원본 변경 검토 후 함께 갱신한다. 0-B에서 `src/styles/kemi-theme.css`에 Tailwind/shadcn 의미 토큰 매핑을 적용했다. 가이드 앱 전용 CSS·컴포넌트는 복사하지 않았다. Pretendard 파일은 제공 자산에 없어 현재 시스템 대체 글꼴을 사용하며 웹폰트 공급 방식은 후속 확인 사항이다.

0-B 추가: 키트의 `brand/svg/`와 `brand/icons/` 전체를 각각 `public/brand/svg/`, `public/brand/icons/`로 바이트 그대로 복사했다. 기존 0-A의 두 SVG 경로는 호환용으로 보존한다. 로고와 아이콘은 재색칠하지 않았다. 앱의 파비콘·홈 아이콘·매니페스트는 원본 파일을 참조한다.
