# Deployment Guide

## Hosting

GitHub Pages serves the repository `web/` directory at:

<https://zhouminghan.github.io/ssq-hub/>

No server process or build output directory is required for the application.

## Frontend Deployment

A push to `main` touching `web/**` except `web/data/**` triggers
`deploy-pages.yml`. The workflow packages `web/`, applies a query-string cache
buster, uploads the Pages artifact, and deploys.

## Data Deployment

`update-data.yml` commits verified data. A successful completion triggers
`deploy-pages.yml`. The deployment gate compares the pre-update workflow SHA
with current `main` and checks whether `web/` changed.

## Required Repository Settings

- Pages source: GitHub Actions.
- Default branch: `main`.
- Actions workflow permissions: read by default; workflows request the minimum
  needed write permissions.
- For corrections: create a `data-repair` environment with required reviewers.
- Optional repository variable `LOTTERY_PAUSE_UNTIL=YYYY-MM-DD` suppresses
  expected-draw failures during official holiday suspensions.
- Optionally require the CI workflow checks on `main`.

## First Deployment Verification

After an authorized push:

1. Open the Actions run and confirm CI, data, and Pages jobs.
2. Confirm Pages reports the expected commit SHA.
3. Open the live URL and verify `latest.json` issue/date.
4. Check `manifest.json` generation timestamp and record hash.
5. Run the same Playwright smoke tests against the live URL.

Do not claim live success before these checks.

## Rollback

Revert the site or data commit through a reviewed pull request. Never rewrite
the protected history or force-push main.
