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
    element.scrollLeft = element.scrollWidth;
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(150);
  const alignment = await page.evaluate(() => {
    const heading = document.querySelector('#trend-table thead th')!.getBoundingClientRect();
    const issue = document.querySelector('#trend-table thead th.col-issue')!.getBoundingClientRect();
    const container = document.querySelector('#trend-scroll')!.getBoundingClientRect();
    return {
      headingTop: heading.top,
      issueLeft: issue.left,
      containerTop: container.top,
      containerLeft: container.left,
    };
  });
  expect(Math.abs(alignment.headingTop - alignment.containerTop)).toBeLessThanOrEqual(2);
  expect(Math.abs(alignment.issueLeft - alignment.containerLeft)).toBeLessThanOrEqual(2);

  await page.getByRole('button', { name: '研究笔记' }).click();
  await expect(page.locator('.note-article-head h2')).toContainText('组合数');
  expect(await page.locator('.math-display math').count()).toBeGreaterThanOrEqual(3);

  await page.getByRole('button', { name: '数据洞察' }).click();
  await expect(page.locator('.insight-card')).toHaveCount(4);
  await expect(page.locator('.insight-card.tone-frequency')).toBeVisible();

  await page.getByRole('button', { name: '走势分析' }).click();

  await page.locator('#theme-trigger').click();
  await page.getByRole('option', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#trend-table')
    .getByRole('button', { name: '查看红球 01 的历史数据' })
    .click();
  await expect(page.getByRole('dialog', { name: '红球 01' })).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();
  expect(runtimeErrors).toEqual([]);
});
