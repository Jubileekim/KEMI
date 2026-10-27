import { defineConfig } from "@playwright/test";
import base from "../../apps/web/playwright.config";
export default defineConfig({
  ...base,
  testDir: "../../apps/web/e2e",
  workers: 1,
  use: { ...base.use, baseURL: "http://127.0.0.1:5197", channel: "msedge" },
  webServer: {
    command:
      "npm exec -w @kemi/web vite -- --host 127.0.0.1 --port 5197 --strictPort",
    url: "http://127.0.0.1:5197",
    reuseExistingServer: false,
    timeout: 60000,
    env: { VITE_ENABLE_MOCKS: "true", VITE_ENABLE_AUTH_API: "false" },
  },
});
