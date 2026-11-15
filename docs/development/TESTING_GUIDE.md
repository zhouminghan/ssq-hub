# Testing Guide

## Layers

| Layer | Command | Scope |
|---|---|---|
| JavaScript unit | `npm run test:unit` | Store, issue/date helpers, structure math |
| Python unit | `npm run test:python` | Schema, stats, history protection, merge logic |
| JSON Schema | `npm run test:schema` | Every history, latest, stats, manifest, baseline |
| Strict data gate | `.venv/bin/python scripts/verify_data.py` | Cross-file consistency and protected history |
| Browser E2E | `npx playwright test` | Desktop/mobile product workflows |
| Accessibility | included in E2E | Axe serious/critical checks with contrast |

## Full Local Run

```bash
npm run check
npm run test:schema
.venv/bin/python scripts/verify_data.py
npx playwright test
npm run test:visual
npm run test:cross-browser
```

Visual checks are performed in a real browser at the required desktop and
mobile viewports. `test:visual` compares local screenshots with baselines under
the Git-ignored `docs/screenshots/` directory. Screenshots are never committed.
The cross-browser config runs Firefox desktop and WebKit mobile smoke tests.

## Targeted Browser Run

```bash
npx playwright test --project=desktop --grep "theme"
npx playwright test --project=mobile --grep "viewport"
```

## Evidence

Playwright writes traces and failure screenshots under `test-results/`. The HTML
report is in `playwright-report/`. Both are ignored by Git and uploaded by CI.

Do not commit screenshots or visual-baseline images.

## Data-Gate Negative Cases

The Python tests explicitly cover:

- duplicate red balls;
- unsorted red balls;
- invalid date;
- issue/year mismatch;
- boolean blue ball;
- missing protected year;
- modified protected record;
- unauthorized source conflict;
- allowed append;
- explicit correction staging.

## Acceptance Rule

Passing component or syntax checks cannot substitute for real browser evidence.
