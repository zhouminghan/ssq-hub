import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/cross-browser.spec.ts',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },
  webServer: {
    command: 'node scripts/dev-server.mjs 5173 web',
    url: 'http://127.0.0.1:5173/',
    reuseExistingServer: true,
    timeout: 15_000,
  },
  projects: [
    {
      name: 'firefox-desktop',
      use: { browserName: 'firefox', viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'webkit-mobile',
      use: { browserName: 'webkit', viewport: { width: 390, height: 844 } },
    },
  ],
});
