import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

async function compareScreenshot(page, name: string) {
  const actualBuffer = await page.screenshot();
  const actual = PNG.sync.read(actualBuffer);
  const expected = PNG.sync.read(
    fs.readFileSync(path.resolve('docs/screenshots', `${name}.png`)),
  );
  expect(actual.width).toBe(expected.width);
  expect(actual.height).toBe(expected.height);
  const diff = new PNG({ width: actual.width, height: actual.height });
  const pixels = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: 0.15 },
  );
  const ratio = pixels / (actual.width * actual.height);
  expect(ratio, `${name} changed ${(ratio * 100).toFixed(2)}%`).toBeLessThanOrEqual(0.01);
}

test('desktop visual baselines', async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.CI), 'Baselines are generated on macOS Chrome');
  test.skip(process.platform !== 'darwin', 'Baselines are generated on macOS Chrome');
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto('/');
  await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
  await page.waitForTimeout(300);
  await compareScreenshot(page, 'desktop-light');

  await page.locator('#theme-trigger').click();
  await page.getByRole('option', { name: '深色' }).click();
  await page.waitForTimeout(300);
  await compareScreenshot(page, 'desktop-dark');
});

test('mobile and insights visual baselines', async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.CI), 'Baselines are generated on macOS Chrome');
  test.skip(process.platform !== 'darwin', 'Baselines are generated on macOS Chrome');
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/');
  await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
  await page.waitForTimeout(300);
  await compareScreenshot(page, 'mobile-light');

  await page.getByRole('button', { name: '数据洞察' }).click();
  await expect(page.locator('.insight-card')).toHaveCount(4);
  await page.locator('#theme-trigger').click();
  await page.getByRole('option', { name: '深色' }).click();
  await page.waitForTimeout(300);
  await compareScreenshot(page, 'insights-mobile-dark');
});
