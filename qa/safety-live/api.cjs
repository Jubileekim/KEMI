// 브라우저 검증 전용. 명시적인 로컬 테스트 DB에만 운영자 fixture를 만든다.
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.pathname.endsWith("_test")
  )
    throw new Error("Local test database required");
  const { createPrismaClient } =
    await import("../../apps/api/dist/lib/prisma.js");
  const bcrypt = require("bcrypt");
  const prisma = createPrismaClient({
    DATABASE_URL: url.href,
    DATABASE_POOL_MAX: 2,
  });
  await prisma.user.upsert({
    where: { email: "ops-browser@kemi.test" },
    update: {},
    create: {
      email: "ops-browser@kemi.test",
      name: "테스트 운영자",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("BrowserTest1234", 12),
    },
  });
  await prisma.$disconnect();
  await import("../../apps/api/dist/server.js");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
