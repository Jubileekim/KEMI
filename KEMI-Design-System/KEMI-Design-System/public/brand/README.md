# KEMI 웹 로고 에셋 v1

첨부된 `KEMI a.png`의 상단 평면 로고를 바탕으로 만든 웹용 에셋입니다.
시안의 설명 문구, 패널 배경, 유리 질감 예시는 웹 로고에서 제외했습니다.

## 바로 선택하기

| 용도 | 권장 파일 |
|---|---|
| 밝은 배경의 사이트 헤더 | `svg/logo-primary.svg` |
| 어두운 배경의 사이트 헤더 | `svg/logo-on-dark.svg` |
| 진녹색 단색 로고 | `svg/logo-mono-dark.svg` |
| 흰색 단색 로고 | `svg/logo-mono-white.svg` |
| 글자 없는 심볼 | `svg/symbol-primary.svg` |
| 앱·프로필 아이콘 | `svg/app-icon.svg` 또는 `png/app-icon-512.png` |
| 브라우저 탭 아이콘 | `icons/favicon.svg`, `icons/favicon.ico` |
| iOS 홈 화면 | `icons/apple-touch-icon.png` |
| 전체 미리보기 | `preview.png` |

SVG는 글꼴 설치가 필요 없는 도형 경로입니다. 배경은 투명하며, 앱 아이콘에는 진녹색 바탕이 포함되어 있습니다. PNG 폴더에는 가로형 로고 566·1132·2264px, 심볼 및 앱 아이콘 128·256·512·1024px 너비 버전이 있습니다. 심볼은 원본 비율을 유지하므로 높이가 너비와 다릅니다.

## 사이트 적용 예시

`svg`, `icons` 폴더를 사이트의 공개 파일 폴더 안에 `brand`라는 이름으로 복사한 경우:

```html
<a href="/" aria-label="KEMI 홈">
  <img src="/brand/svg/logo-primary.svg" alt="KEMI" width="170" height="54" />
</a>

<link rel="icon" href="/brand/icons/favicon.ico" sizes="any" />
<link rel="icon" href="/brand/icons/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/brand/icons/apple-touch-icon.png" />
<link rel="manifest" href="/brand/icons/site.webmanifest" />
```

로고를 배경 이미지로 사용할 때는 접근 가능한 이름을 별도로 제공합니다. 가로·세로 비율을 고정하고 늘이거나 기울이지 않습니다. 헤더에서는 너비 140–180px, 여백은 심볼 높이의 약 1/4을 시작점으로 권장합니다. 이는 이번 패키지의 사용 제안이며, 확정된 브랜드 규정은 아닙니다.

## 색상

| 역할 | 값 |
|---|---|
| 글자·짙은 배경 | `#173F2E` |
| 녹색 심볼 | `#18C889` |
| 그라데이션 시작 | `#B6F65A` |
| 그라데이션 끝 | `#FFED60` |
| 앱 아이콘 심볼 | `#D8FA55` |

위 값은 첨부 시안을 바탕으로 정리한 제작용 색상입니다. 원본 브랜드 가이드에서 제공된 공식 색상값은 아닙니다.

## 원본과의 관계

- `svg/` 및 그로부터 내보낸 `png/`, `icons/`는 첨부 시안의 형태를 바탕으로 경로를 재구성한 벡터 버전입니다. 원본 제작 파일을 직접 추출한 것이 아니므로 세부 곡선·자간·색상에 미세한 차이가 있습니다.
- `reference/logo-ai-extraction.png`는 이미지 생성 도구로 배경을 제거·재구성한 참고 출력입니다. 실제 사이트 적용에는 가장자리가 정돈된 `svg/`와 `png/`를 권장합니다.
- `preview.png`는 밝은 배경, 어두운 배경, 심볼, 아이콘을 비교하는 미리보기입니다. 로고 원본으로 사용하지 않습니다.
- 기존 사이트 파일은 수정하지 않았습니다.

검증: SVG 8종 렌더링, PNG 34개 크기·알파 채널 확인, 밝고 어두운 배경의 미리보기 육안 확인.
