# Architecture

## Runtime

SSQ Hub is a static, read-only data product served directly from GitHub Pages.
The browser uses semantic HTML, native ES modules, DOM/SVG, and CSS custom
properties. There is no application server, database, framework runtime, or
production build step.

```text
public sources
  -> Python fetch, cross-check, schema and history validation
  -> protected annual JSON
  -> deterministic statistics and manifest
  -> browser data service with CDN and cache fallback
  -> vanilla ES module views
  -> GitHub Pages
```

## Layers

| Layer | Responsibility | Main files |
|---|---|---|
| Source adapters | Fetch and normalize public draw data | `scripts/fetch_latest.py` |
| Schema | Enforce draw and generated-data contracts | `scripts/schema.py`, `schemas/` |
| Protected storage | Annual history and record fingerprints | `web/data/history/`, `history_baseline.json` |
| Statistics | Frequency, omission, structure, AC and patterns | `scripts/calc_all.py` |
| Manifest | Coverage, hashes and generation metadata | `scripts/manifest.py`, `web/data/manifest.json` |
| Quality gate | Validate shape, semantics, history and stats | `scripts/verify_data.py` |
| Browser data | Same-origin fetch, CDN fallback and cache | `web/js/data-loader.js` |
| Product UI | Views, filters, table, drawer and insights | `web/js/`, `web/css/` |
| Delivery | CI, protected writes and Pages deployment | `.github/workflows/` |

## Data Flow

Normal update:

```text
schedule or manual trigger
  -> preflight validation
  -> fetch and cross-check public sources
  -> reject unauthorized changes to protected records
  -> append new issues and update the protected baseline
  -> recompute statistics and manifest
  -> strict validation
  -> commit only expected data files
  -> deploy Pages after success
```

Historical correction:

```text
manual repair workflow with explicit confirmation
  -> correction mode with source evidence
  -> append old/new values, source, time and reason to corrections.json
  -> human review
  -> refresh protected baseline
  -> recompute, verify, commit and deploy
```

Browser reads:

```text
history_index.json + latest.json
  -> overview and filter state
  -> selected annual history
  -> trend table and SVG overlay
  -> stats.json on profile or insight demand
```

The same-origin JSON path is tried first, followed by jsDelivr, then a timestamped
browser cache. Cache fallback is visibly labeled and never presented as fresh.

## Data Contracts

- Draw records: `web/data/history/YYYY.json`.
- Index: `history_index.json`.
- Latest draw: `latest.json`.
- Statistics: `stats.json`.
- Integrity: `manifest.json` and `history_baseline.json`.
- Corrections: optional `corrections.json`.

Draw invariants:

- Seven-digit issue with a valid ISO date.
- Issue year equals draw-date year.
- Six unique ascending red balls in `1..33`.
- One blue ball in `1..16`.
- Records are unique and strictly ordered.
- Boolean values are not accepted as integer balls.

`history_baseline.json` stores a SHA-256 fingerprint for every protected issue.
Normal updates may append records but may not remove or change protected values.
Corrections require an explicit CLI flag, a correction ledger and review before
the baseline is refreshed.

Statistics are recomputed in full rather than maintained incrementally. This is
fast at the current scale and keeps cross-file behavior deterministic.
`write_if_changed()` preserves `generated_at` and file mtimes when content is
unchanged.

## Frontend

| Module | Responsibility |
|---|---|
| `main.js` | Boot, data orchestration, view state and errors |
| `dashboard.js` | Latest draw, scale, freshness and navigation |
| `data-loader.js` | Fetch, CDN fallback, browser cache and TTL cache |
| `store.js` | Small pub/sub state container |
| `filter-bar.js` | Recent N, year, compare, custom N and reset |
| `trend-table.js` | 58-column table, omissions and structure cells |
| `trend-overlay.js` | Blue-ball SVG line |
| `number-profile.js` | Accessible number-profile drawer |
| `insights.js` | Structure, AC, pattern and frequency views |
| `theme.js` | Auto, light and dark theme persistence |
| `notes.js` | Safe local Markdown, KaTeX and chart rendering |

Filter state is held in memory and resets to recent 50 on page load. Theme mode
is persisted in `localStorage.theme`. Temporary filters use a render token so a
slower request cannot replace a newer result.

The table uses one native sticky header. A second cloned header is intentionally
not used because compositor scrolling can leave duplicate or partially painted
layers. The SVG overlay is redrawn after resize and scroll.

Accessibility requirements include one `<h1>`, landmark navigation, a skip link,
native controls, visible focus, accessible names, keyboard-accessible table
headers, drawer focus entry/return, and Axe checks with contrast enabled.

At the current scale, the default view renders 50 rows and 2,900 data cells.
Full history is opt-in and intentionally avoids virtualization.

## Delivery

`update-data.yml` runs on the draw schedule, rejects stale or conflicting source
results after bounded retries, respects configured lottery pauses, writes only
expected data paths, and deploys only after successful verification.

`deploy-pages.yml` packages `web/`, verifies protected data, applies a
cache-busting query, uploads the Pages artifact and deploys when actual file
differences require it.

Browser tests, linting, TypeScript checks and local test servers are development
tools and are intentionally not tracked in the remote repository. Actions run
only the data update and Pages deployment workflows, avoiding browser-download
and test-runner cost in production CI.

## Decisions

The production application remains framework-free. A measured Vue 3 + Vite
prototype did not provide a meaningful rendering advantage and would require
porting every existing interaction. The disposable experiment is not retained
in the repository.

Native tables, CSS and SVG are sufficient for the 58-column matrix and compact
charts. A framework, component library or chart runtime would add deployment,
theming and maintenance surface without removing the core DOM work.

## Non-Goals

- User accounts, live betting links or financial advice.
- Server APIs, databases, queues, containers or microservices.
- Prediction or AI number recommendation.
- A framework rewrite without a new measured architecture decision.
