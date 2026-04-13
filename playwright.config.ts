import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173"
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/
    },
    {
      name: "chromium",
      testMatch: /admin-flow\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: {
    command: "npm run dev:e2e",
    url: "http://127.0.0.1:4173/admin/local-admin-secret-token",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000
  }
});
