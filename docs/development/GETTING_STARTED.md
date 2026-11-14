# Getting Started

## Prerequisites

- Git 2.40 or newer.
- Python 3.11 or 3.12.
- Node.js 20 or newer; Node 22 is used in CI.
- A current Chrome/Chromium for local Playwright runs.

## Clone

```bash
git clone https://github.com/zhouminghan/ssq-hub.git
cd ssq-hub
```

## Install

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
npm install
```

On Windows, use `.venv\Scripts\pip` in place of `.venv/bin/pip`.

## Start

```bash
npm run dev
```

Open <http://127.0.0.1:5173>.

The server is a small native Node static server. It serves `web/` and sends
`Cache-Control: no-cache`, so edits appear on reload.

## First Check

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:python
npm run test:schema
.venv/bin/python scripts/verify_data.py
```

For browser tests:

```bash
npx playwright test
```

## IDE

- Use UTF-8.
- Use the repository TypeScript config for JavaScript checking.
- Install an ESLint integration and use the flat config.
- Do not auto-format generated JSON.
