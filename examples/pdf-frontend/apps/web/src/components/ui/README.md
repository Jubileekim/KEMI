# KEMI 공통 UI

2026-10-23 공식 [shadcn/ui new-york-v4 레지스트리](https://ui.shadcn.com/r/styles/new-york-v4/button.json)의 Button, Input, Textarea, Select, Checkbox, Badge, Tabs, Dialog, Label, Sonner 소스를 가져왔다. MIT 원문은 `LICENSE.md`. 각 파일은 앱이 소유하는 소스이며 별도 키트 UI를 병행하지 않는다.

- `../../styles/kemi-theme.css`가 원본 KEMI 변수와 Tailwind/shadcn 의미 토큰·상태·형태를 연결한다. 변수 원본은 `../../design-tokens/tokens.css`이며 직접 편집하지 않는다.
- Tailwind 4 Vite 플러그인 사용. 기본 반응형 이름은 sm=600px, lg=1024px만 활성화했다. 키트의 11개 `type-*` 역할과 모바일 축소를 유지한다.
- Button 기본 type은 button. 폼 전송은 `type="submit"`을 명시한다. 처리 중에는 `disabled` + `aria-busy` + 상태 문구를 사용한다. 아이콘은 접근 가능한 이름을 제공한다.
- Radix `asChild`가 data-slot을 덮어쓰는 경우에도 `data-kemi-button`으로 버튼의 라운드·상태가 유지된다. 입력에는 Label과 id를 연결하고 오류 시 aria-invalid, aria-describedby와 오류 문구를 함께 전달한다.
- Dialog는 Radix의 포커스 가두기·Escape·포커스 복귀를 유지한다. Title과 Description을 제공한다. 닫기 이름은 한국어로 변경했다.
- Toast는 공식 권장 Sonner 어댑터. React/Vite 라이트 우선 범위이므로 Next.js의 next-themes는 설치하지 않았다. Toaster는 앱 루트에 한 번만 둔다.
- Button/Badge/Tabs의 내부 variant 팩토리는 공개하지 않아 기존 Fast Refresh 린트 규칙을 유지한다.
- 원본 키트의 브랜드 자산은 `public/brand/svg`, `public/brand/icons`에 그대로 복사했다. 기존 0-A 로고 경로는 호환용으로 보존한다.

`src/app/UiShowcase.tsx`는 제품 기능이 아닌 공통 UI 검증 화면이다. 성공·오류·로딩·재시도는 화면 예시이며 API 호출·저장·Mock 서버가 없다. 이름의 필수 검사는 UI 오류 연결 시연일 뿐 인증·프로필 정책이 아니다.

공식 설치 근거: [Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite), [shadcn 수동 설치](https://ui.shadcn.com/docs/installation/manual), [Sonner](https://ui.shadcn.com/docs/components/radix/sonner). 설정은 `apps/web/components.json`, 경로 별칭은 Vite와 tsconfig.app.json에서 함께 관리한다.
