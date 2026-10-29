import { defineConfig, devices } from "@playwright/test";

// 실제 React 화면에 API 응답을 주입한다. DB·결제 서비스에는 연결하지 않는다.
export default defineConfig({
  testDir: ".",
  testMatch: "progress.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: "list",
  outputDir: "../../test-results/request-progress",
  use: {
    baseURL: "http://127.0.0.1:4199",
    channel: process.env.KEMI_BROWSER_CHANNEL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4199",
    cwd: "../../apps/web",
    url: "http://127.0.0.1:4199",
    reuseExistingServer: false,
    env: { VITE_ENABLE_MOCKS: "false", VITE_ENABLE_AUTH_API: "true" },
  },
});
