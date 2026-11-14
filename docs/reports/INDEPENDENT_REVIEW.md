# Independent Review

**Current status: LOCAL DELIVERABLE / REMOTE BLOCKED**

| Item | Value |
|---|---|
| Initial review | 2026-11-14 19:39 CST |
| Final re-review | 2026-11-14 20:23 CST |
| Branch | `codex/product-rebuild` |
| Online baseline | `origin/main` at `8594a6b807de8f5e5860353929dde92be0c46d6c` |
| Remote reconstruction branch | Not present; `origin` exposes only `main` |
| Reviewed app | `http://127.0.0.1:8771/` |
| Product code modified by reviewer | None |
| Report added by reviewer | `docs/reports/INDEPENDENT_REVIEW.md` only |

## Current Re-review Verdict

The three previously identified P1 product risks were rechecked against the
current source and 8771 browser build:

| Original P1 | Current result |
|---|---|
| Compare claimed a false matched-year count | **CLOSED**. The selector now generates only years whose issue count contains the selected sequence. Browser rows equal the displayed count: `130 -> 22`, `153 -> 13`, `154 -> 7`. The default now uses the latest actual sequence, not a made-up next issue. |
| Sticky clone hid keyboard focus | **CLOSED**. The real header button mirrors a `clone-focus` class and visible 2 px outline into the clone. Independent screenshot and desktop/mobile E2E confirm the focus ring is visible. |
| Scheduled update could succeed with no current draw | **CLOSED**. Scheduled runs now use `--require-new`, 22:10 Asia/Shanghai, and `LOTTERY_PAUSE_UNTIL`. The post-merge assertion and partial-backfill regression test pass. |

The subsequent blocking findings are now closed:

| Finding | Current result |
|---|---|
| Ruff CI gate failed with 16 errors | **CLOSED**. `.venv/bin/ruff check scripts tests/python` passes, and `npm run check` now includes `lint:python` at `package.json:10-13`. |
| Partial backfill bypassed `--require-new` | **CLOSED**. The expected-draw assertion now runs after merge for every `--require-new` run at `scripts/fetch_latest.py:332-334`; `tests/python/test_fetch_logic.py:62-68` covers the partial-backfill case. |
| Vue POC lockfile referenced `/tmp` | **CLOSED**. No `/tmp` or `ssq-vue-poc` path remains; `pocs/vue-table/node_modules` is not a symlink, and `npm ci && npm run build` passes with Vue `3.5.45` and Vite `7.3.8`. |

Current final local checks:

- `npm run check`: PASS, including Ruff, TypeScript, ESLint, 5 unit tests, and
  20 Python tests.
- `.venv/bin/pytest tests/python -q`: PASS, 20 tests.
- `npm run test:schema`: PASS, 30 data files.
- `.venv/bin/python scripts/verify_data.py`: PASS, 0 errors, 0 warnings.
- Main Chrome Playwright matrix: **30 passed, 2 deliberate skips**.
- Visual baseline selection: included in the main matrix; 2 target comparisons
  pass and the 2 non-target project entries skip.
- WebKit mobile cross-browser smoke: PASS.
- Firefox local smoke: `BLOCKED` at browser launch because Playwright cannot
  create a Firefox profile; the page test never starts. Reinstall and
  `TMPDIR=/tmp` retry produced the same environment failure.
- `npm audit --audit-level=high`: PASS, zero reported vulnerabilities.

**Local delivery decision: 本地可交付，远端 BLOCKED.**

No local P0 or P1 remains after this recheck.

## Remaining P1 / P2

### P1

None.

### P2

1. **Visual baselines are skipped in CI.** `tests/e2e/visual.spec.ts:30-31`
   skips CI and non-macOS runners. They pass locally, but GitHub Actions does
   not enforce them.
2. **Firefox evidence remains unavailable locally.** WebKit passed; Firefox
   could not launch because Playwright failed to create its profile. Remote CI
   remains the authoritative place to execute it after push.

The remote data-update, CI, and Pages workflows remain `BLOCKED` because this
branch has not been pushed. No remote Action success or production deployment
is claimed.

## Historical Audit Record

The detailed findings below retain the original 19:39 review as evidence of
what changed. Their “current” wording describes that earlier snapshot; the
current re-review verdict above supersedes the earlier conclusion.

## Historical Evidence Baseline (Superseded)

Commands executed against the current worktree:

