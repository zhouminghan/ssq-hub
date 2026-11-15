# AGENTS.md

This is the single authoritative instruction file for coding agents working on
SSQ Hub.

## Product

SSQ Hub is a static, data-dense web product for exploring Chinese Double Color
Ball historical draws. It is not a prediction, recommendation, betting, or
financial product. User-facing copy must consistently say that history does not
predict the future.

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
- `tests/`: local-only test harness; ignored and never pushed.
- `schemas/`: formal JSON Schema 2020-12 contracts.
- `docs/ARCHITECTURE.md`: system, data, frontend and delivery design.
- Local Playwright, ESLint, TypeScript, npm and development-server files are
  intentionally ignored and do not belong in the remote repository.

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

The remote repository runs only data update and Pages deployment. Use local,
Git-ignored tooling for browser tests, linting, Python tests and development;
do not add those tools back to remote CI without a practical need.

## Frontend Rules

- Keep the application usable without a backend.
- Preserve all 58 trend columns: issue, 33 red, 16 blue, 8 structure columns.
- Preserve frozen issue column and sticky table header.
- Keep the restored reference table-header density: a 32px header row, 12px
  desktop labels, 80px desktop issue column, and an opaque two-tone header.
- Keep the footer centered and compact with public data-source links and the
  non-prediction disclaimer; do not turn it into a second navigation bar.
- Preserve horizontal and vertical internal scrolling.
- Preserve blue-ball SVG connection.
- Preserve recent-5 highlight and latest-draw positioning.
- Preserve recent N, year, and cross-year comparison filters.
- Filter select controls use the shared `select-field` wrapper with one custom
  chevron, a 36px desktop control and 44px touch target. Keep native `<select>`
  semantics and visible `focus-within` feedback.
- Main views must remain deep-linkable through `?view=trend|insights|notes`;
  browser back/forward and refresh must restore the selected view.
- Custom popovers and menus must expose expanded state, support Escape, close
  when keyboard focus leaves, and return focus to their trigger.
- Do not introduce framework runtime without an accepted ADR.
- Use semantic HTML and native controls before custom widgets.
- Every icon-only control needs an accessible name.
- Numeric cell interactions must have a keyboard-accessible header alternative.
- Number balls in the overview and insight frequency list must open the same
  number-profile drawer as the trend table; interactive balls must be native
  buttons with descriptive accessible names.
- Preserve the `研究笔记` view and keep its source files as Markdown under
  `web/content/notes/`. Render with the local safe parser; do not inject
  untrusted HTML or add a framework runtime for note rendering.
- Research-note cards are discovery indexes, not modal articles. Keep long-form
  notes in the inline reader with `?view=notes&note=<id>`; do not place formulas,
  tables, and charts inside a modal.
- Data-insight colors must carry meaning: red/blue structural series follow the
  established number semantics, gold marks pattern or recency signals, AC uses
  one ordered blue scale, and red/blue frequency bars match their ball type.
- Display math uses `$$ ... $$` blocks rendered by the vendored KaTeX MathML
  engine. Note charts use explicit `:::chart` directives backed by local DOM/CSS
  renderers, not remote image services.
- Horizontally scrollable note tables need keyboard focus and an accessible
  region name.
- On mobile, research-note reading uses one outer scroll region. Do not place
  the whole article in an `aria-live` region or create nested article scrolls.
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
- Browser, TypeScript, ESLint and unit-test commands are local development tasks;
  they must not be reintroduced into GitHub Actions or committed as local
  harness files.
- Changes to theme, layout, or interactions require real-browser inspection at
  the required viewports. Screenshots may be used as local temporary evidence,
  but must not be committed.
- Do not alter expected results to hide a real defect.
- Failed quality gates block commit and deployment.

## Git And Release Rules

- This is a personal development repository, not a team PR workflow. Do not
  require a pull request, reviewer approval, or merge ceremony merely because
  code changed.
- The remote repository has exactly one long-lived branch: `main`. Keep feature
  work on local branches and never push those branches to `origin`.
- After the user authorizes delivery, commit the reviewed work on the local
  feature branch, merge it into local `main`, then push `main`.
- Delete stale remote branches after their work has landed on `main`. A remote
  feature branch is not a backup or delivery target for this repository.
- Every `git add` or `git commit` is blocked by default. Never stage or commit
  a change until the user explicitly confirms that specific working diff.
- Before asking for commit confirmation, inspect the diff, run the relevant
  gates, and report the changed files, test evidence, remaining risks, and
  proposed commit message. Then stop with `BLOCKED: COMMIT AUTHORIZATION`.
- A commit confirmation applies only to the named diff and one commit. It does
  not authorize later commits, pushes, merges, releases, workflow runs, or
  repository settings changes.
