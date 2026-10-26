import { z } from "zod";
import { createPrismaClient } from "../lib/prisma.js";
import { SeedAlreadyAppliedError, seedDemo } from "./seed.js";

// 개발·시연 DB에 시연 데이터를 넣는다: npm run db:seed -w @kemi/api
// - 운영(NODE_ENV=production)에서는 실행하지 않는다.
// - 비밀번호는 저장소에 두지 않고 SEED_PASSWORD 환경 변수로 받는다(12자 이상).
// - 이미 시연 계정(@kemi.test)이 있으면 아무것도 바꾸지 않고 끝낸다.
const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    SEED_PASSWORD: z
      .string()
      .min(12, "SEED_PASSWORD는 12자 이상이어야 합니다."),
    NODE_ENV: z.string().optional(),
  })
  .parse(process.env);

if (env.NODE_ENV === "production") {
  throw new Error(
    "[seed] NODE_ENV=production에서는 시연 데이터를 넣지 않습니다.",
  );
}

const prisma = createPrismaClient({
  DATABASE_URL: env.DATABASE_URL,
  DATABASE_POOL_MAX: 2,
});
try {
  const summary = await seedDemo(prisma, { password: env.SEED_PASSWORD });
  console.info("[seed] 시연 데이터를 넣었습니다.", summary);
} catch (err) {
  if (err instanceof SeedAlreadyAppliedError) {
    console.info(`[seed] ${err.message}`);
  } else {
    throw err;
  }
} finally {
  await prisma.$disconnect();
}