| Check | Result |
|---|---|
| `npm run check` | PASS: TypeScript, ESLint, 5 unit tests, 16 Python tests |
| `.venv/bin/pytest tests/python -q` | PASS: 16 tests |
| `npm run test:schema` | PASS: 29 data files |
| `.venv/bin/python scripts/verify_data.py` | PASS: 0 errors, 0 warnings |
| `python3 scripts/verify_data.py` | PASS with warning: system Python cannot import `jsonschema` |
| `npx playwright test --config=/tmp/ssq-review-playwright.config.mjs` | PASS: 28/28 desktop/mobile tests |
| `npm audit --audit-level=high` | PASS: 0 reported vulnerabilities |
| Workflow YAML parsing | PASS: 4 files parse |
| Data sources | PASS: 500.com and CWL both returned 2026101-2026130; 30/30 common records match |
| Remote Actions / Pages | `BLOCKED`: current branch is not on `origin`; live Pages still serves the pre-reconstruction title |

`ruff` and `pip-audit` are not installed in the local virtual environment.
Their configured CI steps have therefore not been executed locally; remote CI
execution remains `BLOCKED`.

Independent browser measurements at 1440x1000:

- Startup to 50 rendered rows: 564 ms.
- DOM structure: 58 columns and 2,900 default table cells.
- Full history: 3,527 rows, 204,566 cells, 448,311 DOM nodes, 1,623 ms.
- Page width stayed at 1,440 px with no body-level horizontal overflow.
- Console and page-error capture was empty.

Data baseline:

- 3,527 unique draws in 24 annual files, 2003-02-23 through 2026-11-12.
- Latest issue `2026130`; red `[1,2,6,16,20,28]`; blue `2`.
- All 24 annual history files match the protected record fingerprints and the
  baseline checksum file.
- `latest`, `stats`, `manifest`, and `history_index` are mutually consistent.

## Findings

### P0

None found.

### P1: Compare reports the wrong number of matched years

`web/js/filter-bar.js:237` sets `matched` to the number of requested issue
strings, not the number of records that actually exist. The same file displays
that value at `web/js/filter-bar.js:254-256`. `loadIssues()` silently removes
missing years at `web/js/data-loader.js:217-220`, while the page-level summary
correctly uses the loaded row count at `web/js/main.js:107-110`.

Independent browser evidence:

| Selected sequence | Panel says matched | Rows actually rendered |
|---|---:|---:|
| 130 | 24 | 22 |
| 153 | 24 | 13 |
| 154 | 24 | 7 |

The same screen therefore says both “对齐 24 个历史年份” and “已匹配 22 个年份”.
This is incorrect data analysis UI and blocks approval.

The E2E test misses it because `tests/e2e/app.spec.ts:104-111` only checks that
the summary exists, that one badge says `第 130 期`, and that rows are non-zero.
It does not compare the panel count with the rendered count.

There is also a year-end edge case: `web/js/filter-bar.js:15-19` increments the
numeric issue directly. On the final issue of a year, it produces a sequence
beyond the available option range. For example, after sequence `154`, it
requests `155`, which does not exist in any annual file and would open Compare
with no rows.

### P1: The sticky header clone hides keyboard focus

The table headers contain real buttons (`web/js/trend-table.js:33-49`), as
required for keyboard access. However, `web/js/trend-overlay.js:87-93` creates
an opaque clone above them, and `web/css/trend-table.css:7-17` gives that clone
`z-index: 40`. The clone's buttons are removed from the tab order, while the
real buttons remain underneath and receive focus.

The focused real button has a computed `2px` outline, but that outline is
painted below the opaque clone. The independent screenshot
`/tmp/ssq-review-header-focus.png` shows no visible focus indicator on the
focused red-ball header button. This fails visible-focus requirements and makes
the keyboard alternative difficult to use.

Axe does not detect this because the focused control exists and its computed
style contains an outline; the defect is occlusion, not absence.

### P1: A scheduled update can be green while a draw is missing

The update schedule remains Tuesday/Thursday/Sunday at 21:15 Asia/Shanghai
(`.github/workflows/update-data.yml:12-14`). The removed workflow comment
previously documented source synchronization at 21:30-22:00, so 21:15 remains a
known timing risk.

More importantly, the fetcher does not know which draw should exist. When both
sources return the same older 30 issues, `scripts/fetch_latest.py:300-302`
returns success because no new issue was found. The workflow still proceeds
through calculation and validation at `.github/workflows/update-data.yml:109-119`,
and freshness only fails after 30 days at `scripts/verify_data.py:228-236`.

Consequently, a run on a draw day can finish green without the current draw and
without creating a commit. The source outage path is fixed; the stale-source
path is not.

### P2: Acceptance state and Harness records are contradictory

`docs/reports/QA_REPORT.md:3` still says `FAIL / REVIEW_REQUIRED`, while
`docs/reports/QA_REPORT.md:5-9` adds a later “28/28 passed” note without
updating the status or verdict. The same document still says “Gate 7 is not
passed” and “Accessibility gate FAIL” at its end.

