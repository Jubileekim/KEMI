import { defineConfig, devices } from "@playwright/test";

// Run after building with VITE_ENABLE_AUTH_API=true and VITE_ENABLE_MOCKS=false.
// API responses are controlled fixtures; these checks do not prove a live DB or storage connection.
export default defineConfig({
  testDir: "./e2e/production",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5175",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "msedge" } },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
  },
});
