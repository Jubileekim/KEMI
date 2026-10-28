import { defineConfig, devices } from "@playwright/test";

// 개발용 5173과 분리한다. 기존 서버를 재사용하지 않아 다른 앱을 잘못 검사하지 않는다.
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/production/**",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // CI(느린 모바일 에뮬레이션)에서 시간 때문에 가끔 실패하는 Mock 화면 검사를 한 번만 다시 시도한다.
  // 다시 시도해 통과하면 결과에 flaky로 남는다. 로컬은 다시 시도하지 않아 불안정한 검사를 바로 드러낸다.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_ENABLE_MOCKS: "true" },
  },
});
