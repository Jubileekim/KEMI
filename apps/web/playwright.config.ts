import { defineConfig, devices } from "@playwright/test";

// 개발용 5173과 분리한다. 기존 서버를 재사용하지 않아 다른 앱을 잘못 검사하지 않는다.
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/production/**",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
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
