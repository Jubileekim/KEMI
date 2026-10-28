import { ERROR_CODES } from "@kemi/shared";

// OpenAPI 문서(openapi.ts)를 사람이 읽는 API 명세서(Markdown)로 바꾼다.
// 명세서는 docs/api-spec.md에 저장하고, test/api-spec.test.ts가 코드와 어긋나지 않는지 확인한다.
// 다시 만들기: npm run docs:api -w @kemi/api

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value: unknown): Json => (isRecord(value) ? value : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const strings = (value: unknown): string[] =>
  list(value).filter((v): v is string => typeof v === "string");

const METHODS = ["get", "post", "put", "patch", "delete"];

const TAG_TITLES: Record<string, string> = {
  health: "상태 확인",
  auth: "인증",
  profiles: "프로필",
  projects: "공개 모집",
  discovery: "모집 탐색·추천",
  applications: "지원·선정",
  notifications: "알림",
  activity: "내 활동",
  safety: "신고·이용 제한",
  analytics: "행동 기록",
  pricing: "AI 가격 제안",
  files: "파일",
  chat: "대화",
  catalog: "패키지·작업물·제작 서비스",
  "project-drafts": "모집 초안",
  direct: "작품 피드·직접 의뢰",
  terms: "조건 확정·서명",
  payments: "결제·정산",
  production: "제작 준비·진행",
  delivery: "납품·수정·승인",
  cancel: "취소·환불·분쟁",
};

// 표 칸 안에서 줄바꿈과 |가 표를 깨지 않게 한다.
const cell = (value: string) =>
  value
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "\\|")
    .trim() || "-";

const schemaAnchor = (name: string) => `schema-${name.toLowerCase()}`;
const opAnchor = (method: string, path: string) =>
  `op-${method}-${path
    .replace(/[{}]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}`;

function refName(schema: Json): string | null {
  const ref = text(schema.$ref);
  return ref ? (ref.split("/").pop() ?? null) : null;
}

// 스키마를 한 줄 타입 표기로 바꾼다. 예: string | null, ServicePackage[], "A" 또는 "B"
function typeOf(value: unknown): string {
  const schema = record(value);
  const ref = refName(schema);
  if (ref) return `[${ref}](#${schemaAnchor(ref)})`;
  const variants = [...list(schema.anyOf), ...list(schema.oneOf)];
  if (variants.length > 0) return variants.map(typeOf).join(" 또는 ");
  if ("const" in schema) return `\`${JSON.stringify(schema.const)}\``;
  const values = list(schema.enum);
  if (values.length > 0)
    return values.map((v) => `\`${String(v)}\``).join(", ");
  const type = Array.isArray(schema.type)
    ? strings(schema.type).join(" 또는 ")
    : text(schema.type);
  if (type === "array") {
    const item = typeOf(schema.items);
    // 선택값 목록·여러 타입의 배열은 괄호로 묶어 어디까지가 배열 원소인지 보이게 한다.
    return item.includes(",") || item.includes(" 또는 ")
      ? `(${item})[]`
      : `${item}[]`;
  }
  const format = text(schema.format);
  if (type) return format ? `${type}(${format})` : type;
  return isRecord(schema.properties) ? "object" : "any";
}

function constraints(value: unknown): string {
  const schema = record(value);
  const rules: [string, string][] = [
    ["minLength", "최소 길이"],
    ["maxLength", "최대 길이"],
    ["minimum", "최소"],
    ["maximum", "최대"],
    ["exclusiveMinimum", "초과"],
    ["exclusiveMaximum", "미만"],
    ["minItems", "최소 개수"],
    ["maxItems", "최대 개수"],
  ];
  const parts = rules
    .filter(([key]) => typeof schema[key] === "number")
    .map(([key, label]) => `${label} ${String(schema[key])}`);
  if (typeof schema.pattern === "string")
    parts.push(`형식 \`${schema.pattern}\``);
  if ("default" in schema)
    parts.push(`기본값 \`${JSON.stringify(schema.default)}\``);
  if (schema.uniqueItems === true) parts.push("중복 불가");
  const nested = [...list(schema.anyOf), ...list(schema.oneOf)]
    .map(constraints)
    .filter(Boolean);
  return [...parts, ...nested].join(", ");
}

interface FieldRow {
  name: string;
  type: string;
  required: boolean;
  rule: string;
  description: string;
}