- Do not infer commit permission from instructions such as "fix it",
  "continue", "finish", "ship it", or "do not ask questions". Only an explicit
  instruction to commit the current diff satisfies this gate.
- After explicit confirmation, commit directly. Do not create a pull request.
- Never push a feature branch, merge to a remote feature branch, release,
  rewrite history, or change repository settings without separate explicit user
  authorization.
- Never discard user changes or revert unrelated files.
- GitHub Actions are the only production data writer.
- Update workflow must verify before fetch, verify after calculation, commit
  only `web/data/`, and deploy only after success.
- Pages deployment must be based on actual commit/file differences, not author
  names or commit-message heuristics.

### Push Authorization Gate

- Every push is blocked by default. Commit confirmation never implies push,
  merge, release, workflow, Pages, or repository-setting authorization.
- Before requesting push confirmation, fetch the remote and inspect:
  - `git diff --stat origin/main...main`
  - `git diff --name-status origin/main...main`
  - `git log --oneline origin/main..main`
  - untracked files and local-only process artifacts
- Summarize the exact commit range, user-facing changes, runtime/config/data
  changes, tests, repository metadata changes, and remaining risks.
- Stop with `BLOCKED: PUSH AUTHORIZATION` after the report. The user must
  explicitly approve pushing the named commit range to `origin/main`.
- After confirmation, push `main` directly for this personal repository. Do not
  push any other branch, create a PR, or require team approval.

## Agent Roles

- Delivery lead owns task state, integration, gates, and final acceptance.
- Product/UX owns capability parity, responsive behavior, and accessibility.
- Architect owns ADRs, module boundaries, and measured technology choices.
- Data engineer owns source integrity, schemas, statistics, and corrections.
- Frontend engineer owns views, data service, theme system, and interactions.
- DevOps engineer owns workflows, idempotency, failure recovery, and deploy.
- QA owns layered tests, browser evidence, local screenshots, and performance.
- Independent reviewer reads source and evidence, does not rely on developer
  claims, and blocks delivery on P0/P1 issues.

## Harness / FDE Execution Protocol

`docs/harness/`, `docs/reports/`, and `docs/screenshots/` are local-only process
artifacts. They are ignored by Git and must never be staged or committed.

Every substantial change follows:

```text
baseline -> audit -> task DAG -> implement -> verify -> independent review
         -> rework -> gate -> delivery
```

### Task States

Use the recoverable state file `docs/harness/tasks.json`.

Allowed states:

- `PENDING`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETED`
- `FAILED`
- `REVIEW_REQUIRED`

Each task records:

- `task_id`, `run_id`, `owner_agent`
- objective, input, expected output, dependencies
- acceptance criteria and status
- retry count
- execution evidence and test evidence
- review result

### DAG Rules

1. Read dependencies and current task state before work.
2. Reuse completed evidence instead of repeating work.
3. A task owns an explicit write set. Two agents must not edit the same files
   concurrently.
4. Integration of cross-boundary changes belongs to the delivery lead.
5. Automatic retries are capped at two. Permission, source or environment
   failures move to `BLOCKED`.
6. A timeout or unknown agent status must not halt all local progress. Read
   available artifacts; if they are missing, the delivery lead takes over.

### Evidence Bundle

A completed task must leave traceable evidence:

```text
requirement -> task -> agent -> changed files -> command/fixture
            -> result -> reviewer verdict
```

Acceptance claims without current command output, browser evidence or reviewed
source are invalid.

### Review Loop

1. Implementer supplies files and fresh test output.
2. QA independently runs the relevant gates.
3. Reviewer reads source and evidence, not only summaries.
4. Reviewer reports P0-P3 with file references.
5. Delivery lead assigns bounded rework tasks.
6. QA reruns only affected scope plus necessary regression gates.
7. Reviewer closes the gate or keeps it `REVIEW_REQUIRED`.

P0/P1 issues block delivery. A reviewer timeout is not approval.

### Delivery Record

Before final delivery, update the local, ignored evidence files:

- `docs/harness/tasks.json`
- `docs/reports/QA_REPORT.md`
- `docs/reports/INDEPENDENT_REVIEW.md`
- `docs/reports/FINAL_ACCEPTANCE.md`

Separate local completion from remote deployment evidence. Missing credentials,
push authorization or Actions/Pages execution remains `BLOCKED`.

Local delivery is not committed merely because all gates pass. Present the
exact diff and wait for the explicit commit authorization required by the Git
rules above. A separate push report and explicit push authorization are
required even after the commit exists.

## Completion

Do not mark work complete while a required gate is failed or silently skipped.
Use `BLOCKED` for missing permissions or unavailable external evidence. Never
claim live deployment, Actions success, or repository settings changes without
verified evidence.
