import { defineConfig } from "@playwright/test";
import base from "../../apps/web/playwright.config";
export default defineConfig({
  ...base,
  testDir: "../../apps/web/e2e",
  workers: 1,
  outputDir: "../../tmp/7-results",
  reporter: [["list"], ["json", { outputFile: "tmp/7-report.json" }]],
  use: { ...base.use, baseURL: "http://127.0.0.1:5197", channel: "msedge" },
  webServer: {
    command:
      "npm exec -w @kemi/web vite -- --host 127.0.0.1 --port 5197 --strictPort",
    url: "http://127.0.0.1:5197",
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "ignore",
    timeout: 60000,
    env: { VITE_ENABLE_MOCKS: "true", VITE_ENABLE_AUTH_API: "false" },
  },
});
