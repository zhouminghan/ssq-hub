# Original Capability Reconciliation

Baseline source: `8594a6b`. Current implementation: `codex/product-rebuild`.
All browser references below are exercised by `tests/e2e/app.spec.ts`.

| # | Capability | Current implementation | Evidence |
|---:|---|---|---|
| 1 | Historical draws | `web/data/history/`, `data-loader.js` | Python history tests; 50-row E2E startup |
| 2 | Issue and date | `trend-table.js`, overview | latest row and overview assertions |
| 3 | 33 red columns | `trend-table.js` | 58-column E2E |
| 4 | 16 blue columns | `trend-table.js` | 58-column E2E |
| 5 | Omission values | `trend-table.js` missed-cell counters | table render and profile E2E |
| 6 | Historical frequency | `calc_all.py`, `number-profile.js` | Python frequency invariants; profile E2E |
| 7 | Recent-50 frequency | stats `*_freq_50`, profile, insights | Python invariants; insights E2E |
| 8 | Recent-100 frequency | stats `*_freq_100`, profile | Python invariants; profile E2E |
| 9 | Maximum omission | `red_per_number`, `blue_per_number` | Python max/current invariant |
| 10 | Latest five appearances | `recent_5_issues` | profile E2E content |
| 11 | Consecutive analysis | `consecutive`, insights pattern card | insights E2E |
| 12 | Same-tail analysis | `same_tail`, insights pattern card | insights E2E |
| 13 | AC distribution | `ac_distribution`, insights chart | 7-column AC chart E2E |
| 14 | Zone distribution | `structure_recent_50`, insights | structure card and Python totals |
| 15 | Odd/even structure | table cells + insights | structure card and Python totals |
| 16 | Small/big structure | table cells + insights | structure card and Python totals |
| 17 | Recent N filter | `filter-bar.js` | 100-row E2E + reset |
| 18 | Year filter | `filter-bar.js` | 2025 / 151-row E2E |
| 19 | Compare mode | `filter-bar.js`, `loadIssues` | visible compare summary + year chips |
| 20 | Number profile drawer | `number-profile.js` | red/blue profile and close E2E |
| 21 | Blue SVG path | `trend-overlay.js` | rendered overlay; table/scroll E2E |
| 22 | Recent-five highlight | `.recent-5` | table render and latest-row E2E |
| 23 | Latest-draw position | `scrollToBottom`, `.is-latest` | latest-row E2E |
| 24 | Horizontal scroll | `#trend-scroll` | scroll metrics E2E |
| 25 | Frozen issue column | sticky `.col-issue` | alignment E2E |
| 26 | Sticky header | sticky `thead th` | alignment E2E |
| 27 | Dark mode | theme tokens + persistence | theme and Axe E2E |
| 28 | Light mode | theme tokens | light screenshot/Axe |
| 29 | Auto mode | `prefers-color-scheme` listener | system-change E2E |
| 30 | Mobile adaptation | `responsive.css` | 390/375 + mobile project |
| 31 | Load-failure state | `main.js`, `data-loader.js` | forced all-source failure E2E |
| 32 | CDN fallback | jsDelivr branch | loader tests and failure/cache E2E |
| 33 | Loading cache | memory TTL + browser cache | cache fallback E2E |
| 34 | Page deployment | Pages workflow | YAML validation; remote run BLOCKED until push |

## Intentional Improvements

- Added a GitHub entry in the header.
- Added data freshness and latest-draw summaries.
- Made compare mode visible instead of an empty control panel.
- Added keyboard access to every number profile through table headers.
- Added focus management to the profile drawer.
- Added an insights view for previously data-only statistics.
- Added a filter reset.
- Added browser-cache and CDN-source status.
- Added strict schema, history fingerprints, manifest, and correction ledger.

## Known Difference

The full-history option renders 3,527 rows at once. This preserves the original
full dataset access but creates approximately 448,000 DOM nodes and about two
seconds of local render time. The default remains recent 50.
