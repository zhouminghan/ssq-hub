# Final Acceptance Report

Date: 2026-11-14

Branch: `codex/product-rebuild`

Baseline: `8594a6b807de8f5e5860353929dde92be0c46d6c`

Local delivery commit: `1abfd5d`

## 1. Reconstruction Summary

SSQ Hub was rebuilt locally as a production-oriented static data product while
preserving the original no-backend, GitHub Pages deployment model.

Delivered areas:

- 3,527-record data baseline with protected per-record fingerprints.
- Strict Python schema, source cross-checking, stats, manifest, and correction
  ledger.
- New two-view UI: trend analysis and data insights.
- Responsive 58-column table with sticky/frozen behavior and SVG path.
- Accessible number profiles, filters, keyboard navigation, and themes.
- TypeScript checking, ESLint, Python/schema/unit/E2E/visual tests.
- New CI, data update, repair, and Pages workflows.
- AGENTS, architecture, development, onboarding, and evidence documentation.

Local delivery status: **PASS**.

Remote release status: **BLOCKED** pending authorized push and remote Actions /
Pages verification.

## Local Gate Summary

| Gate | Result |
|---|---|
| TypeScript + ESLint + Ruff + JS/Python unit tests | PASS, 25 checks |
| JSON Schema | PASS, 30 files |
| Strict data gate | PASS, 0 errors / 0 warnings |
| Playwright Chrome desktop/mobile | PASS, 30 passed / 2 visual-project skips |
| Visual screenshot comparison | PASS, 2 passed / 2 project skips |
| WebKit mobile smoke | PASS |
| Firefox smoke | BLOCKED by local browser-profile launch |
| npm audit | PASS, 0 vulnerabilities |
| Workflow YAML parse | PASS, 4 files |

## 2. Architecture Comparison

| Area | Baseline | Reconstructed |
|---|---|---|
| Frontend | vanilla ES modules | modular vanilla ES modules, product views, insights |
| Type checking | none | `tsc --checkJs` |
| Lint | none | ESLint |
| Frontend tests | none | Node unit + Playwright desktop/mobile |
| Python tests | none | 20 unittest/pytest cases |
| Data contracts | ad-hoc checks | JSON Schema 2020-12 + semantic invariants |
| History protection | none | per-record baseline, manifest, correction ledger |
| Source handling | first successful source | two-source cross-check, conflict rejection |
| No-op writes | content compare | atomic content compare + stable generation time |
| CI | no quality gate | lint, tests, schema, E2E, cross-browser, audits |
| Pages gate | author/message heuristic | actual SHA/file-diff gate + predeploy verify |

## 3. Technology Choice

Selected: native HTML/CSS/ES modules.

Reason: the real-data Vanilla/Vue POC found no meaningful table-rendering
advantage for Vue, while migration would require porting every existing
interaction and test contract. The selected architecture has no production
bundle or framework runtime.

Evidence:

- [Technical Decisions](../architecture/TECHNICAL_DECISIONS.md)
- [Vue POC](../../pocs/vue-table/README.md)

## 4. Capability Reconciliation

All original capabilities have a current implementation and automated coverage.
See [FUNCTION_PARITY.md](FUNCTION_PARITY.md).

Summary:

- 34 / 34 original capabilities implemented.
- Compare now exposes a period selector and reports actual matched years.
- GitHub header entry and data provenance are new product additions.

## 5. Data Engineering

Baseline and current data:

- 3,527 draws.
- 24 annual files, 2003-02-23 through 2026-11-12.
- Latest issue `2026130`.
- 3,527 protected issue fingerprints.
- Two sources cross-checked: 500彩票网 and 福彩官方.

Implemented:

- Issue/date/ball semantic validation.
- JSON Schema for history, draw, index, stats, manifest, baseline, corrections,
  and source state.
- Atomic data writes.
- Append-only normal updates.
- Explicit correction ledger.
- Full deterministic stats recomputation.
- Complete 33/16 frequency maps, including zero-frequency numbers.
- Manifest and baseline metadata checks.
- Expected-draw failure on scheduled draw days.
- `LOTTERY_PAUSE_UNTIL` override for official holiday suspension.

Negative tests:

- Missing year exits 1.
- Modified protected record exits 1.
- Modified baseline count/hash is detected.
- Source disagreement is rejected.
- Draw-day no-new-data exits non-zero unless a declared pause is active.

## 6. GitHub Actions

Local YAML parsing and shell logic validation passed for all workflows.

Workflow behavior:

- CI: Python, schema, frontend, E2E, Firefox/WebKit, npm/pip audit.
- Update: preflight, cross-source fetch, calc, verify, path allowlist, no-op
  suppression, single rebase retry, failure artifacts.
- Repair: manual `REPAIR` confirmation, correction ledger, baseline refresh,
  verify.
- Pages: actual commit diff gate, predeploy verify, cache-busted artifact.

