import { createApp } from './app.js';
import { EnvValidationError, parseEnv } from './config/env.js';
import { createPrismaClient } from './lib/prisma.js';

function loadEnvOrExit() {
  try {
    return parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

const env = loadEnvOrExit();
const prisma = createPrismaClient(env);

const app = createApp({
  checkDatabase: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  trustProxy: env.NODE_ENV === 'production',
});

const server = app.listen(env.PORT, () => {
  console.log(`KEMI API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Render는 재배포·중지 시 SIGTERM을 보낸다. 진행 중인 요청을 마치고 DB 연결을 닫는다.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
