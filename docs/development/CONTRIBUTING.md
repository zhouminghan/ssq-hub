# Contributing

## Workflow

1. Open an issue describing the user-visible problem.
2. Branch from current `main`.
3. Keep data, UI, and workflow concerns in separate commits when practical.
4. Add or update tests with the change.
5. Run the full local quality gate.
6. Open a pull request with screenshots for UI changes.

## Pull Request Checklist

- No historical record was hand-edited.
- Schema and data gates pass.
- Desktop and mobile browser tests pass.
- Light and dark screenshots are included.
- Accessibility has no serious/critical Axe issues.
- README and architecture docs remain accurate.
- No generated secrets or local caches are committed.

## Commit Style

Use a concise conventional prefix:

- `feat:`
- `fix:`
- `refactor:`
- `test:`
- `docs:`
- `chore(data):`
- `ci:`

## Review

Data logic and UI changes require a reviewer who did not implement the change.
Reviewer findings must reference source lines or reproducible browser evidence.
