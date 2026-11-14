# UX and Cross-Year Boundary Review

Date: 2026-11-14

Scope: read-only independent review of the current uncommitted increment on
`codex/product-rebuild` from `afc77bd`. The review covered light-theme tokens,
the 375px filter layout, the number-profile drawer, CDN/cache/failure states,
browser next-draw calculation, Python pause/retry logic, push reconciliation,
documentation, and the new pause-window schema.

No product code was changed by this review. This report is the only file added.

## Verdict

**Local delivery: NOT READY / REVIEW_REQUIRED.**

No P0 was found. Browser rendering and the main product workflows are usable,
but two P1 issues block delivery:

1. The current quality gate itself fails in both TypeScript and ESLint.
2. Official pause handling does not skip network access for monthly/manual
   `full` runs, so the update Action can still fail during a declared pause.

The current uncommitted changes also have no remote CI evidence. This verdict
does not make any claim about GitHub Actions or Pages.

## Verification Evidence

| Check | Result | Evidence |
|---|---|---|
| `npm run check` | **FAIL** | TypeScript rejects `format.test.js:46` |
| `npm run typecheck` | **FAIL** | `TS2345`: `Buffer` passed where `string` is required |
| `npm run lint` | **FAIL** | `'URL' is not defined` at `format.test.js:46` |
| `npm run lint:python` | PASS | Ruff, zero findings |
| `npm run test:unit` | PASS | 7/7 |
| `npm run test:python` | PASS | 45/45 |
| `npm run test:schema` | PASS | 31 data files |
| `scripts/verify_data.py` | PASS | 3,527 draws, 24 years, 0 errors, 0 warnings |
| `npx playwright test` | PASS | 32 passed, 2 project-specific skips, 0 failed |
| WebKit mobile smoke | PASS | 1/1 |
| Firefox local smoke | BLOCKED | Browser fails before page launch: cannot find profile folder |
| Workflow YAML parsing | PASS | All four workflows parse |
| `git diff --check` | PASS | No whitespace errors |

The main Chrome/Playwright run exercised real pages at `http://127.0.0.1:5173`
for desktop and mobile, including layout, filters, drawer, themes, accessibility,
CDN fallback, browser cache, and total-network-failure states.

Independent 375px browser measurements:

- Page width: `375`, filter client width: `375`, filter scroll width: `375`.
- Custom and Reset controls both end at `x=363` and are 40px high.
- Compare mode fits without page overflow; the panel and rendered rows both
  report 22 matched years for sequence 130.
- The settled profile drawer is exactly 375px wide.
- Close target is 42x42px.
- Profile frequency value has `clientWidth=scrollWidth=132`.
- Insights and drawer states had no page or Console errors.

Measured light/dark contrast examples:

| Pair | Ratio |
|---|---:|
| Body text on card | 16.27:1 |
| Secondary text on card | 7.70:1 |
| Muted numeric text on card | 5.67:1 |
| White on red ball | 5.53:1 |
| White on blue ball | 5.55:1 |
| Dark body text on card | 15.32:1 |
| Dark muted text on card | 6.59:1 |

## Findings

### P0

None.

### P1: Current quality gate fails

`tests/unit/format.test.js:45-47` passes the result of `fs.readFileSync()` with
no encoding to `JSON.parse()`. TypeScript correctly treats that result as a
`Buffer`, while `JSON.parse()` requires a string. The same line uses `URL`
without a Node import, and the repository ESLint globals do not include it.

Reproduction:

```text
npm run check
  -> tests/unit/format.test.js(46,5): error TS2345

npm run lint
  -> tests/unit/format.test.js(46,25): error 'URL' is not defined
```

This blocks both local acceptance and the frontend job in
`.github/workflows/ci.yml:85-99`. The existing `QA_REPORT.md` claim that
`npm run check` passes is no longer true.

Required fix:

- Read the file as UTF-8, for example `fs.readFileSync(url, 'utf8')`.
- Import `URL` from `node:url`, or explicitly configure the Node global.
- Re-run `npm run check` and the full browser matrix.

### P1: A declared pause does not prevent every update job from using the network

