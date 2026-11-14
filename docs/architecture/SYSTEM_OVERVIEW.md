# System Overview

## Purpose

SSQ Hub turns public Double Color Ball draw records into a fast, inspectable
static web application. It covers the full history from 2003 onward and exposes
number trends, omission values, structure metrics, recent frequency, and a
number-profile drawer.

## Product Principles

- Historical analysis only. No prediction or recommendation.
- GitHub Pages first. No backend or database.
- Data integrity before visual novelty.
- Information density and scanability before decoration.
- One command path for development, data validation, and browser tests.

## Runtime Shape

```text
Visitor browser
  -> static HTML/CSS/ES modules on GitHub Pages
  -> same-origin JSON
  -> jsDelivr JSON fallback
  -> browser-cache fallback with explicit status

GitHub Actions
  -> public-source fetch and cross-check
  -> protected history update
  -> deterministic full recomputation
  -> strict quality gate
  -> data commit
  -> Pages deployment
```

## Current Baseline

- 3,527 validated draws.
- 24 annual files, 2003 through 2026.
- Latest local baseline: issue `2026130`, draw date `2026-11-12`.
- Approximate history plus generated data payload: 584 KB.
- 50-row trend view creates 2,900 table data cells.
- Full 3,527-row view creates 204,566 table cells and about 448,000 DOM nodes;
  measured desktop/mobile filter time is about 2.1 seconds.

## Non-Goals

- User accounts.
- Live betting or purchase links.
- Server-side APIs.
- Databases, Redis, Docker, or microservices.
- AI number recommendations.
- Native apps.
