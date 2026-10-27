import { z } from "zod";
import { createPrismaClient } from "../lib/prisma.js";
import { seedDemo } from "./seed.js";
import { assertSeedDatabase, checkSeedTarget } from "./target.js";

// 전용 개발·시연 DB에 시연 데이터를 넣는다: npm run db:seed -w @kemi/api
// - 실행 전 대상 확인(target.ts): NODE_ENV=production 거부, DB 신원이 SEED_ALLOWED_TARGETS에 있고
//   SEED_CONFIRM_TARGET과 같아야 하며, 시연 계정이 아닌 사용자가 있는 DB는 거부한다.
// - 비밀번호는 저장소에 두지 않고 SEED_PASSWORD 환경 변수로 받는다(12자 이상).
// - 중간에 실패해도 다시 실행하면 남은 단계만 이어서 만든다. 아무것도 지우지 않는다.
const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    SEED_PASSWORD: z
      .string()
      .min(12, "SEED_PASSWORD는 12자 이상이어야 합니다."),
    NODE_ENV: z.string().optional(),
    SEED_ALLOWED_TARGETS: z.string().optional(),
    SEED_CONFIRM_TARGET: z.string().optional(),
  })
  .parse(process.env);

const identity = checkSeedTarget(env);
const prisma = createPrismaClient({
  DATABASE_URL: env.DATABASE_URL,
  DATABASE_POOL_MAX: 2,
});
try {
  await assertSeedDatabase(prisma);
  console.info(`[seed] 대상 ${identity}에 시연 데이터를 넣습니다.`);
  const summary = await seedDemo(prisma, {
    password: env.SEED_PASSWORD,
    onStep: (name) => console.info(`[seed] ${name} 완료`),
  });
  console.info("[seed] 시연 데이터를 넣었습니다.", summary);
} finally {
  await prisma.$disconnect();
}
