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
    { name: 'webapp', testMatch: /(?:visitor-route|visitor-location|point-types-public|point-location-correction)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5273' } },
    {
      name: 'point-firefox',
      testMatch: /(?:visitor-location|point-types-public|point-location-correction)\.spec\.ts/,
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
      testMatch: /(?:visitor-location|point-types-public|point-location-correction)\.spec\.ts/,
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://127.0.0.1:5273',
        launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH }
          : undefined
      }
    },
    { name: 'admin', testMatch: /(?:admin-auth|admin-route|admin-resource-edit|point-types-admin)\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5274' } },
    { name: 'admin-auth-firefox', testMatch: /admin-auth\.spec\.ts/, use: { ...devices['Desktop Firefox'], baseURL: 'http://127.0.0.1:5274', launchOptions: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH } : undefined } },
    { name: 'admin-auth-webkit', testMatch: /admin-auth\.spec\.ts/, use: { ...devices['Desktop Safari'], baseURL: 'http://127.0.0.1:5274', launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : undefined } }
  ]
});