// 객체 필드를 표 행으로 펼친다. 안쪽 객체(참조가 아닌 것)는 a.b 형태로 한 단계 더 펼친다.
function fieldRows(value: unknown, prefix = "", depth = 0): FieldRow[] {
  const schema = record(value);
  const required = new Set(strings(schema.required));
  return Object.entries(record(schema.properties)).flatMap(([key, prop]) => {
    const p = record(prop);
    const name = `${prefix}${key}`;
    const row: FieldRow = {
      name,
      type: typeOf(p),
      required: required.has(key),
      rule: constraints(p),
      description: text(p.description),
    };
    const inner =
      depth < 2 && !refName(p) && isRecord(p.properties)
        ? fieldRows(p, `${name}.`, depth + 1)
        : [];
    const items = record(p.items);
    const innerItems =
      depth < 2 && !refName(items) && isRecord(items.properties)
        ? fieldRows(items, `${name}[].`, depth + 1)
        : [];
    return [row, ...inner, ...innerItems];
  });
}

function fieldTable(value: unknown): string {
  const rows = fieldRows(value);
  if (rows.length === 0) return `타입: ${typeOf(value)}\n`;
  return [
    "| 필드 | 타입 | 필수 | 제약 | 설명 |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| \`${r.name}\` | ${cell(r.type)} | ${r.required ? "예" : ""} | ${cell(r.rule)} | ${cell(r.description)} |`,
    ),
    "",
  ].join("\n");
}

const jsonSchemaOf = (content: unknown) =>
  record(record(record(content)["application/json"]).schema);

interface Operation {
  method: string;
  path: string;
  tag: string;
  op: Json;
}

function operations(doc: Json): Operation[] {
  return Object.entries(record(doc.paths)).flatMap(([path, item]) =>
    METHODS.filter((m) => isRecord(record(item)[m])).map((method) => {
      const op = record(record(item)[method]);
      return { method, path, tag: strings(op.tags)[0] ?? "기타", op };
    }),
  );
}

const authLabel = (op: Json) =>
  list(op.security).length > 0 ? "로그인 필요" : "없음";

function parameterTable(op: Json): string {
  const params = list(op.parameters).map(record);
  if (params.length === 0) return "";
  const where: Record<string, string> = {
    path: "경로",
    query: "쿼리",
    header: "헤더",
    cookie: "쿠키",
  };
  return [
    "**파라미터**",
    "",
    "| 이름 | 위치 | 필수 | 타입 | 설명 |",
    "| --- | --- | --- | --- | --- |",
    ...params.map((p) => {
      const rule = constraints(p.schema);
      return `| \`${text(p.name)}\` | ${where[text(p.in)] ?? text(p.in)} | ${p.required === true ? "예" : ""} | ${cell(typeOf(p.schema))}${rule ? ` (${cell(rule)})` : ""} | ${cell(text(p.description))} |`;
    }),
    "",
  ].join("\n");
}

function bodySection(op: Json): string {
  const body = record(op.requestBody);
  if (!isRecord(body.content)) return "";
  const jsonBody = record(body.content["application/json"]);
  if (!isRecord(jsonBody.schema)) {
    const types = Object.keys(body.content).join(", ");
    return `**요청 본문** (${types})${text(body.description) ? ` — ${cell(text(body.description))}` : ""}\n\n`;
  }
  return [
    `**요청 본문** (application/json${body.required === true ? ", 필수" : ""})`,
    "",
    fieldTable(jsonBody.schema),
  ].join("\n");
}

