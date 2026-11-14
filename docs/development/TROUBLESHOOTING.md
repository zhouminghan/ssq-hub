# Troubleshooting

## `jsonschema` or `referencing` fails to install

Install with a current pip:

```bash
.venv/bin/pip install -r requirements.lock
```

If the local Python package mirror lacks `rpds-py`, use Node schema validation:

```bash
npm run test:schema
```

CI validates with both Python and Node.

## Playwright cannot launch Chrome locally

Use `npx playwright install chromium`, or let Playwright use installed Chrome.
On macOS the project uses the `chrome` channel outside CI.

## Port 5173 is busy

Playwright reuses an existing server on that port. To use another port:

```bash
node scripts/dev-server.mjs 5174 web
```

Update `baseURL`/`webServer.url` only for a temporary local POC.

## Page shows `使用本地缓存`

Both the same-origin JSON path and jsDelivr failed. Check network, then reload.
The label intentionally prevents cached data from appearing fresh.

## Data gate reports a changed protected issue

Stop. Do not refresh the baseline first. Inspect the issue in
`corrections.json`, verify the result against both supported sources, record a
reason, and use the manual repair workflow after review.

## Stats mismatch

Run:

```bash
.venv/bin/python scripts/calc_all.py
.venv/bin/python scripts/verify_data.py
npm run test:schema
```

Do not patch `stats.json` by hand.

## White flash in dark mode

Check that the inline theme script remains before stylesheet links and that
`data-theme` is set on `<html>`.

## Mobile horizontal page overflow

Only `#trend-scroll` and the narrow filter bar may scroll horizontally. Check
fixed widths, long labels, and CSS additions outside their component files.
