# Baseline Report

Captured on 2026-11-14 from the latest online commit after
`git fetch --prune origin` and `git pull --ff-only origin main`.

## Repository State

- Remote: `https://github.com/zhouminghan/ssq-hub.git`
- Branch at capture: `main`
- Commit: `8594a6b807de8f5e5860353929dde92be0c46d6c`
- Commit date: `2026-11-12T20:51:10Z`
- Latest data commit: `chore(data): 自动更新 @ 2026-11-13 04:51 北京时间 [incremental]`
- Working tree before reconstruction: clean
- Reconstruction branch: `codex/product-rebuild`

## Existing Product

- Static GitHub Pages application with no backend.
- Vanilla ES modules and CSS; no package manager, build step, or frontend test suite.
- Six Python data scripts using the standard library plus `requests`.
- Two GitHub Actions workflows: scheduled data update and Pages deployment.

## Data Baseline

- 24 annual JSON files from 2003 through 2026.
- 3,527 draw records.
- 3,527 unique issue numbers.
- Date range: 2003-02-23 through 2026-11-12.
- Latest issue: 2026130, red `[1, 2, 6, 16, 20, 28]`, blue `2`.
- Repository size at baseline: approximately 1.5 MB.
- Data directory size: approximately 584 KB.

Measured locally:

```text
history load: 4.99 ms
stats calculation: 7.55 ms
```

These timings are single-run local observations, not production benchmarks.

## Verification Baseline

`python3 scripts/verify_data.py` passed with these observations:

```text
history_index.json: 3527 issues, 24 years
history files: 24, 3527 issues, 0 malformed records
stats.json: total=3527, latest=2026130
latest.json: latest=2026130
project structure: JS=10, CSS=8, Data=24, Py=6, CI=2
```

The pre-reconstruction verifier did not use a formal JSON Schema, did not
independently recompute every statistic, and treated duplicate issue numbers as
a warning rather than a hard failure.

## Protected Data

All files under `web/data/` are protected historical data. The full SHA-256
baseline is stored in `docs/reports/baseline-sha256.txt`. Reconstruction must
not delete, reorder, or rewrite historical draw records.

## Known Baseline Gaps

- No package/dependency lock for frontend tooling.
- No TypeScript checking, linting, unit tests, or E2E tests.
- No formal schema files or cross-field date/issue validation.
- No source/pipeline provenance in generated data.
- No data freshness status in the UI beyond the latest issue.
- No GitHub repository entry in the application header.
- `workflow_run` deployment behavior depends on a checkout ref and commit-message heuristic.
- Repository About, Topics, Homepage, and Pages settings require authenticated GitHub access.

## Visual Evidence

Real-browser baseline screenshots were generated from the local static server:

- `/tmp/baseline-desktop-light.png`
- `/tmp/baseline-desktop-dark.png`
- `/tmp/baseline-mobile-light.png`
- `/tmp/baseline-mobile-dark.png`

Ephemeral `/tmp` screenshots will be copied into the repository during final QA.
