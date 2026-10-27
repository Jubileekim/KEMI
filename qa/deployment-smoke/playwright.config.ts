import { defineConfig, devices } from "@playwright/test";

// Production is explicit. Preview requires its own invocation and environment configuration.
const baseURL =
  process.env.KEMI_DEPLOYMENT_URL ?? "https://kemi-web-sigma.vercel.app";
if (new URL(baseURL).protocol !== "https:")
  throw new Error("HTTPS deployment required");
export default defineConfig({
  testDir: ".",
  testMatch: "public.spec.ts",
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "../../test-results/deployment-smoke",
  reporter: "list",
  use: {
    baseURL,
    channel: process.env.KEMI_BROWSER_CHANNEL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "production-public", use: { ...devices["Desktop Chrome"] } },
  ],
});
