import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        // DB 없이 실행하는 테스트 (npm test)
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: ['test/**/*.db.test.ts'],
        },
      },
      {
        // 테스트 전용 PostgreSQL이 필요한 테스트 (npm run test:db)
        test: {
          name: 'db',
          include: ['test/**/*.db.test.ts'],
          globalSetup: ['test/support/db-global-setup.ts'],
          // 같은 DB를 비우고 다시 쓰므로 테스트 파일을 동시에 실행하지 않는다.
          fileParallelism: false,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