Remote workflow execution: **BLOCKED**, because the branch has not been pushed.
No remote success is claimed.

## 7. UI/UX

- Professional data-first header, overview, navigation, filters, table, and
  footer.
- GitHub entry opens the official repository safely in a new tab.
- Desktop and mobile layouts have no page-level horizontal overflow.
- Light, dark, and auto themes use shared tokens and persist correctly.
- Color contrast passes Axe in trend, insights, and dark insights views.
- Number profile supports mouse, keyboard header controls, Escape, focus trap,
  and focus return.
- Latest draw, sample size, year coverage, source, freshness, and cache state
  are visible.

Final screenshots:

- `docs/screenshots/desktop-light.png`
- `docs/screenshots/desktop-dark.png`
- `docs/screenshots/mobile-light.png`
- `docs/screenshots/mobile-dark.png`
- `docs/screenshots/insights-light.png`
- `docs/screenshots/insights-mobile-dark.png`

## 8. Browser Test Results

Main suite:

```text
npx playwright test
30 passed, 2 visual-project skips, 0 failed
```

Coverage includes:

- Startup and real data.
- 58 columns, frozen issue column, synchronized sticky header.
- Recent N, year, Compare period selection, reset.
- Red/blue profiles.
- Auto/light/dark and persistence.
- GitHub link.
- 1440, 1280, 768, 390, and 375 widths.
- Axe checks with contrast enabled.
- Total source failure and browser-cache fallback.
- Startup and full-history performance.

Visual baselines:

```text
npm run test:visual
2 passed, 2 project-specific skips
```

Cross-browser:

- WebKit mobile smoke passed locally.
- Firefox local Playwright runtime failed to create its profile directory; this
  is an environment blocker. CI includes Firefox/WebKit execution.

## 9. Performance

Measured locally:

- Startup to 50 rendered rows: about 565 ms.
- Full 3,527-row render: about 2.0 s.
- Default cells: 2,900.
- Full-history cells: 204,566.
- Full-history DOM nodes: about 448,000.
- Initial transferred resources: about 132 KB.
- Frozen/sticky offset: 0 px.

The full-history view remains opt-in. Default recent-50 use is below the defined
5-second startup budget.

## 10. Independent Review

Independent review and QA are recorded in:

- `docs/reports/INDEPENDENT_REVIEW.md`
- `docs/reports/QA_REPORT.md`

The first review blocked delivery on Compare counts, hidden keyboard focus, and
silent missing-draw success. A later review found a Ruff CI failure and a
partial-backfill edge. All of those issues were reworked, regression-tested, and
closed.

Final reviewer disposition: **local deliverable, no remaining local P0/P1;
remote verification BLOCKED until push**.

## 11. New Developer Onboarding

Performed from a clean temporary copy:

- Installed Python and Node dependencies.
- Ran typecheck, lint, unit, Python, schema, and strict data gates.
- Started the documented local server.
- Loaded 50 rows, verified the latest issue, and opened/closed a profile drawer.

Evidence: [ONBOARDING.md](ONBOARDING.md).

## 12. Known Issues

- Visual pixel baselines run on macOS Chrome only; CI enforces layout geometry,
  not pixel comparison.
- Firefox did not launch in the local managed environment after reinstall.
- CDN success followed by fallback is not exercised as a separate scenario.
- Full history creates a large DOM and around 2 seconds of local render time.
- Next-draw date does not encode every holiday suspension.
- Historical frequency is descriptive only.

## 13. Risks

- Remote CI can reveal platform-specific workflow or browser issues.
- Dependency ranges are locked for Python and Node, but Actions still use major
  version tags.
- Live Pages remains the old product until an authorized push.
- GitHub About/topics/homepage are not updated because authentication is
  unavailable.

## 14. Next Actions

1. Review the local commit and push `codex/product-rebuild`.
2. Confirm remote CI, data workflow, and Pages deployment.
3. Run live smoke tests against the deployed commit.
4. Update GitHub About, homepage, and topics while authenticated.
5. Mark remote acceptance complete only after evidence is available.

## Completion Matrix

| Requirement | Status |
|---|---|
| Architecture refactor | PASS |
| Measured POC | PASS |
| 34-function parity | PASS |
| Modern responsive UI | PASS |
| Light/dark/auto | PASS |
| Desktop/mobile | PASS |
| GitHub entry | PASS |
| Python pipeline | PASS locally |
| Data quality | PASS |
| Actions optimization | PASS locally, remote BLOCKED |
| Pages process | PASS locally, remote BLOCKED |
| Playwright E2E | PASS |
| Visual baselines | PASS locally |
| Performance evidence | PASS |
| Independent review | PASS locally; no remaining P0/P1 |
| README/HTML metadata | PASS |
| GitHub About | BLOCKED: no valid auth |
| AGENTS/docs | PASS |
| Onboarding | PASS |
| P0/P1 | No known unresolved local P0/P1 after rework |
| Final acceptance | Local PASS; remote BLOCKED |
