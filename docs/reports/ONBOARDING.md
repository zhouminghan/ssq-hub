# Clean-Clone Onboarding Test

Date: 2026-11-14

## Method

A clean temporary copy was created without `.git`, `node_modules`, `.venv`,
`test-results`, or `playwright-report`:

```text
/tmp/ssq-onboarding2.807lSE
```

The then-current documented installation path was followed:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
npm ci
```

Installation completed successfully. The local package mirror was slow but did
not produce a project error.

The final repository now recommends the locked `requirements.lock` file; the
same virtual-environment steps remain otherwise unchanged.

## Verification

```bash
npm run check
.venv/bin/python scripts/verify_data.py
npm run test:schema
```

Results:

- TypeScript check passed.
- ESLint passed.
- 5 frontend unit tests passed.
- 16 Python tests passed.
- JSON Schema validation passed for all 24 annual files and generated payloads.
- Strict data gate passed with 0 errors and 0 warnings.

## Core Product Operation

The clean copy was served with:

```bash
node scripts/dev-server.mjs 8790 web
```

A headless Chrome smoke test at 390×844 verified:

- title loaded;
- 50 trend rows rendered;
- latest issue was `2026130`;
- a red-ball profile drawer opened and closed;
- no page errors occurred.

Observed result:

```json
{
  "title": "SSQ Hub · 双色球数据洞察",
  "rows": 50,
  "latest": "2026130",
  "errors": []
}
```

## Conclusion

The README, AGENTS guide, install commands, data gate, test commands, local
server, and core browser workflow are consistent enough for a new developer to
take over the repository.

The optional `requirements-lint.txt` is separate because the local mirror's
Ruff binary download was unusually slow. CI installs both requirement files.