`scripts/fetch_latest.py:473-485` checks the active pause only when
`expected_date` is not `None`. `expected_date` is set only when
`--require-new` is present and the current runtime day is Tuesday, Thursday, or
Sunday. Monthly `full` and normal manual `workflow_dispatch` runs invoke the
fetcher without `--require-new` at `.github/workflows/update-data.yml:94-117`.

Therefore a full/manual run during a configured pause still contacts both
sources. The monthly cron at `.github/workflows/update-data.yml:14` lands inside
the configured 2026 National Day pause (`2026-10-01..04`). If both sources are
unavailable then, the Action fails despite the declared market closure.

Independent probe with a simulated `2026-02-17` Spring Festival pause and no
`--require-new` observed one `fetch_latest_draws()` call.

This contradicts:

- `.github/workflows/update-data.yml:8-10`
- `README.md:158-161`
- `docs/architecture/DATA_PIPELINE.md:18-23`

Required fix:

- Evaluate the active pause before deciding whether to fetch, independent of
  `--require-new`.
- Make all update-data modes exit successfully before network access while a
  pause is active.
- If repair workflows must be able to override a pause, require an explicit
  opt-in flag rather than making all non-required-new runs fetch.
- Add a regression test for pause plus monthly/full/manual mode.

### P2: A delayed scheduled run can still pass without the expected draw

`scripts/fetch_latest.py:473-474` derives the expected draw from the runtime's
current date. If a Tuesday run is heavily delayed and starts after midnight,
Wednesday is not in `DRAW_WEEKDAYS`; `expected_date` becomes `None`, stale source
data is accepted by `fetch_with_retry()`, and `assert_expected_draw()` returns
without failing.

Independent probe simulated a stale `2026130` result on Wednesday
`2026-11-18`; it was accepted as `2026130 / 2026-11-12`.

Recommendation: derive the expected date from the scheduled workflow instance
or the last eligible draw time, not only from the process's current weekday.
Add a delayed-after-midnight regression test.

### P2: The next-draw label presents an estimate as definite

The dashboard renders `下期 <issue> · <date>` at `web/js/dashboard.js:24-26`.
It does not communicate that the date is estimated, and it ignores the
`provisional` flag already present in
`web/config/lottery_pause_windows.json:18-24`.

If the shared pause configuration cannot load,
`web/js/data-loader.js:220-223` silently returns an empty window list. The page
then displays a normal weekly estimate with the same confident wording. During
the provisional 2027 Spring Festival window, users see a concrete date without
being told that the lottery-market notice is still pending.

Recommendation:

- Use wording such as `预计下期`.
- Expose a compact provisional/configuration status when applicable.
- If pause configuration is unavailable, either omit the date or label it as
  unverified immediately, not only in a Console warning and title tooltip.

### P2: Data-source state is sticky for the whole session

`web/js/data-loader.js:46-59` keeps `usedCache` and `usedCdn` true after the
first fallback. A later successful primary request does not clear them, so the
dashboard can continue to say `本地缓存` or `备用镜像` even when the current
request has recovered. The title can also state that network sources are
unavailable after a subsequent network success.

Recommendation: track the current successful source separately from the
session's worst/degraded state, and phrase historical degradation explicitly
if it is intentionally retained.

### P2: Acceptance and troubleshooting documents are stale

- `docs/reports/QA_REPORT.md` reports the old 25-test check and 30 schema files
  as passing. The current tree has 7 unit tests, 45 Python tests, and 31 schema
  files; `npm run check` currently fails.
- `docs/development/TROUBLESHOOTING.md:34-37` and
  `docs/architecture/DATA_FLOW.md:47-49` still refer to the old visible label
  `使用本地缓存`; the current UI uses `本地缓存`.

This is release-evidence drift, not a browser rendering defect. Update the
documents only after the P1 quality gate is repaired and re-run.

### P3: Monthly maintenance UTC comment is off by one day

`.github/workflows/update-data.yml:5-6` describes the first day at 02:00
Asia/Shanghai, but the cron `0 18 1 * *` runs at 18:00 UTC on the first day,
which is 02:00 Asia/Shanghai on the second day. This does not break draw-day
updates, but the schedule and comment disagree.

### P3: Cross-field pause constraints are runtime-only

