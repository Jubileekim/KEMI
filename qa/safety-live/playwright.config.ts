import { defineConfig, devices } from "@playwright/test";
import { resolveTestDatabaseUrl } from "../../apps/api/test/support/test-db-guard";

// 명시적으로 지정한 로컬 *_test DB만 허용한다. 운영/개발 .env를 읽지 않는다.
const database = resolveTestDatabaseUrl(process.env);
export default defineConfig({
  testDir: ".",
  testMatch: "flow.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  outputDir: "../../test-results/safety-live",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4198",
    trace: "retain-on-failure",
    channel: process.env.KEMI_BROWSER_CHANNEL,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node qa/safety-live/api.cjs",
      cwd: "../..",
      url: "http://127.0.0.1:4401/health",
      reuseExistingServer: false,
      env: {
        NODE_ENV: "production",
        PORT: "4401",
        DATABASE_URL: database,
        JWT_ACCESS_SECRET: "local-browser-test-secret-at-least-32-chars",
        APP_ORIGIN: "http://127.0.0.1:4198",
      },
    },
    {
      command: "node qa/safety-live/serve.cjs",
      cwd: "../..",
      url: "http://127.0.0.1:4198",
      reuseExistingServer: false,
    },
  ],
});
