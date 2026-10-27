import { defineConfig } from "@playwright/test";
import base from "../../apps/web/playwright.config";

export default defineConfig({
  ...base,
  testDir: "../../apps/web/e2e",
  use: { ...base.use, channel: process.env.KEMI_BROWSER_CHANNEL },
  webServer: {
    ...base.webServer,
    cwd: "../..",
    command: "npm exec -w @kemi/web -- vite --host 127.0.0.1 --port 5174",
  },
});