`schemas/pause-windows.schema.json` validates item shape and date format but
cannot directly enforce unique IDs, `start <= end`, or non-overlap. The Python
loader enforces these rules, and the current tests invoke it for the checked-in
configuration. `scripts/verify_data.py` itself only runs the JSON Schema check.

Keep the runtime validation, but add a direct quality-gate call to
`load_pause_windows()` so deployment validation fails even if the Python test
suite is not used.

## Passing Areas

### Light theme

- New light tokens use a consistent neutral canvas/content/tool surface system.
- Table hover and auxiliary columns no longer introduce a beige data category.
- Red and blue remain reserved for ball semantics; gold highlights recent five
  draws.
- Desktop and mobile light screenshots are visually coherent.
- Measured primary text, muted numeric text, and ball labels exceed WCAG AA.
- Axe reported no serious or critical violations in light or dark views.

### 375px filters and views

- No page-level horizontal overflow.
- Custom, Reset, range selector, tabs, and theme trigger remain reachable.
- Compare summary fits inside the viewport and its count agrees with rendered
  rows.
- Mobile insights use the available width without clipped cards or labels.

### Number-profile drawer

- The drawer becomes full width at 375px after animation.
- The close target is 42px.
- Frequency values no longer wrap or overflow.
- Bar-state wording is visible.
- Escape, focus entry, focus return, and Axe checks pass.

### CDN, cache, and total failure

- Successful CDN fallback is visibly labeled `备用镜像`.
- Browser-cache fallback is visibly labeled `本地缓存` with a visible cache time.
- Total network failure changes the overview to `数据不可用` and shows one
  concise retry message.
- The E2E resilience tests pass on desktop and mobile.

### Frontend cross-year and pause calculation

- December 31 correctly advances to the next scheduled January draw.
- A next draw in a new year selects `YYYY001`.
- The 2026 Spring Festival window advances the next draw to February 24.
- The provisional 2027 window advances February 4 to February 14.
- The browser and Python updater both read the same checked-in window file.

### Python retry and partial backfill

- Empty, stale, and transiently conflicting source results retry three times.
- Retry exhaustion remains detectable and fails a required draw-day run.
- Partial backfill cannot satisfy the expected-today gate.
- Cross-year annual-file rotation and index rebuild pass.
- The 2027 provisional window is explicitly marked and injectable.

### Push conflict recovery

- Non-overlapping upstream commits are reconciled by fetch/rebase.
- Overlapping generated-data changes abort the rebase and leave upstream data
  untouched.
- All workflow files parse as YAML.

### Schema

- The pause-window schema is registered in both Ajv and Python verification.
- The checked-in configuration validates.
- Schema validation now covers 31 files.

## Local Delivery Decision

| Requirement | Decision |
|---|---|
| Light-theme redesign | PASS |
| 375px filter and no page overflow | PASS |
| Drawer copy, sizing, and accessibility | PASS |
| CDN/cache/failure communication | PASS with P2 state-recovery issue |
| Cross-year browser issue/date calculation | PASS |
| Pause-window shared configuration | PASS in shape; P1 execution gap in non-draw runs |
| Python retry and partial backfill | PASS |
| Push conflict simulation | PASS |
| Documentation and schema | Schema PASS; documentation drift remains |
| Full local quality gate | **FAIL** |

**Final result: do not deliver locally yet.** Fix the two P1 findings first,
then re-run `npm run check`, schema/data gates, and the complete Playwright
matrix. The P2 and P3 items should be resolved before final release acceptance,
but they do not excuse the currently failing quality gate.

## CURRENT FINAL

Review date: 2026-11-15

Reviewer: independent read-only review of the uncommitted increment on
`codex/product-rebuild`. The historical review above is retained unchanged as
evidence of the previous state. This section supersedes its verdict.

### Current Verdict

**Local delivery: PASS.** No P0 or P1 remains in the reviewed increment. The
three previously blocking issues are fixed and independently reverified:

1. The URL/Buffer test gate now passes TypeScript, ESLint and unit execution.
2. Full, incremental, scheduled and manual update modes all skip source-network
   access while an official pause window is active.
3. A scheduled run delayed past midnight still requires the most recent eligible
   draw day rather than accepting stale data.

Three P2 issues and three P3 gaps remain. None blocks local delivery, but the P2
items should be scheduled before the next product-quality pass. Remote Actions
and Pages verification remains **BLOCKED** because this uncommitted increment
has not been pushed.

