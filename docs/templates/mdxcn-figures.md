# MDXCN-Style README Figures

Source: [mdxcn.dev/docs](https://mdxcn.dev/docs), MIT licensed.

MDXCN provides React/MDX components and plain fenced-ASCII equivalents. SSQ Hub
uses only the fenced equivalents so README, GitHub, and architecture documents
render identically without adding a docs runtime or JSX dependency.

## Delivery Check

```text
+------------------ [ DELIVERY ] ------------------+
|                                                  |
| [x]  fetch and cross-check sources                |
| [x]  protect historical fingerprints              |
| [x]  recompute and verify statistics              |
| [x]  run browser, accessibility and visual gates  |
| [ ]  publish remote branch and verify Pages       |
|                                                  |
+--------------------------------------------------+
```

## Frontend Decision

```text
+------------------ [ FRONTEND ] ------------------+
|                                                  |
| accepted  Nov 14                                 |
|                                                  |
| ●  Vanilla ES modules  smallest static runtime   |
| ×  Vue 3 + Vite        no measured table gain    |
| ○  Astro               unnecessary island setup  |
|                                                  |
| Revisit if full-history scanning becomes primary.|
|                                                  |
+--------------------------------------------------+
```

Use these sparingly: a figure should replace a wall of bullets, not decorate
every section.
