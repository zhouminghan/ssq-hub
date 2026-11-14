import { defineConfig } from '@playwright/test';

const useSystemChrome = !process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/cross-browser.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: useSystemChrome ? 'chrome' : undefined,
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: {
    timeout: 8_000,
  },
  webServer: {
    command: 'node scripts/dev-server.mjs 5173 web',
    url: 'http://127.0.0.1:5173/',
    reuseExistingServer: true,
    timeout: 15_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