### P0

None.

### P1

None.

### Previously Blocking P1s: Recheck

| Finding | Result | Independent evidence |
|---|---|---|
| URL/Buffer test gate | **FIXED** | `tests/unit/format.test.js` imports `URL` from `node:url` and reads the fixture with `utf8`; `npm run check` passes |
| Full/manual pause network access | **FIXED** | `scripts/fetch_latest.py:489-505` evaluates the active pause before creating the request session; direct probes of both `--require-new` and no-flag execution completed without calling the fetcher |
| Expected draw after midnight | **FIXED** | `expected_draw_date_for_run()` resolves Wednesday to Tuesday and Friday to Thursday; the Python regression test rejects stale pre-scheduled data |

The direct pause probe used a simulated 2026-02-22 Spring Festival run with the
fetcher patched to raise if called. Both scheduled-style and manual/full-style
arguments completed normally, and the fetcher was never invoked.

The delayed-run probe returned:

```text
2026-11-18 -> 2026-11-17
2026-11-20 -> 2026-11-19
2026-11-21 -> 2026-11-19
```

This covers the requested over-midnight case. The current helper intentionally
looks back only three days; a queue delay longer than that would fail open. That
is recorded below as a P3 robustness gap, not a P1.

### Additional Boundary Checks

| Area | Result | Evidence |
|---|---|---|
| Next-draw wording | **PASS** | Dashboard renders `预计下期`, with an estimate tooltip; no prediction/recommendation wording was introduced |
| Cross-year issue | **PASS** | A next date in a new year selects `YYYY001`; annual-file rotation and index rebuild pass |
| Pause-window schema | **PASS** | New JSON Schema validates; Python quality gate also invokes the semantic loader |
| Pause-window semantics | **PASS** | Inclusive dates, unique IDs, valid ordering, overlap rejection and no-real-draw checks pass |
| 2027 provisional configuration | **PASS at runtime** | February 5-13 is marked provisional and advances the next draw to February 14 |
| Retry and failure containment | **PASS** | Empty, stale and conflicting source responses retry three times; exhaustion fails non-zero and uploads diagnostics |
| Partial backfill | **PASS** | Adding older missing issues cannot satisfy the current draw-day requirement |
| Workflow schedule comment | **PASS** | Monthly UTC cron and the second-day Asia/Shanghai comment now agree |
| Push reconciliation | **PASS** | Update workflow attempts fetch/rebase/verify up to three times; non-overlapping recovery and overlapping-data abort are simulated |
| Workflow syntax | **PASS** | All four workflow files parse successfully |

### P2 Findings

#### P2: Session degradation remains sticky instead of describing the current load

`web/js/data-loader.js:46-59` records whether cache or CDN was ever used, but
`loadState.source` selects browser cache forever after the first cache hit.
A later successful CDN or primary request cannot change the prominent badge from
`本地缓存`. The title says that this happened during the session, but the badge
can still be read as the current source, especially on touch devices where the
title is unavailable.

Recommendation: keep two values, `currentSource` and `degradedThisSession`, and
render the current source in the badge. If retaining worst-state semantics is a
deliberate product choice, label it explicitly as `本会话曾降级` rather than
plain `本地缓存`.

This is a feedback/clarity issue. It does not invalidate the data being shown.

#### P2: Provisional pause status is not visible in the product

The checked-in 2027 Spring Festival window is correctly marked `provisional`,
and both browser and Python calculations use it. However, `provisional` is not
read or rendered by `web/js/`; users only see the generic `预计下期` label.
If pause configuration loading fails, `web/js/data-loader.js:220-223` logs a
Console warning and silently falls back to an empty window list.

Recommendation: expose a compact `临时保护窗口` or `官方休市公告待发布` status
when the next-draw calculation intersects a provisional window. When the shared
configuration cannot load, mark the estimate as unverified or omit the date.

The date calculation itself is correct, so this is not a P1.

#### P2: New secondary labels are still 9px on mobile

The mobile next-draw line is 9px at `web/css/responsive.css:166-173`, and
`overview-status-detail` is 9px at `web/css/layout.css:357-366`. Both labels
carry information users need to interpret freshness, source and the estimated
draw. This repeats the previous microtype risk in newly added content.

