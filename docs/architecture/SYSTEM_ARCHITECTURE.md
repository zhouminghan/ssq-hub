# System Architecture

## Layers

| Layer | Responsibility | Main files |
|---|---|---|
| Source adapters | Fetch and normalize public draw data | `scripts/fetch_latest.py` |
| Schema | Enforce draw semantics | `scripts/schema.py`, `schemas/*.json` |
| Protected storage | Annual history and record fingerprints | `web/data/history/`, `history_baseline.json` |
| Statistics | Compute frequency, omission, structure, AC, patterns | `scripts/calc_all.py` |
| Manifest | Record coverage, hashes, generation metadata | `scripts/manifest.py`, `web/data/manifest.json` |
| Quality gate | Validate shape, semantics, history, stats | `scripts/verify_data.py` |
| Browser data service | Same-origin fetch, CDN fallback, cache | `web/js/data-loader.js` |
| Product UI | Views, filters, trend table, profile, insights | `web/js/*.js`, `web/css/*.css` |
| Delivery | CI, protected writes, Pages deployment | `.github/workflows/` |

## Dependency Direction

```text
schemas
  ^
  |
schema.py <- fetch_latest.py
    ^             |
    |             v
manifest.py <- history JSON
    ^             |
    |             v
verify_data.py <- calc_all.py
    ^
    |
workflows

history JSON -> browser data loader -> views
stats.json   -> profile + insights
index/latest -> overview + filters
```

Dependencies point toward schemas and plain data. Browser modules never invoke
Python. Python modules do not depend on browser code.

## Data Boundaries

- Browser reads JSON only.
- Browser writes only local cache keys prefixed with `ssq-hub:data:`.
- Git tracks generated data but never contains secrets.
- Annual history is append-only during normal runs.
- Correction writes require an explicit CLI flag and a correction ledger.

## Failure Boundaries

- Fetch failure stops before calculation and commit.
- Invalid schema or history stops before commit.
- Stats mismatch stops before commit.
- Data workflow failure does not trigger Pages deployment.
- Browser network failure tries CDN, then browser cache.
- Cache fallback is visibly labeled; stale data is never presented as fresh.

## Deployment Compatibility

All application URLs are relative, so the site works under the GitHub Pages
repository subpath. The deployment artifact is the `web/` directory.
