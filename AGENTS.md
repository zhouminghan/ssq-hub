# AGENTS.md

This is the single authoritative instruction file for coding agents working on
SSQ Hub. The former `AGENT.md` has been merged here and removed to prevent
conflicting rules.

## Product

SSQ Hub is a static, data-dense web product for exploring Chinese Double Color
Ball historical draws. It is not a prediction, recommendation, betting, or
financial product. User-facing copy must consistently say that history does not
predict the future.

Live site: <https://zhouminghan.github.io/ssq-hub/>

Repository: <https://github.com/zhouminghan/ssq-hub>

## Architecture

```text
public sources
  -> Python fetch / merge / validation
  -> protected annual JSON history
  -> deterministic statistics and manifest
  -> browser data service with CDN + local-cache fallback
  -> vanilla ES module views
  -> GitHub Pages
```

The production runtime intentionally has no server, database, framework
runtime, or build step. The 58-column table renders directly from the DOM.
Framework migration is not allowed without a measured ADR that demonstrates a
real product benefit.

Key boundaries:

- `scripts/`: ingestion, schema, statistics, manifest, quality gate.
- `web/data/`: generated and protected data. Never hand-edit draw records.
- `web/js/`: browser behavior. Keep data access, state, rendering, and theme
  concerns in their existing modules.
- `web/css/`: design tokens and component styles. Keep responsive overrides in
  `responsive.css`.
- `tests/python/`: data and pipeline tests.
- `tests/unit/`: pure browser-module tests.
- `tests/schema/`: JSON Schema validation.
- `tests/e2e/`: real-browser product tests.
- `schemas/`: formal JSON Schema 2020-12 contracts.
- `docs/architecture/`: system and data design.
- `docs/development/`: commands and onboarding.

## Protected Data Rules

1. Never hand-edit `web/data/history/*.json`.
2. Normal updates are append-only.
3. Existing issue content may change only through
   `.venv/bin/python scripts/fetch_latest.py --allow-corrections --reason "..."`, with
   source evidence recorded in `web/data/corrections.json`.
4. A human must review corrections before
   `.venv/bin/python scripts/update_baseline.py`.
5. Never regenerate the complete historical dataset without a checksum-backed
   backup and explicit review.
6. A missing year, duplicate issue, modified protected record, invalid date,
   or invalid ball must fail the quality gate.
7. Full statistics recomputation is intentional. It currently takes
   milliseconds and is more reliable than an incremental state machine.
8. Generated writes must use `write_if_changed()` and preserve
   `generated_at` when content is unchanged.

## Data Sources

Supported fetch sources:

- 500.com public HTML history table.
- China Welfare Lottery official JSON API.

The two sources are cross-checked when both respond. A conflict blocks the
write. `idcd.com` was removed because it returned 404 HTML during verification.

## Commands

```bash
# Python environment
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock

# Local application
npm install
npm run dev

# Quality
npm run typecheck
npm run lint
npm run test:unit
npm run test:python
npm run test:schema
.venv/bin/python scripts/verify_data.py
npx playwright test

# Data pipeline
.venv/bin/python scripts/fetch_latest.py
.venv/bin/python scripts/calc_all.py
.venv/bin/python scripts/verify_data.py
```

`npm run dev` serves `web/` at `http://127.0.0.1:5173`.

## Frontend Rules

- Keep the application usable without a backend.
- Preserve all 58 trend columns: issue, 33 red, 16 blue, 8 structure columns.
- Preserve frozen issue column and sticky table header.
- Preserve horizontal and vertical internal scrolling.
- Preserve blue-ball SVG connection.
- Preserve recent-5 highlight and latest-draw positioning.
- Preserve recent N, year, and cross-year comparison filters.
- Do not introduce framework runtime without an accepted ADR.
- Use semantic HTML and native controls before custom widgets.
- Every icon-only control needs an accessible name.
- Numeric cell interactions must have a keyboard-accessible header alternative.
- The drawer must handle Escape, focus entry, focus return, and mobile full-width
  layout.
- Respect `prefers-reduced-motion`.

## Theme Rules

- Modes are exactly `auto`, `light`, and `dark`.
- Persist explicit choices in `localStorage.theme`.
- Apply theme before first paint using the inline boot script.
- Auto mode must follow `prefers-color-scheme` changes.
- Use tokens from `theme.css`; do not scatter hard-coded theme colors.
- Check both themes for red/blue ball contrast, table hover, fixed columns,
  menus, focus rings, drawers, charts, and scrollbars.
- Do not use pure black plus pure white as the default dark palette.

## UI Quality Bar

- Verify 1440, 1280, 768, 390, and 375 CSS pixels.
- The page itself must not overflow horizontally; only the table/filter may
  scroll internally.
- No overlapping text or controls.
- Data is the primary visual signal; avoid decorative dashboards and oversized
  hero sections.
- Cards are only for repeated insights, dialogs, or real tools.
- GitHub entry must open the repository safely in a new tab.

## Testing Rules

- A successful build, syntax check, or Python script alone is not acceptance.
- Changes to data logic require Python tests and `scripts/verify_data.py`.
- Changes to data contracts require `tests/schema/validate-data.mjs`.
- Changes to browser behavior require Playwright desktop and mobile checks.
- Changes to theme, layout, or interactions require real screenshots.
- Do not alter expected results to hide a real defect.
- Failed quality gates block commit and deployment.

## Git And Release Rules

- Work on a non-main branch unless the user explicitly requests otherwise.
- Never push, merge, release, rewrite history, or change repository settings
  without explicit user authorization.
- Never discard user changes or revert unrelated files.
- Inspect `git diff` before committing.
- GitHub Actions are the only production data writer.
- Update workflow must verify before fetch, verify after calculation, commit
  only `web/data/`, and deploy only after success.
- Pages deployment must be based on actual commit/file differences, not author
  names or commit-message heuristics.

## Agent Roles

- Delivery lead owns task state, integration, gates, and final acceptance.
- Product/UX owns capability parity, responsive behavior, and accessibility.
- Architect owns ADRs, module boundaries, and measured technology choices.
- Data engineer owns source integrity, schemas, statistics, and corrections.
- Frontend engineer owns views, data service, theme system, and interactions.
- DevOps engineer owns workflows, idempotency, failure recovery, and deploy.
- QA owns layered tests, browser evidence, screenshots, and performance.
- Independent reviewer reads source and evidence, does not rely on developer
  claims, and blocks delivery on P0/P1 issues.

## Completion

Do not mark work complete while a required gate is failed or silently skipped.
Use `BLOCKED` for missing permissions or unavailable external evidence. Never
claim live deployment, Actions success, or repository settings changes without
verified evidence.
