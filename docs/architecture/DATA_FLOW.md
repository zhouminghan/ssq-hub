# Data Flow

## Normal Incremental Run

```text
schedule/manual trigger
  -> preflight verify_data.py
  -> fetch current candidates from 500.com and official API
  -> normalize and validate candidates
  -> cross-check common issues
  -> reject unauthorized changes to existing issues
  -> append new issues
  -> atomically rewrite affected annual files
  -> extend protected record baseline
  -> calc_all.py full deterministic statistics
  -> verify_data.py
  -> inspect staged data paths
  -> commit and push only if data changed
  -> deploy Pages after successful workflow
```

## Correction Run

```text
manual data-repair workflow + REPAIR confirmation
  -> preflight protected history
  -> explicit --allow-corrections fetch
  -> compare available sources
  -> append old/new/source/time/reason to corrections.json
  -> human-review the ledger
  -> update_baseline.py
  -> recompute and verify
  -> commit and deploy
```

## Browser Read

```text
index.html
  -> history_index.json + latest.json
  -> overview + filter state
  -> selected annual history file(s)
  -> trend-table render + SVG overlay
  -> stats.json on profile/insights demand
```

Every resource tries the same-origin path first. If the primary path fails, the
loader switches to jsDelivr. If both network routes fail, a timestamped browser
cache entry can be used. The UI labels that state as `使用本地缓存`.

## Data Contracts

- Draw: `web/data/history/YYYY.json[]`.
- Index: `history_index.json`.
- Latest: `latest.json`.
- Statistics: `stats.json`.
- File and record integrity: `manifest.json`, `history_baseline.json`.
- Corrections: optional `corrections.json`.

Formal contracts live in `schemas/` and are validated by Ajv and, when
installed, Python `jsonschema`.
