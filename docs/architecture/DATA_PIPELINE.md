# Data Pipeline

## Sources

1. 500.com history HTML table.
2. China Welfare Lottery official JSON API.

Both returned the latest 30 draws and matched local records during the
2026-11-14 audit. `idcd.com` returned 404 HTML and is no longer in the source
list.

## Scheduled Draw and Holiday Handling

Scheduled runs execute after the 22:10 Asia/Shanghai source-sync window. A
Tuesday/Thursday/Sunday run must receive a draw dated today; an empty or old
result is retried three times at ten-minute intervals before the job fails.

Official market pauses live in
`web/config/lottery_pause_windows.json` and are shared by the Python updater and
browser next-draw estimate. The date range is inclusive. During a configured
pause, the updater exits successfully before network access; any other draw-day
no-op is an error.

`LOTTERY_PAUSE_UNTIL` remains available as an emergency override.
`LOTTERY_PAUSE_WINDOWS_JSON` can inject the official window list through
repository variables when a newly published annual notice is available.

The 2027 Spring Festival entry is explicitly marked `provisional` and uses the
State Council holiday range as a fail-safe until the Ministry of Finance
lottery-market notice is published. Replace that entry with the official notice
when available.

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

## Cross-Year Behavior

The first issue of a new year is `YYYY001`. Annual file selection follows the
draw date, not the prior issue sequence. The browser derives the next issue year
from the next scheduled draw date, so a late-December draw correctly points to
the next year's `001` issue.

## Atomic Writes

`write_if_changed()` compares existing bytes and writes through a temporary file
followed by `os.replace()`. A killed process cannot leave a partially truncated
annual file.
