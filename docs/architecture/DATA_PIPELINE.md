# Data Pipeline

## Sources

1. 500.com history HTML table.
2. China Welfare Lottery official JSON API.

Both returned the latest 30 draws and matched local records during the
2026-11-14 audit. `idcd.com` returned 404 HTML and is no longer in the source
list.

## Draw Invariants

- Seven-digit issue.
- Valid ISO date.
- Issue year equals draw-date year.
- Six unique ascending red balls in `1..33`.
- One blue ball in `1..16`.
- Records are unique and strictly ordered by issue.
- Booleans are not accepted as integer ball values.

## History Protection

`history_baseline.json` stores a short SHA-256 fingerprint per protected issue.
Normal validation permits newly appended issues but rejects:

- any protected issue that disappeared;
- any protected issue whose date, issue, red balls, or blue ball changed.

An authorized correction records the full old/new record, source timestamp, and
human reason in `corrections.json`. The protected baseline is refreshed only by
an explicit script after review.

## Statistics

`calc_all.py` uses a full recomputation rather than incremental state:

- Global, 50-draw, and 100-draw frequencies.
- Complete `33`/`16` frequency maps including zero values.
- Current omission, historical maximum omission, and recent five appearances.
- Consecutive numbers, same-tail pattern, AC distribution.
- Recent-50 zone, odd/even, and small/big structure.

Local measurements on 3,527 draws:

- History load: about 5 ms.
- Statistics calculation: about 8 ms.
- Full process including JSON writes: usually below 60 ms.

## Generated Files

- `latest.json`: latest draw and provenance metadata.
- `stats.json`: deterministic statistics plus provenance metadata.
- `manifest.json`: record hash, yearly hashes, coverage, latest metadata.
- `history_index.json`: yearly counts and date ranges.

`generated_at` is preserved when generated content is unchanged, preventing
no-op commits.

## Atomic Writes

`write_if_changed()` compares existing bytes and writes through a temporary file
followed by `os.replace()`. A killed process cannot leave a partially truncated
annual file.
