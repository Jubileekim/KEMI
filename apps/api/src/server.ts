import { createApp } from "./app.js";
import { createAuthService } from "./auth/auth.service.js";
import { EnvValidationError, parseEnv, type Env } from "./config/env.js";
import { createPrismaClient } from "./lib/prisma.js";

function start(env: Env) {
  const prisma = createPrismaClient(env);

  const app = createApp({
    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    authService: createAuthService({
      prisma,
      accessTokenSecret: env.JWT_ACCESS_SECRET,
    }),
    appOrigin: env.APP_ORIGIN,
    trustProxyHops: env.TRUST_PROXY_HOPS,
  });

  const server = app.listen(env.PORT, () => {
    console.info(`KEMI API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Render는 재배포·중지 시 SIGTERM을 보낸다. 새 요청을 받지 않고, 진행 중인 요청이 끝나면
  // DB 연결을 닫는다. 남은 작업이 없으면 Node 프로세스는 스스로 종료된다.
  const shutdown = (signal: string) => {
    console.info(`${signal} received, shutting down`);
    server.close(() => {
      prisma
        .$disconnect()
        .catch((err: unknown) => console.error("DB disconnect failed:", err));
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

try {
  start(parseEnv(process.env));
} catch (err) {
  if (!(err instanceof EnvValidationError)) {
    throw err;
  }
  // 환경 변수가 잘못되면 서버를 시작하지 않고 실패 코드로 종료한다.
  console.error(err.message);
  process.exitCode = 1;
}
