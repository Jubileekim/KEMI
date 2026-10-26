import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import base from "../../apps/web/playwright.config";
export default defineConfig({
  ...base,
  testDir: "../../apps/web/e2e",
  outputDir: join(tmpdir(), "kemi-3a-results"),
  reporter: [
    ["list"],
    ["html", { outputFolder: join(tmpdir(), "kemi-3a-report"), open: "never" }],
  ],
  use: { ...base.use, baseURL: "http://127.0.0.1:5186", channel: "msedge" },
  webServer: {
    ...base.webServer,
    command:
      "npm exec -w @kemi/web vite -- --host 127.0.0.1 --port 5186 --strictPort",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: false,
    env: { VITE_ENABLE_MOCKS: "true" },
  },
});
