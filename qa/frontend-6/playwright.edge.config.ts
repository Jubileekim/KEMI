import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import base from "../../apps/web/playwright.config";

export default defineConfig({
  ...base,
  testDir: "../../apps/web/e2e",
  outputDir: join(tmpdir(), "kemi-6-results"),
  reporter: [
    ["list"],
    ["json", { outputFile: join(tmpdir(), "kemi-6-report.json") }],
  ],
  use: { ...base.use, baseURL: "http://127.0.0.1:5196", channel: "msedge" },
  webServer:
    process.env.KEMI_QA_EXTERNAL_SERVER === "true"
      ? undefined
      : {
          ...base.webServer,
          command:
            "npm exec -w @kemi/web vite -- --host 127.0.0.1 --port 5196 --strictPort",
          url: "http://127.0.0.1:5196",
          reuseExistingServer: false,
          stdout: "ignore",
          stderr: "ignore",
          env: { VITE_ENABLE_MOCKS: "true" },
        },
});
