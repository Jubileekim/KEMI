# KEMI Design System · 통합 전달본

Primary Color: **Leaf Green #539863** / 일반 주요 행동: **Leaf 700 #367345**.

## 먼저 보기

압축을 푼 후 **KEMI_Design_System.html**을 열면 설치 없이 기준 가이드를 볼 수 있습니다. 포함된 로고와 시각 자료는 내장되어 있습니다. Pretendard 온라인 글꼴은 연결되지 않으면 시스템 글꼴로 대체됩니다.

## React 예시 실행

Node.js 22.12 이상을 준비하고 이 폴더에서 실행합니다. 설치에는 인터넷 또는 해당 패키지가 있는 로컬 캐시가 필요합니다.

```sh
npm ci
npm run dev
```

검사·배포용 미리보기:

```sh
npm run check:tokens
npm run build
npm run preview
```

## 기존 React 프로젝트에서 쓰기

1. src/components, src/tokens, src/styles를 대상의 src/kemi 아래에 함께 복사합니다. 디렉터리 관계를 유지하세요.
2. 앱 진입점에서 import './kemi/styles/index.css'를 한 번 불러옵니다.
3. import { Button } from './kemi/components'처럼 사용합니다. React·React DOM이 필요하며 CSS는 전역 스타일이므로 기존 .btn/.input 등의 클래스와 변수 충돌을 확인하세요.
4. brand 폴더를 대상 public/brand로 복사합니다. 로고·파비콘의 경로는 실제 배포 경로에 맞춥니다.
5. 공통 UI와 영상·거래 도메인 UI를 구분하고 필요한 컴포넌트만 사용합니다. 영상 UI 예시를 문의·상담 정책으로 복제하지 않습니다.

## 파일과 기준 원본

- tokens/tokens.json: 유일한 토큰 수정 원본. source/typography.json: 11개 글자 역할.
- source/guidelines.html, revision.css, demo.js: 기준 HTML 수정 원본.
- source/design-system-1.1.base.html: 변경 전 1.1 기준 보존본.
- src/components: React 컴포넌트. src/index.ts: 전체 소스 내보내기.
- src/tokens: 생성된 앱용 토큰 복사본. 직접 수정하지 않습니다.
- brand: 브랜드 자산 원본. public/brand: 앱용 복사본.
- reference/KEMI_Design_System_1.1.html, KEMI_Design_System.html, public/KEMI_Design_System.html: 같은 기준 가이드의 생성본.
- GUIDE.md, DEVELOPMENT_BRIEF.md: 다른 프로젝트 적용 가이드. 프리랜서 전환 내용은 참고입니다.

토큰·가이드를 수정한 후 npm run generate로 생성본을 갱신합니다. 브랜드 자산 수정 후에는 brand를 public/brand에도 복사합니다. 빌드는 React 가이드 앱용이며 배포용 컴포넌트 라이브러리 패키지 빌드가 아닙니다. 다른 앱에는 위의 소스 복사 방식을 사용하세요.

다크 모드는 확장안입니다. 현재 서비스 대표 흐름은 작품 탐색 → 저장·문의 선택 → 문의 → 상담 → 종료입니다. 구매·결제·계약·정산·납품 예시는 참고입니다.

2026-10-23 · 두 원본 폴더를 보존하고 별도 전달 폴더로 통합했습니다. node_modules·환경 변수·제품 기획 PDF는 포함하지 않습니다.
