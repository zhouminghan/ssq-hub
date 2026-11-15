import path from 'node:path';

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PNG } from 'pngjs';

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
    await expect(page.locator('#overview-balls button.draw-ball')).toHaveCount(7);
    await expect(page.locator('#metric-status')).toHaveAttribute('title', /500彩票网 \+ 福彩官方/);
    await expect(page.locator('#overview-next')).toHaveText(
      /^预计下期 \d{7} · \d{4}\.\d{2}\.\d{2}$/,
    );
    expect(runtimeErrors).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`startup-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('renders 58 columns, sticky headers, frozen issue column, and latest row', async ({ page }, testInfo) => {
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

    const headerStyle = await page.evaluate(() => {
      const heading = document.querySelector('#trend-table thead th')!;
      const issue = document.querySelector('#trend-table thead th.col-issue')!;
      const headingStyle = getComputedStyle(heading);
      const numberHead = document.querySelector('#trend-table thead button.number-head')!
        .getBoundingClientRect();
      return {
        height: heading.getBoundingClientRect().height,
        fontSize: headingStyle.fontSize,
        fontWeight: headingStyle.fontWeight,
        borderBottom: headingStyle.borderBottomWidth,
        issueWidth: issue.getBoundingClientRect().width,
        numberHeadWidth: numberHead.width,
      };
    });
    expect(headerStyle.height).toBe(32);
    expect(headerStyle.fontSize).toBe(testInfo.project.name === 'mobile' ? '11px' : '12px');
    expect(headerStyle.fontWeight).toBe('700');
    expect(headerStyle.borderBottom).toBe('2px');
    expect(headerStyle.issueWidth).toBe(testInfo.project.name === 'mobile' ? 64 : 80);
    expect(headerStyle.numberHeadWidth).toBeGreaterThanOrEqual(24);

    await scroll.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      element.scrollTop = element.scrollHeight;
    });
    await page.waitForTimeout(100);
    const alignment = await page.evaluate(() => {
      const container = document.querySelector('#trend-scroll')!.getBoundingClientRect();
      const issue = document.querySelector('#trend-table thead th.col-issue')!.getBoundingClientRect();
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

    const layerOrder = await page.evaluate(() => ({
      tableZ: getComputedStyle(document.querySelector('#trend-table')!).zIndex,
      issueZ: Number(getComputedStyle(document.querySelector('tbody td.col-issue')!).zIndex),
      overlayZ: Number(getComputedStyle(document.querySelector('#trend-overlay')!).zIndex),
    }));
    expect(layerOrder.tableZ).toBe('auto');
    expect(layerOrder.issueZ).toBeGreaterThan(layerOrder.overlayZ);

    await expect(page.locator('#trend-sticky-header')).toHaveCount(0);
    expect(await page.locator('#trend-table thead').count()).toBe(1);
    expect(await page.locator('#trend-table thead').evaluate(
      (element) => getComputedStyle(element).opacity,
    )).toBe('1');

    const headerButton = page.locator('#trend-table')
      .getByRole('button', { name: '查看红球 01 的历史数据' });
    await headerButton.focus();
    expect(await headerButton.evaluate((element) => getComputedStyle(element).outlineWidth))
      .toBe('2px');
  });

  test('never paints the blue trend line through the frozen issue column', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Runs once with the desktop project at 390px');
    await page.setViewportSize({ width: 390, height: 844 });
    const point = await page.locator('#trend-scroll').evaluate((scroll) => {
      const table = document.querySelector('#trend-table')!;
      const rows = [...table.querySelectorAll('tbody tr')];
      const scrollRect = scroll.getBoundingClientRect();
      scroll.scrollTop = scroll.scrollHeight / 2;
      const rowIndex = rows.findIndex((row) => {
        const rect = row.getBoundingClientRect();
        return row.querySelector('td.col-blue.hit')
          && rect.top > scrollRect.top + 36
          && rect.bottom < scrollRect.bottom - 12;
      });
      if (rowIndex < 0) {
        return {
          issueWidth: table.querySelector('thead th.col-issue')!.getBoundingClientRect().width,
          rowIndex,
        };
      }
      const row = rows[rowIndex];
      const blue = row.querySelector('td.col-blue.hit')!;
      const tableRect = table.getBoundingClientRect();
      const blueRect = blue.getBoundingClientRect();
      const issueWidth = table.querySelector('thead th.col-issue')!
        .getBoundingClientRect().width;
      const canvasX = blueRect.left - tableRect.left + blueRect.width / 2;

      scroll.scrollLeft = canvasX - issueWidth / 2;
      return {
        issueWidth,
        rowIndex,
        bodyHeight: scroll.clientHeight - 36,
        scrollLeft: scroll.scrollLeft,
      };
    });
    expect(point.rowIndex).toBeGreaterThanOrEqual(0);
    await expect.poll(
      () => page.evaluate(() => Number(
        document.querySelector('#trend-overlay clipPath rect')?.getAttribute('x'),
      )),
    ).toBe(point.scrollLeft + point.issueWidth + 1);

    const clip = {
      x: 2,
      y: 34,
      width: point.issueWidth - 4,
      height: point.bodyHeight,
    };

    // Expose any SVG bleed hidden only by the sticky cell background, while
    // removing the covered blue ball so the screenshot isolates the line.
    await page.addStyleTag({
      content: `
        #trend-table tbody td.col-issue {
          z-index: auto !important;
          isolation: auto !important;
          background: transparent !important;
        }
        #trend-table tbody td.col-blue.hit .ball { visibility: hidden !important; }
        #trend-overlay polyline.blue {
          stroke: #ff00ff !important;
          opacity: 1 !important;
        }
      `,
    });
    const shot = PNG.sync.read(await page.locator('#trend-scroll').screenshot());
    const issueShot = new PNG({ width: clip.width, height: clip.height });
    PNG.bitblt(shot, issueShot, clip.x, clip.y, clip.width, clip.height, 0, 0);
    let bluePixels = 0;
    for (let i = 0; i < issueShot.data.length; i += 4) {
      const [red, green, blue] = issueShot.data.subarray(i, i + 3);
      if (red > 200 && blue > 200 && green < 80) bluePixels += 1;
    }
    expect(bluePixels).toBe(0);
  });

  test('filters recent N, year, and visible cross-year comparison', async ({ page }) => {
    const select = page.locator('.filter-panel .filter-select');
    await expect(page.locator('.select-field')).toHaveCount(1);
    expect(await select.evaluate((element) => getComputedStyle(element).appearance))
      .toBe('none');
    await expect(page.getByRole('tab', { name: '近 N 期' })).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('tab', { name: '指定年份' })).toHaveAttribute('tabindex', '-1');
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

    await page.locator('#trend-table')
      .getByRole('button', { name: '查看蓝球 02 的历史数据' })
      .click();
    await expect(page.getByRole('dialog', { name: '蓝球 02' })).toBeVisible();
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.locator('#np-root')).toBeHidden();
  });

  test('opens number profiles from the overview and insight frequency list', async ({ page }) => {
    const overviewBlue = page.locator('#overview-balls button.draw-ball.blue');
    await overviewBlue.click();
    await expect(page.getByRole('dialog', { name: /蓝球/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#np-root')).toBeHidden();
    await expect(overviewBlue).toBeFocused();

    await page.getByRole('button', { name: '数据洞察' }).click();
    const insightBall = page.locator('.frequency-ball.red').first();
    await expect(insightBall).toBeVisible();
    await insightBall.click();
    await expect(page.getByRole('dialog', { name: /红球/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#np-root')).toBeHidden();
    await expect(insightBall).toBeFocused();
    await expect(page).toHaveURL(/\?view=insights$/);
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

  test('returns focus from the custom range dialog and closes the theme menu on Tab', async ({ page }) => {
    const custom = page.getByRole('button', { name: '自定义…' });
    await custom.click();
    const dialog = page.getByRole('dialog', { name: '自定义最近期数' });
    await expect(dialog).toBeVisible();
    await expect(custom).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(custom).toBeFocused();
    await expect(custom).toHaveAttribute('aria-expanded', 'false');

    await page.locator('#theme-trigger').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#theme-menu')).toBeVisible();
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    await expect(page.locator('#theme-menu')).toBeHidden();
  });

  test('supports shareable views and browser back navigation', async ({ page }) => {
    await page.getByRole('button', { name: '数据洞察' }).click();
    await expect(page).toHaveURL(/\?view=insights$/);
    await expect(page.locator('#insights-view')).toBeVisible();
    await page.reload();
    await expect(page.locator('#insights-view')).toBeVisible();

    await page.getByRole('button', { name: '研究笔记' }).click();
    await expect(page).toHaveURL(/view=notes&note=combinations/);
    await expect(page.locator('#skip-link')).toHaveAttribute('href', '#notes-view');
    await page.goBack();
    await expect(page.locator('#insights-view')).toBeVisible();
  });

  test('exposes a safe GitHub entry and centered data footer', async ({ page }, testInfo) => {
    const link = page.locator('.app-header .github-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://github.com/zhouminghan/ssq-hub');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link.locator('span')).toHaveCount(0);
    await expect(page.locator('#theme-label')).toHaveCount(0);
    await expect(page.locator('.theme-trigger .chevron')).toHaveCount(0);

    const controls = await page.evaluate(() => {
      const measure = (selector) => {
        const element = document.querySelector(selector)!;
        const rect = element.getBoundingClientRect();
        const icon = element.querySelector('svg')!.getBoundingClientRect();
        return { width: rect.width, height: rect.height, icon: icon.width };
      };
      return {
        github: measure('.app-header .github-link'),
        theme: measure('#theme-trigger'),
      };
    });
    for (const control of [controls.github, controls.theme]) {
      expect(control.width).toBe(control.height);
      expect(control.width).toBe(testInfo.project.name === 'mobile' ? 44 : 36);
      expect(control.icon).toBe(18);
    }

    const footer = page.locator('.app-footer');
    await expect(footer).toContainText('数据来源：');
    await expect(footer).toContainText('500彩票网');
    await expect(footer).toContainText('中国福利彩票网');
    await expect(footer).toContainText('历史数据不预测未来');
    await expect(footer.locator('a')).toHaveCount(2);
    for (const source of await footer.locator('a').all()) {
      await expect(source).toHaveAttribute('target', '_blank');
      await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(await footer.evaluate((element) => getComputedStyle(element).fontSize))
      .toBe(testInfo.project.name === 'mobile' ? '11px' : '12px');
  });

  test('keeps semantic ball and structure colors in both themes', async ({ page }) => {
    const colors = await page.evaluate(() => {
      const red = document.querySelector('#trend-table tbody td.col-red.hit .ball')!;
      const blue = document.querySelector('#trend-table tbody td.col-blue.hit .ball')!;
      const small = document.querySelector('#trend-table .col-shape .s-small')!;
      const big = document.querySelector('#trend-table .col-shape .s-big')!;
      const odd = document.querySelector('#trend-table .col-shape .s-odd')!;
      const even = document.querySelector('#trend-table .col-shape .s-even')!;
      const prime = document.querySelector('#trend-table .col-shape .s-prime')!;
      const composite = document.querySelector('#trend-table .col-shape .s-composite')!;
      const root = getComputedStyle(document.documentElement);
      return {
        red: getComputedStyle(red).backgroundImage,
        blue: getComputedStyle(blue).backgroundImage,
        redEdge: getComputedStyle(red).borderTopColor,
        blueEdge: getComputedStyle(blue).borderTopColor,
        redBorder: getComputedStyle(red).borderTopWidth,
        blueBorder: getComputedStyle(blue).borderTopWidth,
        small: getComputedStyle(small).color,
        big: getComputedStyle(big).color,
        odd: getComputedStyle(odd).color,
        even: getComputedStyle(even).color,
        prime: getComputedStyle(prime).color,
        composite: getComputedStyle(composite).color,
        redDeep: root.getPropertyValue('--red-deep').trim(),
        blueDeep: root.getPropertyValue('--blue-deep').trim(),
      };
    });
    expect(colors.red).toContain('radial-gradient');
    expect(colors.blue).toContain('radial-gradient');
    expect(colors.redBorder).toBe('1px');
    expect(colors.blueBorder).toBe('1px');
    expect(colors.redEdge).not.toBe(colors.blueEdge);
    const toRgb = (hex) => {
      const value = hex.replace('#', '');
      return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`;
    };
    for (const color of [colors.small, colors.even, colors.composite]) {
      expect(color).toBe(toRgb(colors.blueDeep));
    }
    for (const color of [colors.big, colors.odd, colors.prime]) {
      expect(color).toBe(toRgb(colors.redDeep));
    }

    await page.getByRole('button', { name: '数据洞察' }).click();
    await expect(page.locator('.insight-card')).toHaveCount(4);
    const redFrequency = await page.locator('.frequency-ball.red').first()
      .evaluate((element) => getComputedStyle(element).backgroundImage);
    await page.getByRole('tab', { name: '蓝球' }).click();
    const blueFrequency = await page.locator('.frequency-ball.blue').first()
      .evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(redFrequency).toContain('radial-gradient');
    expect(blueFrequency).toContain('radial-gradient');

    await page.locator('#theme-trigger').click();
    await page.getByRole('option', { name: '深色' }).click();
    const darkShapeColors = await page.evaluate(() => {
      const small = document.querySelector('#trend-table .col-shape .s-small')!;
      const big = document.querySelector('#trend-table .col-shape .s-big')!;
      return { small: getComputedStyle(small).color, big: getComputedStyle(big).color };
    });
    expect(darkShapeColors.small).not.toBe(darkShapeColors.big);
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

    await expect(page.locator('.insight-card.tone-structure')).toHaveCount(1);
    await expect(page.locator('.insight-card.tone-pattern')).toHaveCount(1);
    await expect(page.locator('.insight-card.tone-ac')).toHaveCount(1);
    await expect(page.locator('.insight-card.tone-frequency')).toHaveCount(1);
    const insightColors = await page.evaluate(() => {
      const style = (selector) => getComputedStyle(document.querySelector(selector)!);
      return {
        zoneRed: style('.structure-bar .seg-red').backgroundImage,
        zoneBlue: style('.structure-bar .seg-blue').backgroundImage,
        zoneGold: style('.structure-bar .seg-gold').backgroundImage,
        acPeak: style('.ac-bar.peak').backgroundImage,
        consecutive: style('.pattern-stat.consecutive').backgroundColor,
        sameTail: style('.pattern-stat.same-tail').backgroundColor,
        redFrequency: style('.frequency-fill.red').backgroundImage,
      };
    });
    expect(insightColors.zoneRed).toContain('gradient');
    expect(insightColors.zoneBlue).toContain('gradient');
    expect(insightColors.zoneGold).toContain('gradient');
    expect(insightColors.acPeak).toContain('gradient');
    expect(insightColors.consecutive).not.toBe(insightColors.sameTail);
    expect(insightColors.redFrequency).toContain('gradient');

    await page.getByRole('tab', { name: '蓝球' }).click();
    await expect(page.locator('.frequency-ball.blue').first()).toBeVisible();
    expect(await page.locator('.frequency-fill.blue').first()
      .evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('gradient');
  });

  test('renders markdown research notes for probability and expectation', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: '研究笔记' }).click();
    await expect(page.locator('.note-selector')).toHaveCount(3);
    await expect(page.locator('.note-selector .note-cover')).toHaveCount(3);
    await expect(page.locator('.note-selector.active')).toHaveClass(/tone-red/);
    await expect(page.locator('.note-article-head h2')).toHaveText(
      '从组合数看一等奖：1 / 17721088 怎么来',
    );
    await expect(page.locator('.note-body')).toContainText('C(33, 6)');
    await expect(page.locator('.note-body')).toContainText('1,107,568');
    await expect(page.locator('.note-body')).toContainText('17,721,088');
    expect(await page.locator('.math-display math').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('.combination-node.red code')).toHaveText('1,107,568');
    await expect(page.locator('.combination-node.result strong')).toHaveText('17,721,088');
    await expect(page.locator('.note-chart .prize-row')).toHaveCount(6);
    await expect(page.locator('.note-table tbody .fraction')).toHaveCount(6);
    await expect(page.locator('.prize-value .fraction')).toHaveCount(6);
    await expect(page.locator('.note-table tbody .fraction').first()).toHaveAttribute(
      'aria-label',
      '1 / 17721088',
    );
    await expect(page.locator('.note-body')).toContainText('6.71%');
    const externalNoteLinks = page.locator('.note-body a[href^="http"]');
    await expect(externalNoteLinks.first()).toHaveAttribute('target', '_blank');
    await expect(externalNoteLinks.first()).toHaveAttribute('rel', /noopener noreferrer/);

    await page.getByRole('button', { name: /2 元一注的数学期望/ }).click();
    await expect(page.locator('.note-article-head h2')).toHaveText(
      '2 元一注的数学期望：为什么长期成本是负的',
    );
    await expect(page.locator('.note-body')).toContainText('数学期望');
    expect(await page.locator('.math-display math').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('.note-chart .expectation-bar')).toBeVisible();
    await expect(page.locator('.expectation-result')).toContainText('-1.00 元 / 注');
    await expect(page).toHaveURL(/view=notes&note=expectation/);

    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
      notes: document.querySelector('#notes-view')!.scrollWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(widths.notes).toBeLessThanOrEqual(widths.viewport);
    if (testInfo.project.name === 'mobile') {
      await expect(page.locator('.notes-shell')).toHaveCSS('overflow-y', 'auto');
      await expect(page.locator('.notes-article-scroll')).toHaveCSS('overflow-y', 'visible');
    }
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
      if (viewport.width === 768) await expect(page.locator('#metric-status')).toBeVisible();
    }
    await expect(page.locator('#overview-scale')).toBeVisible();

    for (const selector of [
      '.app-nav-item.active', '.github-link', '#theme-trigger',
      '.filter-tab.active', '.btn-custom', '.filter-reset', '.filter-select',
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box!.x, `${selector} left`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${selector} right`).toBeLessThanOrEqual(375);
      expect(box!.height, `${selector} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test('passes automated accessibility checks for all views', async ({ page }) => {
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

    await page.getByRole('button', { name: '研究笔记' }).click();
    await expect(page.locator('.note-article-head h2')).toBeVisible();
    const notes = await new AxeBuilder({ page }).analyze();
    expect(
      notes.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);

    await page.locator('#theme-trigger').click();
    await page.getByRole('option', { name: '深色' }).click();
    await page.waitForTimeout(250);
    const darkNotes = await new AxeBuilder({ page }).analyze();
    expect(
      darkNotes.violations.filter(
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
    await expect(page.locator('#trend-loading .error-text')).toHaveText(
      '加载失败：无法连接数据源，请检查网络后重试',
    );
    await expect(page.locator('#trend-scroll')).toBeHidden();
    await expect(page.locator('#metric-status')).toHaveText('数据不可用');
  });

  test('labels a successful CDN fallback as an alternate source', async ({ page }) => {
    await page.route('**/data/**', (route) => route.abort());
    await page.route('https://cdn.jsdelivr.net/**', async (route) => {
      const url = new URL(route.request().url());
      const marker = ['/web/data/', '/web/config/'].find((part) => url.pathname.includes(part));
      expect(marker).toBeTruthy();
      const relative = marker === '/web/data/'
        ? `data/${url.pathname.slice(url.pathname.indexOf(marker) + marker.length)}`
        : `config/${url.pathname.slice(url.pathname.indexOf(marker) + marker.length)}`;
      await route.fulfill({
        path: path.resolve('web', relative),
        contentType: 'application/json',
      });
    });
    await page.goto('/');
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
    await expect(page.locator('#metric-status')).toHaveText('备用镜像');
    await expect(page.locator('#metric-status-detail')).toHaveText('本次已切换备用');
  });

  test('uses the browser cache when network sources are unavailable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
    await page.route('**/data/**', (route) => route.abort());
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#metric-status')).toHaveText('本地缓存', { timeout: 20_000 });
    await expect(page.locator('#metric-status-detail')).toContainText('缓存于');
    await expect(page.locator('#trend-table tbody tr')).toHaveCount(50);
  });
});
