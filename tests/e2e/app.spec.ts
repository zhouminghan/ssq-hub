import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('SSQ Hub product workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
    await expect(page.locator('#metric-status')).not.toHaveText('读取中');
  });

  test('loads real data without runtime or console errors', async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    await page.reload();
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
    await expect(page).toHaveTitle(/SSQ Hub/);
    const latest = await page.evaluate(async () => (await fetch('./data/latest.json')).json());
    await expect(page.locator('#overview-issue')).toHaveText(latest.latest_draw.issue);
    await expect(page.locator('#overview-date')).toHaveText(
      latest.latest_draw.date.replaceAll('-', '.'),
    );
    await expect(page.locator('#overview-balls .draw-ball')).toHaveCount(7);
    await expect(page.locator('#metric-status')).toHaveAttribute('title', /500彩票网 \+ 福彩官方/);
    expect(runtimeErrors).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`startup-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('renders 58 columns, sticky headers, frozen issue column, and latest row', async ({ page }) => {
    await expect(page.locator('#trend-table thead th')).toHaveCount(58);
    await expect(page.locator('#trend-table tbody tr.is-latest')).toHaveCount(1);
    const latest = await page.evaluate(async () => (await fetch('./data/latest.json')).json());
    await expect(page.locator('#trend-table tbody tr.is-latest')).toHaveAttribute(
      'data-issue',
      latest.latest_draw.issue,
    );

    const scroll = page.locator('#trend-scroll');
    const metrics = await scroll.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.scrollHeight).toBeGreaterThanOrEqual(metrics.clientHeight);

    await scroll.evaluate((element) => {
      element.scrollLeft = 420;
      element.scrollTop = 120;
    });
    await page.waitForTimeout(100);
    const alignment = await page.evaluate(() => {
      const container = document.querySelector('#trend-scroll')!.getBoundingClientRect();
      const issue = document.querySelector('#trend-table tbody td.col-issue')!.getBoundingClientRect();
      const heading = document.querySelector('#trend-table thead th')!.getBoundingClientRect();
      return {
        issueLeft: issue.left,
        containerLeft: container.left,
        headingTop: heading.top,
        containerTop: container.top,
      };
    });
    expect(Math.abs(alignment.issueLeft - alignment.containerLeft)).toBeLessThanOrEqual(2);
    expect(Math.abs(alignment.headingTop - alignment.containerTop)).toBeLessThanOrEqual(2);

    const paintMask = await page.evaluate(() => {
      const shell = document.querySelector('#trend-sticky-header')!.getBoundingClientRect();
      const container = document.querySelector('#trend-scroll')!.getBoundingClientRect();
      const coveredRows = [...document.querySelectorAll('#trend-table tbody tr')]
        .filter((row) => row.getBoundingClientRect().top < shell.bottom);
      return {
        extension: shell.height - 30,
        maxCoveredBottom: Math.max(
          0,
          ...coveredRows.map((row) => row.getBoundingClientRect().bottom),
        ),
        shellBottom: shell.bottom,
        containerBottom: container.bottom,
      };
    });
    expect(paintMask.extension).toBeGreaterThanOrEqual(0);
    expect(paintMask.maxCoveredBottom).toBeLessThanOrEqual(paintMask.shellBottom + 1);

    const headerButton = page.getByRole('button', { name: '查看红球 01 的历史数据' });
    await headerButton.focus();
    const mirroredFocus = page.locator(
      '#trend-sticky-track button[data-ball="1"][data-color="red"]',
    );
    await expect(mirroredFocus).toHaveClass(/clone-focus/);
    expect(await mirroredFocus.evaluate((element) => getComputedStyle(element).outlineWidth))
      .toBe('2px');
  });

  test('filters recent N, year, and visible cross-year comparison', async ({ page }) => {
    const select = page.locator('.filter-panel .filter-select');
    await select.selectOption('100');
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(100);
    await expect(page.locator('#trend-summary')).toContainText('100');

    const index = await page.evaluate(async () => (await fetch('./data/history_index.json')).json());
    const selectedYear = index.years.at(-2);
    await page.getByRole('tab', { name: '指定年份' }).click();
    await page.locator('.filter-panel .filter-select').selectOption(selectedYear.year);
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(selectedYear.count);
    await expect(page.locator('#trend-summary')).toContainText(selectedYear.year);

    await page.getByRole('tab', { name: '同期对比' }).click();
    await expect(page.locator('.compare-summary')).toBeVisible();
    await expect(page.locator('.compare-summary')).toContainText('历史年份');
    await expect(page.locator('#trend-table tbody tr')).not.toHaveCount(0);
    await expect(page.locator('#trend-table tbody td.col-issue .year-tag').first()).toBeVisible();
    const latest = await page.evaluate(async () => (await fetch('./data/latest.json')).json());
    const latestSeq = latest.latest_draw.issue.slice(4);
    await page.locator('.filter-panel .filter-select').selectOption(latestSeq);
    await expect(page.locator('.compare-summary .compare-badge')).toHaveText(`第 ${latestSeq} 期`);
    const claimedMatches = Number(
      (await page.locator('.compare-summary').innerText()).match(/对齐 (\d+) 个历史年份/)?.[1],
    );
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(claimedMatches);

    await page.getByRole('button', { name: '重置筛选条件' }).click();
    await expect(page.getByRole('tab', { name: '近 N 期' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
  });

  test('opens number profile from the table and accessible header controls', async ({ page }) => {
    const firstRed = page.locator('#trend-table tbody td.col-red.hit').first();
    await firstRed.click();
    const dialog = page.getByRole('dialog', { name: /红球|蓝球/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.np-stat')).toHaveCount(3);
    await expect(dialog).toContainText('出现频次');
    await expect(dialog).toContainText('最近 5 次出现');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: '查看蓝球 02 的历史数据' }).click();
    await expect(page.getByRole('dialog', { name: '蓝球 02' })).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.locator('#np-root')).toBeHidden();
  });

  test('persists theme choice and follows system in auto mode', async ({ page }) => {
    const root = page.locator('html');
    await page.locator('#theme-trigger').click();
    await page.getByRole('option', { name: '深色' }).click();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(root).toHaveAttribute('data-theme-mode', 'dark');

    await page.reload();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.locator('#theme-trigger').click();
    await page.getByRole('option', { name: '跟随系统' }).click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(root).toHaveAttribute('data-theme', 'light');
  });

  test('supports keyboard navigation for tabs and the theme menu', async ({ page }) => {
    const recentTab = page.getByRole('tab', { name: '近 N 期' });
    await recentTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '指定年份' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: '重置筛选条件' }).click();

    await page.locator('#theme-trigger').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('exposes a safe GitHub entry', async ({ page }) => {
    const link = page.locator('.app-header .github-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://github.com/zhouminghan/ssq-hub');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('switches to insight charts without horizontal page overflow', async ({ page }) => {
    await page.getByRole('button', { name: '数据洞察' }).click();
    await expect(page.locator('.insight-card')).toHaveCount(4);
    expect(await page.locator('.ac-chart .ac-column').count()).toBeGreaterThan(4);
    await expect(page.locator('.frequency-row').first()).toBeVisible();
    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
      insights: document.querySelector('#insights-grid')!.scrollWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(widths.insights).toBeLessThanOrEqual(widths.viewport);

    await page.getByRole('tab', { name: '蓝球' }).click();
    await expect(page.locator('.frequency-ball.blue').first()).toBeVisible();
  });

  test('keeps the page within the viewport and the drawer usable', async ({ page }) => {
    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
      filterClient: document.querySelector('#filter-bar')!.clientWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(widths.filterClient).toBeLessThanOrEqual(widths.viewport);

    await page.locator('#trend-table tbody td.col-red.hit').first().click();
    const drawer = page.locator('.np-panel');
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(widths.viewport + 1);
    await page.keyboard.press('Escape');
  });

  test('holds layout at 1440, 1280, 768, 390, and 375 widths', async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1280, height: 900 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(60);
      const metrics = await page.evaluate(() => {
        const table = document.querySelector('#trend-table')!.getBoundingClientRect();
        const header = document.querySelector('.app-header')!.getBoundingClientRect();
        return {
          body: document.body.scrollWidth,
          viewport: document.documentElement.clientWidth,
          tableWidth: table.width,
          headerRight: header.right,
          githubVisible: Boolean(document.querySelector('.github-link')?.getBoundingClientRect().width),
        };
      });
      expect(metrics.body, `${viewport.width}px body width`).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.tableWidth).toBeGreaterThan(metrics.viewport);
      expect(metrics.headerRight).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.githubVisible).toBe(true);
      if (viewport.width > 760) await expect(page.locator('#overview-scale')).toBeHidden();
    }
    await expect(page.locator('#overview-scale')).toBeVisible();
  });

  test('passes automated accessibility checks for both views', async ({ page }) => {
    const trend = await new AxeBuilder({ page }).analyze();
    const serious = trend.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(serious).toEqual([]);

    await page.getByRole('button', { name: '数据洞察' }).click();
    await expect(page.locator('.insight-card')).toHaveCount(4);
    const insights = await new AxeBuilder({ page }).analyze();
    expect(
      insights.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);

    await page.locator('#theme-trigger').click();
    await page.getByRole('option', { name: '深色' }).click();
    await page.waitForTimeout(250);
    const darkInsights = await new AxeBuilder({ page }).analyze();
    expect(
      darkInsights.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
});

test.describe('Resilience', () => {
  test('shows a clear failure state when every data source fails', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.route('**/data/**', (route) => route.abort());
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#trend-loading .error-text')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#trend-scroll')).toBeHidden();
  });

  test('uses the browser cache when network sources are unavailable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
    await page.route('**/data/**', (route) => route.abort());
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#metric-status')).toHaveText('使用本地缓存', { timeout: 20_000 });
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
  });
});
