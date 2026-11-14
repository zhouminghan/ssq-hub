# CI/CD

## Workflows

### `ci.yml`

Runs on pull requests, main pushes, and manual dispatch.

- Python: Ruff, pytest, strict data gate.
- Frontend: TypeScript check, ESLint, unit tests, JSON Schema.
- E2E: Playwright desktop and mobile.
- Cross-browser smoke: Firefox desktop and WebKit mobile.
- Security: pip audit and npm audit.
- Logs and Playwright evidence upload on completion or failure.

### `update-data.yml`

Scheduled Tuesday/Thursday/Sunday plus monthly maintenance and manual dispatch.

- Preflight validates the checked-in data before fetch.
- No-source failure exits non-zero.
- Sources are cross-checked.
- Scheduled draw-day runs require a newer issue after the 22:10 source window.
  Set repository variable `LOTTERY_PAUSE_UNTIL=YYYY-MM-DD` during official
  holiday suspensions.
- Calculation and strict verification occur before staging.
- Only expected `web/data/` paths may be committed.
- No data changes means no commit.
- One fetch/rebase retry handles a concurrent main update.
- Failure logs are uploaded.

### `data-repair.yml`

Manual-only protected write path with `data-repair` environment and `REPAIR`
confirmation.

- Uses explicit correction mode.
- Prints a compact correction ledger.
- Refreshes the protected baseline only after the correction is recorded.
- Recomputes, verifies, and commits through the same path allowlist.

### `deploy-pages.yml`

- Direct frontend pushes under `web/**` except data trigger deployment.
- Successful data or repair workflow completion triggers deployment.
- Deployment gate compares `workflow_run.head_sha..HEAD` file changes.
- Data is reverified immediately before artifact upload.
- Pages permissions and concurrency are explicit.

## Cost Controls

- `cancel-in-progress` is enabled for CI, disabled for data writes and Pages.
- npm and pip caches use lock/requirements files.
- Data no-op runs avoid commit and should not produce repeated deployments.
- The repository has no paid runtime service.

## Evidence Limits

Local YAML parsing and code review do not prove a remote Actions run. Remote
workflow success must be checked after an authorized push. Historical run
duration and monthly savings remain `BLOCKED` until remote logs are available.
