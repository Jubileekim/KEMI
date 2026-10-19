import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { createHealthRouter, type DatabaseCheck } from './routes/health.js';

export interface AppDependencies {
  checkDatabase: DatabaseCheck;
  trustProxy?: boolean;
}

export function createApp({ checkDatabase, trustProxy = false }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  // Render·Vercel 프록시 뒤에서 클라이언트 IP와 https 여부를 올바르게 읽기 위해 사용한다.
  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '1mb' }));

  app.use(createHealthRouter(checkDatabase));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