`docs/harness/tasks.json:142-154` leaves QA `IN_PROGRESS`;
`docs/harness/tasks.json:172-199` leaves independent review and final acceptance
`PENDING`. `docs/reports/FINAL_ACCEPTANCE.md`, which the task requires, does not
exist.

The current evidence does not justify final acceptance, but the records should
still reflect the actual gate state and reviewer decision.

### P2: Baseline metadata is not self-verified

`web/data/history_baseline.json` contains `record_count` and
`records_sha256`, but `scripts/manifest.py:83-101` verifies only the per-issue
map. It never checks that the metadata count and digest match the protected
record set.

A read-only probe changed `record_count` to `1` and `records_sha256` to 64 zeroes
in a temporary baseline copy; `verify_history_against_baseline()` still returned
no errors. Record-level change and missing-year protection work, but damage to
the baseline's own meta-integrity is not detected.

### P2: Documented Python commands bypass the documented virtual environment

README setup installs dependencies into `.venv` at `README.md:113-119`, but the
pipeline commands at `README.md:140-143` call bare `python3`. The same mismatch
exists in `docs/development/GETTING_STARTED.md:17-23` and `:47-54`.

In this environment, bare `python3` had neither `requests` nor `jsonschema`.
The fetch path therefore cannot run as documented, and the data gate silently
skips Python schema validation. The onboarding report used
`.venv/bin/python`, but the primary project instructions do not.

### P2: Data provenance is generic rather than source-specific

`scripts/calc_all.py:256-266` writes the fixed source string
“Public lottery issue records”. `scripts/manifest.py:104` uses the same generic
default. The UI therefore cannot tell users whether the data was supplied by
500.com, the official CWL API, or a cross-checked combination.

The source adapters currently work, but the required source traceability is not
propagated into generated data or visible metadata.

### P2: Visual regression is manual, not automated

Playwright captures screenshots only on failure
(`playwright.config.ts:17-19`). There is no `toHaveScreenshot()` baseline and no
committed visual snapshot fixture. The existing screenshots are useful current
evidence, but they cannot catch later pixel/layout regressions.

`package.json:17` exposes `test:e2e:update` even though the suite has no visual
snapshot assertions.

### P2: Architecture POC evidence is not reproducible from the repository

The ADR documents a measured Vanilla/Vue POC at
`docs/architecture/TECHNICAL_DECISIONS.md:47-69`. The POC source still exists
under `/tmp/ssq-vue-poc`, not in the repository. The POC also loads only
`2026.json` (`/tmp/ssq-vue-poc/src/main.js:4`) despite having a “Render 3527”
button. The 50-row comparison is valid evidence for that slice, but the complete
POC cannot be reproduced after `/tmp` is cleared, and it does not exercise a
full-history Vue table.

This does not invalidate the conservative Vanilla decision, but the evidence
packet is weaker than the ADR implies.

### P2: Supply-chain controls are partly mutable

All GitHub Action references use mutable major tags, for example
`.github/workflows/ci.yml:27-30` and `.github/workflows/ci.yml:172-189`.
`requirements.txt` uses version ranges rather than a generated lock file, and CI
installs an unpinned `pip-audit` at `.github/workflows/ci.yml:181-186`.

`npm audit` currently reports zero vulnerabilities and `npm ci` is lockfile
based, but Python dependency reproducibility and Action pinning remain weaker
than the rest of the engineering baseline.

### P2: Browser support claims exceed executed coverage

README claims current Chrome, Edge, Firefox, and Safari support at
`README.md:225-229`. The real Playwright configuration exercises Chrome only,
with desktop and mobile projects at `playwright.config.ts:29-41`.

Chrome evidence is good. WebKit/Firefox behavior, especially sticky layers,
SVG coordinates, and touch scrolling, remains unverified.

### P2: Mobile hides core dataset scale

`web/css/responsive.css:188-194` hides both historical sample count and coverage
years below 760 px, leaving only freshness status. The mobile layout is clean,
but users lose the dataset-scale context required by the product overview.

### P3: Omission text remains unusually small

The contrast fix passes: independent measurement found a 5.67:1 light-theme
ratio, and Axe passed light and dark trend/insight states. However, omission
numbers are 9 px desktop (`web/css/trend-table.css:233-236`) and 8 px mobile
(`web/css/responsive.css:254-256`). This is readable in the screenshot but
strains a data-dense mobile workflow.

### P3: Insights data is session-stale after first render

`web/js/insights.js:187-190` renders once and skips later mounts unless
`force` is supplied. No caller forces a refresh, so a same-session data update
requires a full page reload.

## Focused Recheck of Recent Fixes