function responseSection(op: Json): string {
  const rows = Object.entries(record(op.responses)).map(([status, res]) => {
    const r = record(res);
    const schema = jsonSchemaOf(r.content);
    const type = Object.keys(schema).length > 0 ? typeOf(schema) : "-";
    return `| ${status} | ${cell(text(r.description))} | ${cell(type)} |`;
  });
  return [
    "**응답**",
    "",
    "| 상태 | 설명 | 본문 |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function operationSection({ method, path, op }: Operation): string {
  const description = text(op.description);
  return [
    `<a id="${opAnchor(method, path)}"></a>`,
    "",
    `### ${method.toUpperCase()} \`${path}\``,
    "",
    `**${text(op.summary)}**`,
    "",
    ...(description ? [description, ""] : []),
    `- 인증: ${authLabel(op)}`,
    "",
    parameterTable(op),
    bodySection(op),
    responseSection(op),
  ]
    .filter((part, i, all) => !(part === "" && all[i - 1] === ""))
    .join("\n");
}

export default function openApiToMarkdown(document: unknown): string {
  const doc = record(document);
  const info = record(doc.info);
  const ops = operations(doc);
  const tagOrder = [
    ...list(doc.tags).map((t) => text(record(t).name)),
    ...ops.map((o) => o.tag),
  ].filter((tag, i, all) => tag && all.indexOf(tag) === i);
  const groups = tagOrder
    .map((tag) => ({ tag, ops: ops.filter((o) => o.tag === tag) }))
    .filter((g) => g.ops.length > 0);
  const titleOf = (tag: string) =>
    TAG_TITLES[tag] ? `${TAG_TITLES[tag]} (\`${tag}\`)` : `\`${tag}\``;
  const schemas = Object.entries(record(record(doc.components).schemas));

  const header = [
    `# ${text(info.title)} 명세서`,
    "",
    "> 이 문서는 `apps/api/src/docs/openapi.ts`에서 자동으로 만든다. 직접 고치지 말고 OpenAPI 정의를 고친 뒤",
    "> `npm run docs:api -w @kemi/api`로 다시 만든다. `test/api-spec.test.ts`가 코드와 어긋나면 실패한다.",
    "",
    `- 버전: ${text(info.version)}`,
    `- 엔드포인트: ${ops.length}개 (${groups.length}개 영역)`,
    "- 실시간 문서: 개발 서버에서 `/api/docs`(Swagger UI), `/api/openapi.json`",
    "",
    "## 공통 규칙",
    "",
    `- ${text(info.description)}`,
    "- 기본 주소: 운영 `https://kemi-api.onrender.com`, 로컬 `http://localhost:4000`. 모든 경로는 이 주소 뒤에 붙는다.",
    "- 요청·응답 본문은 JSON(`Content-Type: application/json`)이다. 본문 크기는 1MB까지다.",
    "- 인증: 로그인·가입·갱신 응답의 `accessToken`(15분)을 `Authorization: Bearer <토큰>` 헤더로 보낸다.",
    "  Refresh 토큰은 `kemi_refresh` HttpOnly 쿠키로만 오가며 `POST /api/auth/refresh`로 새 Access 토큰을 받는다.",
    '- 표의 "인증: 로그인 필요"는 Access 토큰이 있어야 한다는 뜻이다. 역할(의뢰인·크리에이터·운영자)·당사자 제한은 각 설명과 403 응답에 적었다.',
    "- 시간은 ISO 8601(UTC) 문자열, 금액은 원 단위 정수다.",
    "- 파일은 서버를 거치지 않는다: `POST /api/files`로 서명 업로드 주소를 받아 Storage에 직접 올린 뒤 `POST /api/files/{fileId}/complete`로 확인한다.",
    "",
    "### 오류 형식",
    "",
    "```json",
    '{ "error": { "code": "VALIDATION_FAILED", "message": "사람이 읽는 설명", "details": [] } }',
    "```",
    "",
    "| 코드 | 주로 쓰는 HTTP 상태 |",
    "| --- | --- |",
    ...ERROR_CODES.map((code) => {
      const status: Record<string, string> = {
        VALIDATION_FAILED: "400",
        INVALID_JSON: "400",
        UNAUTHENTICATED: "401",
        TOKEN_EXPIRED: "401",
        SESSION_REVOKED: "401",
        INVALID_CREDENTIALS: "401",
        EMAIL_ALREADY_EXISTS: "409",
        REFRESH_RACE: "409",
        RATE_LIMITED: "429",
        FORBIDDEN: "403",
        NOT_FOUND: "404",
        CONFLICT: "409",
        SERVICE_UNAVAILABLE: "503 (외부 연동 실패는 502)",
        RESTRICTED: "403 (이용 제한 회원)",
        INTERNAL_ERROR: "500",
      };
      return `| \`${code}\` | ${status[code] ?? "-"} |`;
    }),
    "",
  ];

  const index = [
    "## 엔드포인트 목록",
    "",
    ...groups.flatMap((g) => [
      `### ${titleOf(g.tag)}`,
      "",
      "| 메서드 | 경로 | 설명 | 인증 |",
      "| --- | --- | --- | --- |",
      ...g.ops.map(
        (o) =>
          `| ${o.method.toUpperCase()} | [\`${o.path}\`](#${opAnchor(o.method, o.path)}) | ${cell(text(o.op.summary))} | ${authLabel(o.op)} |`,
      ),
      "",
    ]),
  ];

  const details = [
    "## 엔드포인트 상세",
    "",
    ...groups.flatMap((g) => [
      `## ${titleOf(g.tag)}`,
      "",
      ...g.ops.map(operationSection),
    ]),
  ];

  const types = [
    "## 데이터 형식",
    "",
    "응답 본문과 요청 본문에서 참조하는 형식이다.",
    "",
    ...schemas.flatMap(([name, schema]) => {
      const description = text(record(schema).description);
      return [
        `<a id="${schemaAnchor(name)}"></a>`,
        "",
        `### ${name}`,
        "",
        ...(description ? [description, ""] : []),
        fieldTable(schema),
      ];
    }),
  ];

  return `${[...header, ...index, ...details, ...types]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}
