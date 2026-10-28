import { z } from "zod";

// 선택 값: 비어 있으면 설정하지 않은 것으로 본다.
const optionalSecret = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z
      .string({ error: "DATABASE_URL이 필요합니다." })
      .regex(
        /^postgres(ql)?:\/\//,
        "DATABASE_URL은 postgresql:// 형식이어야 합니다.",
      ),
    // Supabase 연결 풀러의 동시 연결 한도를 넘지 않도록 서버 한 대가 여는 연결 수를 제한한다.
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    // Access 토큰(JWT HS256) 서명 키. 추측할 수 없는 32자 이상 값을 쓴다.
    JWT_ACCESS_SECRET: z
      .string({ error: "JWT_ACCESS_SECRET이 필요합니다." })
      .min(32, "JWT_ACCESS_SECRET은 32자 이상이어야 합니다."),
    // 프론트엔드 주소(예: https://kemi.vercel.app). 쿠키를 쓰는 요청의 Origin 검사에 쓴다.
    APP_ORIGIN: z.url({ error: "APP_ORIGIN은 http(s) 주소여야 합니다." }),
    // 앞단 프록시 개수(0 = 프록시 없음). 배포 경로에 맞게 확인한 값을 넣는다(README "클라이언트 IP").
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    // API 문서(/api/docs Swagger UI, /api/openapi.json)를 운영에서도 열지(선택, 기본 끔).
    // 개발 환경에서는 항상 열린다. 문서만 보여주며 인증·권한 검사는 그대로다.
    API_DOCS: z
      .enum(["true", "false"], {
        error: "API_DOCS는 true 또는 false여야 합니다.",
      })
      .default("false")
      .transform((value) => value === "true"),
    // 소셜 로그인 (선택). 없으면 해당 제공자는 SOCIAL_UNAVAILABLE로 안내한다.
    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
    // 카카오 REST API 키(client_id)와 Client Secret(앱에서 끈 경우 비움)
    KAKAO_REST_API_KEY: optionalSecret,
    KAKAO_CLIENT_SECRET: optionalSecret,
    // 서버 측 AI 단가 분석 (선택). API 키를 브라우저에 전달하지 않는다.
    AI_PRICING_API_KEY: optionalSecret,
    AI_PRICING_MODEL: z.string().trim().min(1).max(80).default("gpt-4o-mini"),
    // 파일 저장소(Supabase Storage, 선택). 둘 다 있어야 켜진다. 없으면 업로드·다운로드는 503.
    SUPABASE_URL: optionalSecret.pipe(z.url().optional()),
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    STORAGE_BUCKET: z.string().trim().min(1).max(63).default("kemi-private"),
    // Toss Payments 시크릿 키 (선택). 실제 결제를 막기 위해 테스트 키(test_)만 받는다.
    // 없으면 테스트 결제 경로는 503이고 다른 기능은 그대로 동작한다.
    TOSS_SECRET_KEY: optionalSecret.refine(
      (value) => value === undefined || /^test_g?sk_/.test(value),
      "TOSS_SECRET_KEY는 테스트 시크릿 키(test_sk_ 또는 test_gsk_)만 쓸 수 있습니다.",
    ),
  })
  .refine((env) => !env.GOOGLE_CLIENT_ID === !env.GOOGLE_CLIENT_SECRET, {
    path: ["GOOGLE_CLIENT_SECRET"],
    message: "GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET은 함께 설정해야 합니다.",
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `환경 변수 설정이 올바르지 않습니다.\n${issues.map((issue) => `  - ${issue}`).join("\n")}`,
    );
    this.name = "EnvValidationError";
  }
}

// 오류 메시지에는 변수 이름과 사유만 남기고 값(비밀번호 등)은 출력하지 않는다.
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    );
  }
  return result.data;
}
