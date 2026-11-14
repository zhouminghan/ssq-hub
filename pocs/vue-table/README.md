# Vue Table POC

Minimal Vue 3 + Vite comparison used for the architecture ADR.

```bash
cd pocs/vue-table
npm install
npm run dev
```

The predev script copies the repository's real `web/data/` payload. The app
loads all annual files, renders the latest 50 rows, and can switch to all 3,527
rows.
