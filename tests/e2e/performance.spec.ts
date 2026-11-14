import { expect, test } from '@playwright/test';

test('records startup and full-history rendering performance', async ({ page }, testInfo) => {
  const started = Date.now();
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
  const startupMs = Date.now() - started;

  const navigation = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return {
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
      loadMs: Math.round(nav.loadEventEnd),
      resourceCount: resources.length,
      transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
      decodedBytes: resources.reduce((sum, item) => sum + (item.decodedBodySize || 0), 0),
      defaultCells: document.querySelectorAll('#trend-table td').length,
    };
  });

  const select = page.locator('.filter-panel .filter-select');
  const total = await select.locator('option').last().getAttribute('value');
  const totalRows = Number(total);
  const fullStart = Date.now();
  await select.selectOption(total!);
  await expect(page.locator('#trend-table tbody tr')).toHaveCount(totalRows);
  const fullHistoryMs = Date.now() - fullStart;
  const full = await page.evaluate(() => ({
    cells: document.querySelectorAll('#trend-table td').length,
    domNodes: document.getElementsByTagName('*').length,
  }));

  const metrics = {
    startupMs,
    fullHistoryMs,
    ...navigation,
    ...full,
  };
  await testInfo.attach('performance.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });

  expect(startupMs).toBeLessThan(5_000);
  expect(navigation.defaultCells).toBe(2_900);
  expect(fullHistoryMs).toBeLessThan(15_000);
  expect(full.cells).toBe(totalRows * 58);
});
