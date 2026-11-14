# SSQ Hub QA Report

**Current status: PASS (local QA + WebKit mobile smoke)**

| Item | Value |
|---|---|
| Final run time | 2026-11-14 20:14-20:17 CST |
| Branch | `codex/product-rebuild` |
| Baseline | `8594a6b807de8f5e5860353929dde92be0c46d6c` |
| Delivery commit | `1abfd5d` (reviewed pre-commit tree; final tests ran on identical files) |
| Node / npm | v22.23.4 / 10.9.9 |
| Python | 3.12.15 (`.venv`) |
| Ruff | 0.17.5 |
| Playwright | 1.65.1 |
| Browsers | Chrome 157.0.8103.51; bundled WebKit 2388 |
| Product code modified by QA | None |

## Final Result

All six requested gates pass:

| Gate | Result | Count | Time |
|---|---|---|---:|
| `npm run check` | PASS | 25/25 automated tests, plus typecheck, ESLint, Ruff | 0.93 s |
| `npm run test:schema` | PASS | 30/30 data files | 0.16 s |
| `.venv/bin/python scripts/verify_data.py` | PASS | 0 errors, 0 warnings | 0.21 s |
| `npx playwright test` | PASS | 30 passed, 2 skipped, 0 failed | 41.0 s |
| `npm run test:visual` | PASS | 2 passed, 2 project-specific skips | 3.9 s |
| WebKit mobile cross-browser | PASS | 1/1 | 1.7 s |

The main E2E matrix was run twice. Both runs returned the same result:
30 passed, 2 skipped, 0 failed (40.6 s and 41.0 s). The preserved final run
recorded exactly 32 entries: 30 expected, 2 skipped, 0 unexpected, 0 flaky.

## Historical Failure vs Final State

### Earlier QA run

- Time: 2026-11-14 19:05-19:09 CST
- Result: 26 passed / 2 failed / 0 skipped
- Cause: `.miss` used `#a0acbc` on white, measured at 2.3:1
- Axe impact: `serious`, WCAG 2 AA `color-contrast`
- Affected nodes: 7 desktop, 1 mobile
- The accessibility test stopped at the first assertion, so insights and
  dark-theme audits did not run

### Current final state

- `.miss` uses `#5b687a` at `web/css/theme.css:20`, measured at 5.67:1 on white
- Trend, insights, and dark-insights axe checks run and pass on desktop and
  mobile
- The original 28-entry E2E matrix now passes in full
- The suite now contains 32 matrix entries because the visual tests were added
- Two visual entries skip intentionally because each visual test is scoped to
  its target project

**Historical contrast defect: CLOSED.**

## Python, Ruff, Schema, and Data

### `npm run check`

The check chain now includes:

```text
typecheck
ESLint
Ruff
5 Node unit tests
20 Python unittest tests
```

Ruff output:

```text
.venv/bin/ruff check scripts tests/python
All checks passed!
```

No Ruff finding remains. The Python suite includes the new
`test_partial_backfill_still_fails_when_today_draw_is_missing`; it passed.

### Data gate

- History: 3,527 draws, 24 years, 2003-02-23 to 2026-11-12
- Latest issue: `2026130`
- Latest date: `2026-11-12`
- Data generated at: `2026-11-14T09:43:48Z`
- Source state verified at: `2026-11-14T11:40:00Z`
- Source: `500彩票网 + 福彩官方`
- Cross-checked: `true`
- All 24 annual history files passed JSON Schema
- Protected baseline fingerprint: PASS
- Latest / stats / manifest / index consistency: PASS
- History corrections: none recorded
- Source-state consistency: PASS
- Freshness: 2 days at test time

The main schema gate validated 30 data files. `verify_data.py` reported
0 errors and 0 warnings; no structural or dependency warning remains.

## E2E Matrix

### Chrome desktop and mobile

Main configuration:

- Desktop: Chrome 157, 1440x1000
- Mobile: Chrome 157 mobile emulation, 390x844

| Test | Desktop | Mobile |
|---|---|---|
| Loads real data without runtime or console errors | PASS | PASS |
| 58 columns, sticky header, frozen issue column, latest row | PASS | PASS |
| Recent N, year filter, and Compare actual match count | PASS | PASS |
| Number profile and accessible header controls | PASS | PASS |
| Theme persistence and system auto mode | PASS | PASS |
| Keyboard navigation for tabs and theme menu | PASS | PASS |
| Safe GitHub entry | PASS | PASS |
| Insight charts without page overflow | PASS | PASS |
| Page viewport and drawer containment | PASS | PASS |
| Layout at 1440, 1280, 768, 390, and 375 px | PASS | PASS |
| Automated accessibility: trend, insights, dark insights | PASS | PASS |
| Clear failure state when all sources fail | PASS | PASS |
| Browser-cache fallback when network sources fail | PASS | PASS |
| Startup and full-history performance | PASS | PASS |
| Desktop visual baselines | PASS | SKIP |
| Mobile and insights visual baselines | SKIP | PASS |

The 2 skips are explicit target-project guards, not missing evidence: each
visual test passed in its intended project.

### WebKit mobile

The dedicated cross-browser smoke ran on WebKit 2388 at 390x844:

```text
tests/e2e/cross-browser.spec.ts:3
cross-browser core table and sticky layout
1 passed (1.7 s)
```

