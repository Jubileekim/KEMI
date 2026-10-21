# 프로필 선택지 공유 (프론트엔드용)

- 대상: 프로필 작성·수정 화면 (PROFILE-01 의뢰인, PROFILE-02 크리에이터)
- API: `GET /api/profiles/me`, `PATCH /api/profiles/me` (PR #13). 응답·요청 형식은 Swagger(`/api/docs`)에서 확인할 수 있다.
- 상태: **임시 값이다.** 분야와 콘텐츠 스타일은 D21이 정해지지 않아 ERD v0.5 값을 쓴다. 값이 바뀌면 이 문서와 `@kemi/shared`를 함께 고친다.
- 근거: [결정 기록](../decisions/2026-10-19-backend-setup.md) 10장

## 값 가져오기

선택지 목록을 화면 코드에 다시 적지 말고 `@kemi/shared`에서 가져온다. 서버 검증과 DB CHECK가 같은 배열을 쓰므로 값이 바뀌어도 한 곳만 고치면 된다.

```ts
import {
  CONTENT_STYLES, // 콘텐츠 스타일
  PRODUCT_CATEGORIES, // 제품 분야 (의뢰인 industry, 크리에이터 niche)
  PRODUCTION_ROLES, // 제작 역할
  type ContentStyle,
  type ProductCategory,
  type ProductionRole,
} from "@kemi/shared";
```

- API에는 아래 **값**(영문 대문자)을 보내고 받는다. 화면에는 **표시 이름**을 보여준다.
- 표시 이름은 서버가 내려주지 않는다. 화면에서 값 → 표시 이름 표를 둔다.

## 제품 분야 [임시 · D21]

의뢰인의 `industry`(제품 분야), 크리에이터의 `niche`(주 분야)에 쓴다. 하나만 고른다. 선택 안 함은 `null`이다.

| 값          | 표시 이름 [제안] |
| ----------- | ---------------- |
| `BEAUTY`    | 뷰티             |
| `FOOD`      | 식품             |
| `LIFESTYLE` | 라이프스타일     |
| `TECH`      | 테크·가전        |
| `OTHER`     | 기타             |

## 콘텐츠 스타일 [임시 · D21]

크리에이터의 `contentStyles`. 여러 개를 고를 수 있다. 같은 값을 두 번 넣으면 400이다. 아무것도 고르지 않으면 `[]`다.

| 값             | 표시 이름 [제안] |
| -------------- | ---------------- |
| `MODERN`       | 모던             |
| `BRIGHT`       | 밝고 경쾌한      |
| `EMOTIONAL`    | 감성적인         |
| `PROFESSIONAL` | 전문적인         |
| `OTHER`        | 기타             |

## 제작 역할

크리에이터의 `productionRoles`. 여러 개를 고를 수 있다. 규칙은 콘텐츠 스타일과 같다. 표시 이름은 PRD 6.2·7.4(기획·출연·촬영·편집)를 따른다.

| 값          | 표시 이름 |
| ----------- | --------- |
| `PLANNING`  | 기획      |
| `ON_CAMERA` | 출연      |
| `FILMING`   | 촬영      |
| `EDITING`   | 편집      |

## 제작 서비스 상태 (읽기 전용)

크리에이터 응답의 `serviceStatus`. 프로필 저장으로는 바뀌지 않으며, 요청에 넣으면 400이다. 공개·비공개 전환(PROFILE-03·04)은 패키지 기능과 함께 만든다.

| 값        | 표시 이름 [제안] |
| --------- | ---------------- |
| `DRAFT`   | 작성 중 (비공개) |
| `PUBLIC`  | 공개             |
| `PRIVATE` | 비공개           |

## 저장 규칙 요약

- 바꾼 항목만 보내면 된다. 보내지 않은 항목은 그대로다.
- 자유 입력 칸(`brandName`, `introduction`, `workMethod`, `websiteUrl`, `socialUrl`)은 빈 문자열을 보내도 된다. 서버가 `null`(입력 안 함)로 저장한다.
- 선택지 하나(`industry`, `niche`)와 날짜(`availableFrom`)를 비울 때는 `null`을 보낸다. 빈 문자열은 400이다.
- 복수 선택은 고른 목록 전체를 보낸다. 비울 때는 `[]`이고, `null`은 400이다.
- `availableFrom`은 `YYYY-MM-DD` 문자열이다.
- 다른 역할의 항목을 보내면 400이다. 예: 크리에이터가 `brandName`을 보내는 경우.
- 400 응답의 `error.details`에 문제가 된 항목의 경로(`path`)와 메시지가 들어 있다.
- 전체 규칙 표는 결정 기록 10장 "PATCH 값 규칙"에 있다.

## 확인 요청

- 표시 이름 [제안] 문구가 화면 기획과 맞는지
- 분야·스타일 목록 자체(D21)는 기획 확정 후 알려주면 백엔드가 shared·DB를 함께 바꾼다
