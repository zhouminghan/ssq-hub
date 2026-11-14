# Performance Evidence

Measured 2026-11-14 in local headless Chrome against the production files
served by `scripts/dev-server.mjs`.

Command:

```bash
npm run measure:performance -- http://127.0.0.1:8771/
```

## Startup

```json
{
  "startupMs": 565,
  "domContentLoadedMs": 24,
  "loadMs": 24,
  "resourceCount": 25,
  "transferBytes": 132325,
  "decodedBytes": 124825,
  "defaultRows": 50,
  "defaultCells": 2900
}
```

`startupMs` includes Playwright navigation to network idle and waiting for the
first rendered trend row. DOM ready is 24 ms locally. Resource transfer includes
the initial index, latest payload, 2026 annual history, CSS, JS, and favicon.

## Full History

```json
{
  "fullHistoryMs": 2029,
  "rows": 3527,
  "cells": 204566,
  "domNodes": 448199,
  "bodyScrollWidth": 1440,
  "viewportWidth": 1440,
  "issueColumnOffsetPx": 0,
  "stickyHeaderOffsetPx": 0
}
```

Full history remains supported, but the DOM footprint is large. Default use is
recent 50. If full-history browsing becomes primary, row virtualization should
be evaluated without changing overlay coordinates.

## Architecture POC

A table-only Vue 3 + Vite POC was measured outside the repository:

- Warm 50-row table availability median: Vanilla 70 ms, Vue 76 ms.
- Independent cold full-page five-run medians: Vanilla 576 ms, Vue 544 ms.
- Both had 58 columns, zero sticky/frozen offset, no 390px page overflow, and
  working dark styling.
- Vue POC production output: 67.46 KB JS raw / 26.66 KB gzip; 0.94 KB CSS raw.

The POC did not implement the profile drawer, SVG overlay, filters, cache/CDN
fallback, insights, or accessibility. Timing difference is within run noise and
does not justify a full rewrite.
