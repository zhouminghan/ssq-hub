# Technical Decisions

Status: accepted for SSQ Hub 2.0

Date: 2026-11-14

## Decision

Keep the production application on semantic HTML, native ES modules, native
DOM/SVG, and CSS custom properties. Add a full engineering layer around it:
TypeScript checking, ESLint, Python tests, JSON Schema, Playwright, Axe,
manifest/history protection, and stronger CI/CD.

Do not migrate to Vue, Nuxt, React, Next.js, Astro, TanStack Table, a component
library, or ECharts in this release.

## Constraints

- GitHub Pages must serve a static artifact.
- There is no backend, database, or paid runtime.
- Python remains the data pipeline.
- The primary view is a 58-column trend table with frozen issue column, sticky
  header, horizontal and vertical scroll, and SVG overlay.
- Every view must work at 1440, 1280, 768, 390, and 375 pixels.
- Light, dark, and auto themes must all remain coherent.
- Existing capabilities must not be lost during a framework rewrite.

## Candidates

### A. Vanilla ES Modules (selected)

Advantages:

- Current data scale and table size render within the default interaction budget.
- Native sticky table behavior requires no virtual grid configuration.
- Small deployment artifact, no build/runtime framework.
- Existing feature logic can be hardened without a full rewrite.
- Direct Python-generated static JSON contract.

Costs:

- DOM rendering is explicit and must be kept modular.
- Accessibility and event behavior require discipline.
- Full-history view has a large DOM and would eventually benefit from
  virtualization.

### B. Vue 3 + TypeScript + Vite

A minimal Vue 3 + Vite POC was built outside the repository with real 2026 data
and the same Chrome version. It rendered the same 58 columns, sticky header,
frozen issue column, dark theme, and 390px responsive layout.

Measured results:

| Metric | Vanilla | Vue POC |
|---|---:|---:|
| Warm 50-row table available, median | ~70 ms | ~76 ms |
| Cold full-page samples, 5-run median | 576 ms | 544 ms |
| Vue production JS | — | 67.46 KB raw / 26.66 KB gzip |
| Vue production CSS | — | 0.94 KB raw / 0.48 KB gzip |
| Frozen-column offset | 0 px | 0 px |
| Sticky-header offset | 0 px | 0 px |
| 390px page overflow | none | none |
| Existing full-product migration | 0 modules | would require porting all application behavior |

The reproducible Vue POC lives in `pocs/vue-table/` and loads all annual files,
including the 3,527-row switch. It remains a table-only shell, not a complete implementation of the
profile drawer, SVG overlay, cache, CDN fallback, filters, insights, and
accessibility behavior. Its small timing difference is within local run noise
and does not offset a full migration.

### C. Nuxt / Next.js / React

Rejected. SSR, routing infrastructure, server components, and framework runtime
provide no benefit for one static page with local JSON and add deployment and
maintenance surface.

### D. Astro

Rejected for this iteration. It is viable for static content, but the product is
one interactive data surface rather than a content site. Framework islands would
add tooling without removing the table interaction.

## UI Library Decision

No general-purpose component library is selected. The app uses native controls,
semantic structure, and project-specific data visualization. This avoids a
management-console appearance, large CSS resets, and theme overrides.

## Table Decision

Use the native table:

- 58 columns and 50 rows are tractable.
- Sticky first column and header are native CSS.
- The SVG overlay can measure real cell coordinates.
- No virtualization state must be synchronized with the overlay.

Full history is retained. Current local measurement is about 2.1 seconds and
204,566 table cells. If this becomes a common primary workflow, introduce row
window virtualization behind the same table model and validate overlay
coordinates before release.

## Chart Decision

Use native CSS/SVG for the existing compact distributions. The product has
small, purpose-built charts rather than a general charting workload. A chart
library would materially increase bundle and theming surface without improving
the current seven-column AC view or structure bars.

## Testing Decision

- Node test runner for pure browser modules.
- Python unittest-compatible pytest suite for data and pipeline.
- Ajv for JSON Schema 2020-12 in the frontend CI job.
- Python `jsonschema` as the second schema implementation in the Python job.
- Playwright for real browser, responsive, accessibility, failure, cache, and
  performance workflows.
- Axe with color contrast enabled in both views and both themes.

## Deployment Decision

- Serve `web/` directly from GitHub Pages.
- Keep data updates and frontend deployment as separate workflows.
- Deploy after successful data workflow completion based on actual commit
  differences, not author names or messages.
- Verify data immediately before packaging the Pages artifact.

## Consequences

- The existing product can be hardened without a high-risk rewrite.
- Engineering quality comes from explicit contracts and tests, not a framework.
- The team must maintain module boundaries and avoid concentrating DOM logic.
- A future framework migration requires a new ADR and a measured end-to-end POC
  that includes every existing capability.
