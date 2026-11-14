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

`test:visual` compares the four committed macOS Chrome screenshots with a 1%
pixel-difference limit and is skipped on CI/other platforms. CI still enforces
the layout geometry assertions. The cross-browser config runs Firefox desktop
and WebKit mobile smoke tests.

## Targeted Browser Run

```bash
npx playwright test --project=desktop --grep "theme"
npx playwright test --project=mobile --grep "viewport"
```

## Evidence

Playwright writes traces and failure screenshots under `test-results/`. The HTML
report is in `playwright-report/`. Both are ignored by Git and uploaded by CI.

Committed product screenshots are under `docs/screenshots/`.

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