It verified:

- 50 rendered rows and 58 headers
- latest issue loads
- no page-level horizontal overflow
- internal table scrolling
- sticky-header clone alignment within 2 px
- header shell height at least 29 px
- dark theme switch
- number-profile drawer open and close
- no page or console errors

### Browser coverage

| Engine | Viewport | Evidence |
|---|---|---|
| Chrome 157.0.8103.51 | 1440x1000 desktop | Main E2E, accessibility, performance, visuals |
| Chrome 157 mobile emulation | 390x844 | Main E2E, accessibility, performance, visuals |
| WebKit 2388 | 390x844 mobile | Dedicated cross-browser smoke |
| Firefox | 1280x900 | Configured in CI, not run in this local pass |

## Visual Automation

`npm run test:visual` passed:

```text
2 passed, 2 skipped (3.9 s)
```

The target-project tests compared four checked-in screenshots with pixelmatch:

- `desktop-light.png`
- `desktop-dark.png`
- `mobile-light.png`
- `insights-mobile-dark.png`

All four comparisons stayed within the checked-in 1% pixel-difference
threshold. The visual baselines are present in `docs/screenshots/`.

## Performance Evidence

Performance thresholds remain startup `< 5,000 ms` and full history
`< 15,000 ms`.

| Metric | Desktop | Mobile |
|---|---:|---:|
| Startup until 50 rows rendered | 599 ms | 611 ms |
| Render all 3,527 rows | 3,362 ms | 3,342 ms |
| DOMContentLoaded | 30 ms | 26 ms |
| Load event | 30 ms | 26 ms |
| Resource count | 25 | 25 |
| Transfer size | 137,113 B | 137,113 B |
| Decoded resource size | 129,613 B | 129,613 B |
| Default table cells | 2,900 | 2,900 |
| Full-history cells | 204,566 | 204,566 |
| Full-history DOM nodes | 448,313 | 448,313 |

Static asset footprint:

- JavaScript: 57,931 B raw / 18,133 B gzip
- CSS: 40,691 B raw / 8,336 B gzip
- `web/data/`: 732 KB

## Supply-chain and POC Reproducibility

Verified present:

- root `package-lock.json`
- `requirements.lock`
- `requirements-runtime.lock`
- `pocs/vue-table/package-lock.json`

Ruff is pinned through the locked Python development environment and is now a
required step in `npm run check`.

## Residual Risks

1. **Visual baseline does not run in CI.** `tests/e2e/visual.spec.ts` still
   skips when `CI` is true, on non-macOS platforms, and on the non-target
   project. Visual automation is proven locally but is not enforced by the
   current GitHub Actions workflow.
2. **Firefox was not rerun locally.** CI has a Firefox/WebKit job, but this
   final local pass only exercised the requested WebKit mobile smoke.
3. **No live deployment evidence.** GitHub Actions, Pages deployment, and the
   production URL were not verified in this local QA pass.
4. **CDN success path is indirect.** Total data-source failure and browser
   cache fallback pass; successful CDN retrieval followed by local fallback is
   not separately exercised.
5. **Sandbox command context.** The checked-in config uses port 5173, which
   cannot bind in this sandbox. E2E, visual, and WebKit runs used temporary
   configs on port 8774. The visual command required sandbox escalation for
   local browser/network process control.
6. **Visual comparison is viewport-level.** Baselines are tied to macOS Chrome
   rendering and do not provide cross-browser pixel coverage.
7. **Freshness is time-dependent.** Data is two days old at the time of this
   run and will move toward the freshness limit as time advances.
8. **Performance is a single sample.** The matrix is comfortably within the
   limits, but one run does not establish a long-term regression trend.

## Evidence Paths

- Final main E2E HTML report: `/tmp/ssq-qa-main-report/index.html`
- Final main E2E artifacts: `/tmp/ssq-qa-main-results/`
- Visual HTML report: `/tmp/ssq-qa-final2-report/index.html`
- Visual artifacts: `/tmp/ssq-qa-final2-results/`
- WebKit HTML report: `/tmp/ssq-qa-webkit-report/index.html`
- WebKit artifacts: `/tmp/ssq-qa-webkit-results/`
- Chrome temporary config: `/tmp/qa-playwright.config.mjs`
- WebKit temporary config: `/tmp/qa-cross-browser.config.mjs`
- Checked-in visual baselines: `docs/screenshots/*.png`
- Historical failure report: `/tmp/ssq-qa-final-report/index.html`

## Verdict

| Area | Result |
|---|---|
| TypeScript / ESLint / Ruff | PASS |
| Node unit / Python tests | PASS, 25/25 |
| Schema validation | PASS, 30/30 files |
| Data integrity and source tracking | PASS, 0 errors / 0 warnings |
| Partial-backfill expected-draw behavior | PASS |
| Functional E2E | PASS, 30/30 executed |
| Accessibility | PASS |
| Visual baselines | PASS locally |
| WebKit mobile smoke | PASS, 1/1 |
| Performance | PASS |
| Live deployment / Actions | NOT VERIFIED |
| Local QA | **PASS** |

No current product defect was observed in this pass. The historical contrast
defect is closed. Production sign-off still requires live CI/Pages verification
and a decision on enforcing the macOS visual baseline outside local QA.
