import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined
  },
  webServer: [
    { command: 'npm run dev --workspace @ecosdelisboa/webapp -- --port 5273', url: 'http://127.0.0.1:5273', reuseExistingServer: false },
    { command: 'npm run dev --workspace @ecosdelisboa/admin -- --port 5274', url: 'http://127.0.0.1:5274', reuseExistingServer: false }
  ],
  projects: [
    { name: 'webapp', testMatch: /(?:visitor-route|point-types-public)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5273' } },
    {
      name: 'point-firefox',
      testMatch: /point-types-public\.spec\.ts/,
      use: {
        ...devices['Desktop Firefox'],
        baseURL: 'http://127.0.0.1:5273',
        launchOptions: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH }
          : undefined
      }
    },
    {
      name: 'point-webkit',
      testMatch: /point-types-public\.spec\.ts/,
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://127.0.0.1:5273',
        launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH }
          : undefined
      }
    },
    { name: 'admin', testMatch: /(?:admin-route|point-types-admin)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5274' } }
  ]
});
