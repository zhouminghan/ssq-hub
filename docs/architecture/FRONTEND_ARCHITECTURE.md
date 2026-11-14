# Frontend Architecture

## Runtime

The production frontend is dependency-free at runtime:

- Semantic HTML shell.
- Native ES modules.
- Native DOM table and SVG.
- CSS custom-property theme system.
- No bundler, framework runtime, or client router.

This is a deliberate fit for a single-page, read-only static data product. The
application is split by responsibility rather than by a component framework.

## Modules

| Module | Responsibility |
|---|---|
| `main.js` | Boot, data orchestration, view/filter subscription, error state |
| `dashboard.js` | Latest draw, data scale, freshness, view navigation |
| `data-loader.js` | Fetch, CDN fallback, browser cache, in-memory TTL cache |
| `store.js` | Small pub/sub state container |
| `filter-bar.js` | Recent N, year, compare, custom N, reset |
| `trend-table.js` | 58-column table, omissions, structure cells, profile triggers |
| `trend-overlay.js` | Blue-ball SVG polyline |
| `number-profile.js` | Accessible drawer and per-number statistics |
| `insights.js` | Structure, AC, pattern, and high-frequency views |
| `theme.js` | Auto/light/dark state and persistence |

## State

The filter object is the only shared durable UI state:

```js
{
  mode: 'recent' | 'year' | 'compare',
  recent: number,
  year: string,
  compareIssues: string[]
}
```

Theme mode is stored in `localStorage.theme`. Filter state is in memory and
reset to recent 50 on page load.

## Rendering

The trend view rerenders the table from a fresh row model. It does not mutate
the loaded JSON. Omission values are accumulated while rows are rendered.
The SVG overlay is redrawn after resize and scroll. A synchronized, non-
interactive header paint layer covers the native sticky header and dynamically
masks the portion of a row crossing its lower edge. The semantic header below
still owns mouse and keyboard input.

Temporary filters expose a top-level order token. If two requests race, only the
latest render token may replace the table.

## Accessibility

- One `<h1>`.
- Landmark navigation and skip link.
- Number headers are real buttons that open the same profile drawer as cells.
- Drawer has dialog semantics, focus entry, focus trapping, Escape close, and
  focus return.
- Theme and filter controls have accessible names.
- Axe checks run in Playwright with color contrast enabled.

## Performance

- Default recent-50 view has 2,900 data cells.
- Full history has 204,566 data cells and about 448,000 DOM nodes; measured
  render time is about 2.1 seconds in local Chrome.
- Stats load only when the profile or insights view is opened.
- Annual files are cached in memory for five minutes and in browser storage for
  fallback.
- The app deliberately avoids virtualizing the default view because row counts
  are small and native sticky/frozen behavior is more reliable.
