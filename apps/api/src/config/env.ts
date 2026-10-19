import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535)
    .default(4000),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL이 필요합니다.' })
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL은 postgresql:// 형식이어야 합니다.'),
  // Supabase 연결 풀러의 동시 연결 한도를 넘지 않도록 서버 한 대가 여는 연결 수를 제한한다.
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50)
    .default(5),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`환경 변수 설정이 올바르지 않습니다.\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

// 오류 메시지에는 변수 이름과 사유만 남기고 값(비밀번호 등)은 출력하지 않는다.
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}
