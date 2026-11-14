import { expect, test } from '@playwright/test';

test('cross-browser core table and sticky layout', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
  await expect(page.locator('#trend-table thead th')).toHaveCount(58);
  await expect(page.locator('#overview-issue')).not.toHaveText('加载中');

  const layout = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
    table: document.querySelector('#trend-scroll')!.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.table).toBeGreaterThan(layout.viewport);

  await page.locator('#trend-scroll').evaluate((element) => {
    element.scrollLeft = 300;
    element.scrollTop = 100;
  });
  await page.waitForTimeout(150);
  const alignment = await page.evaluate(() => {
    const source = document.querySelector('#trend-table thead th:nth-child(20)')!
      .getBoundingClientRect();
    const clone = document.querySelector('#trend-sticky-track th:nth-child(20)')!
      .getBoundingClientRect();
    const shell = document.querySelector('#trend-sticky-header')!.getBoundingClientRect();
    return { delta: Math.abs(source.left - clone.left), shellHeight: shell.height };
  });
  expect(alignment.delta).toBeLessThanOrEqual(2);
  expect(alignment.shellHeight).toBeGreaterThanOrEqual(29);

  await page.locator('#theme-trigger').click();
  await page.getByRole('option', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '查看红球 01 的历史数据' }).click();
  await expect(page.getByRole('dialog', { name: '红球 01' })).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();
  expect(runtimeErrors).toEqual([]);
});