Recommendation: raise meaningful metadata to at least 11px. Decorative or
duplicated metadata may remain at 10px.

### P3 Findings

#### P3: The delayed-run helper fails open after a three-day lookback

`expected_draw_date_for_run()` checks only `today - 0..3`. GitHub queue delays are
normally far shorter, and the requested over-midnight cases are covered. A
four-day delay would return `None` and stop enforcing the missing-draw gate.

Recommendation: when practical, pass the workflow's scheduled timestamp or
workflow instance into the updater and derive the expected draw from that value.

#### P3: The holiday comment in `format.js` is stale

`web/js/utils/format.js:70-72` still says the function does not perform
holiday-window checks, while the code immediately below does. The implementation
and tests are correct; only the comment is misleading.

#### P3: Repair-workflow push recovery is less robust than normal updates

`update-data.yml` has three fetch/rebase/verify attempts. `data-repair.yml`
still has one retry and then fails. This is acceptable for a reviewed,
low-frequency repair, but the operational behavior is intentionally asymmetric
and should be documented or aligned in a later cleanup.

### Independent Verification

All commands below were run against the current uncommitted worktree.

| Check | Result |
|---|---|
| `npm run check` | **PASS**: TypeScript, ESLint, Ruff, 7 Node tests, 47 Python tests |
| `npm run test:schema` | **PASS**: 31 data/config files |
| `.venv/bin/python scripts/verify_data.py` | **PASS**: 3,527 draws, 24 years, 0 errors, 0 warnings |
| Main Playwright matrix | **PASS**: 30/30 executed tests |
| Visual Playwright matrix | **PASS**: 2 passed, 2 intentional project-specific skips |
| WebKit mobile smoke | **PASS**: 1/1 at 390x844 |
| Workflow YAML parsing | **PASS**: 4/4 files |
| `git diff --check` | **PASS** |

The first concurrent attempt to run main, visual and cross-browser commands in
parallel produced an artifact-file race and an `EPERM` server-bind contention.
Running the browser commands serially, with the same test configurations,
passed as recorded above. This was a review harness issue, not a product failure.

### Local Delivery Decision

| Requirement | Current decision |
|---|---|
| URL/Buffer quality gate | PASS |
| Pause suppression for every update mode | PASS |
| Pause schema and quality gate | PASS |
| 2027 provisional fail-safe configuration | PASS at runtime; P2 presentation gap |
| Delayed run after midnight | PASS |
| Cross-year update and issue calculation | PASS |
| Empty/stale/conflict retry and failure containment | PASS |
| Workflow comments and push recovery | PASS |
| Next-draw non-prediction wording | PASS |
| Session degradation communication | PASS functionally; P2 current-source ambiguity |
| Full local quality gate | PASS |

**Final result: local delivery is approved.** The remaining P2/P3 items do not
justify withholding the local increment. Remote acceptance remains blocked until
the increment is pushed and the resulting Actions, Pages deployment SHA and live
site are independently verified.

## Main-Controller Post-Review Addendum

The P2/P3 items recorded above were closed after the independent review:

- The next-draw estimate now says `预计下期` and appends `临时保护窗口` when the
  provisional 2027 pause changes the date, or `停售配置未校验` when the shared
  calendar cannot be loaded.
- Mobile next-draw and freshness detail text was raised to 11px.
- Session fallback copy explicitly says `本次已切换备用`; browser-cache detail
  remains visible instead of living only in a tooltip.
- Delayed-run lookback was extended across a full weekly cycle, removing the
  three-day fail-open gap.
- The stale `format.js` holiday comment was corrected.
- `data-repair.yml` now has the same three-attempt fetch/rebase/verify strategy
  as the normal updater.

Focused post-change verification:

- TypeScript, ESLint, Ruff and 7 Node unit tests passed.
- 35 fetch/calendar boundary tests plus Ruff passed.
- 10 desktop/mobile browser tests covering startup, five widths, total failure,
  CDN fallback and browser cache passed.
- Full Playwright run immediately before this small P2/P3 closure:
  32 passed / 2 visual-project skips.

This addendum records main-controller verification, not a replacement for the
independent review above. Remote Actions and Pages remain `BLOCKED` until push.