| Recent fix | Verdict | Evidence |
|---|---|---|
| Omission contrast | PASS | `--text-4` yields 5.67:1 on white; Axe passes light/dark and both views |
| Synchronized sticky header | PASS for pixels/paint | Source and clone cell left/width deltas were 0 px at 1440, 1280, 768, 390, and 375; new covered-row paint assertion passes |
| Sticky header accessibility | FAIL | Opaque clone hides the real header button focus outline |
| Compare selector | PARTIAL | 001-154 are selectable and load rows, but displayed matched count is false and year-end rollover is broken |
| Dynamic E2E data | PARTIAL | Latest issue, year count, and full-history total are data-driven; Compare still hardcodes `130` and does not verify count consistency |

## Architecture and Security Review

The selected Vanilla ES module architecture is proportionate for this product.
It avoids a runtime framework and build step, keeps the JSON contract direct,
and performs acceptably at the current dataset size. Full-history rendering is
heavy at roughly 448k nodes but remains usable and explicitly limited to opt-in
use.

Module boundaries are generally clear: data loading, state, filtering, table
rendering, SVG overlay, drawer, insights, and theme are separated. No duplicate
framework-sized abstraction was found.

The data path inserts record content with text nodes rather than untrusted
HTML. The GitHub link uses `target="_blank"` with `noopener noreferrer`. Cache
parsing and local storage access are guarded. No direct XSS sink, user input,
secret, or backend attack surface was found.

The main security weaknesses are mutable CI Actions, unpinned Python tooling,
and the lack of remote verified execution, not a demonstrated application
vulnerability.

## Deployment and Delivery State

`origin/main` is still `8594a6b`. No remote `codex/product-rebuild` branch
exists, and the reconstruction remains a large uncommitted worktree.

The live Pages site is reachable, but it still serves the old product title
`双色球走势图 · ssq-hub`, not this reconstruction. Therefore:

- Remote `ci.yml`, data update, repair, and Pages workflows: `BLOCKED`.
- Production deployment of this reconstruction: `BLOCKED`.
- Repository About/topics/homepage update: `BLOCKED`.
- Live-browser acceptance against production: `BLOCKED`.

The local Pages workflow gate design is materially better than the old
author/message heuristic. YAML and local shell review did not reveal a
deployment-race defect. Remote execution is still mandatory before release.

## Gate Assessment

| Gate | Result | Reason |
|---|---|---|
| Architecture / technology choice | PASS with evidence caveat | Vanilla chosen; POC is sufficient for default table slice but not retained in repo |
| Data integrity | PASS at record level | 3,527 records, protected hashes, deterministic stats, dual-source 30/30 match |
| Data update reliability | FAIL | Expected-draw absence can still produce a green no-op |
| Frontend functionality | PARTIAL | Core workflows work; Compare count is wrong and year-end rollover breaks |
| Theme / contrast | PASS | Light/dark Axe and measured contrast pass |
| Responsive layout | PASS | Five widths and no page overflow; mobile hides two overview metrics |
| Accessibility | FAIL | Sticky clone hides visible focus on number header controls |
| Performance | PASS | 564 ms default and 1.6 s full history locally |
| README / AGENTS consistency | PARTIAL | Good structure and security rules; Python environment instructions and status docs need correction |
| CI/CD workflow execution | BLOCKED | Not pushed; new workflows have never run remotely |
| Pages deployment | BLOCKED | Live site is still the old application |
| Final acceptance | FAIL / BLOCKED | Required report missing; P1 findings unresolved; remote evidence absent |

## Required Rework Before Final Delivery

1. Make Compare report actual loaded matches and add an E2E assertion that panel
   count equals rendered rows for partial sequences.
2. Replace numeric next-issue increment with the existing cross-year issue logic
   or otherwise handle the final issue of a year.
3. Make keyboard focus visible on the number header buttons while retaining the
   synchronized paint layer.
4. Add an expected-draw/holiday-aware stale-update gate so a scheduled run cannot
   succeed while the expected current issue is absent.
5. Correct the Python commands to activate `.venv` or use `.venv/bin/python`.
6. Reconcile QA status, Harness task state, and final acceptance evidence.
7. Verify baseline `record_count`/`records_sha256`, propagate actual source
   provenance, and add at least one automated visual baseline.
8. Commit and push only after authorization, then verify remote Actions and the
   deployed Pages SHA before claiming release completion.

## Final Reviewer Decision

**Do not approve final delivery.**

The local implementation is close enough to continue QA/repair work, but P1
user-visible/accessibility/data-update defects remain, and all remote delivery
evidence is `BLOCKED`. No claim of Actions success, Pages deployment, or final
product acceptance is supported by the current state.
