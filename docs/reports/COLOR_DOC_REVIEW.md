# Color and Documentation Independent Review

Date: 2026-11-15

## Scope and baseline

This review covers only the current color, sticky-header, header-control,
README/AGENTS, and GitHub metadata increment.

- Branch: `codex/product-rebuild`
- HEAD: `7d91828`
- Remote tracking branch: `origin/codex/product-rebuild` at `afc77bd`
- Review mode: read-only; no product code was changed
- Browser: Chrome, `http://127.0.0.1:5173/`, 1440 and 390 CSS pixels
- Limited gates: one Chromium Playwright pass plus Axe `color-contrast` in
  light and dark themes; the full suite was intentionally not rerun

## Findings

### P0

None.

### P1

None.

### P2

#### 1. The insights frequency balls do not use the new radial treatment

The overview, trend table, and number-profile balls use radial highlights, but
the recent-frequency balls in the insights view still use flat backgrounds:

- [insights.css](/Users/minghan/workspace/ssq-hub/web/css/insights.css:247)
- [insights.css](/Users/minghan/workspace/ssq-hub/web/css/insights.css:260)

This is not an accessibility failure; the dark-theme foreground override still
applies. It is a visual component inconsistency and means the broad phrase
"number balls use radial color" is not yet true across every product view.

Required follow-up:

- Apply the same red/blue radial treatment and shadow tokens used by the trend
  and overview balls.
- Extend the color regression test to assert the insights frequency ball
  background, not only the trend-table ball.

#### 2. Harness and GitHub metadata records are stale

The current public GitHub API returns the updated description, homepage, and
topics. It also shows that `codex/product-rebuild` exists remotely at
`afc77bd`. However, the delivery record still states the opposite:

- [GITHUB_METADATA.md](/Users/minghan/workspace/ssq-hub/docs/reports/GITHUB_METADATA.md:64)
  says branch push and remote verification remain blocked.
- [tasks.json](/Users/minghan/workspace/ssq-hub/docs/harness/tasks.json:238)
  says origin contains only `main`, and
  [tasks.json](/Users/minghan/workspace/ssq-hub/docs/harness/tasks.json:240)
  says the branch has not been pushed.
- The current color/documentation increment has no corresponding task entry.

This does not invalidate the local product, but it breaks the Harness/FDE
evidence chain because current task state disagrees with authoritative Git and
GitHub state.

Required follow-up:

- Add a task entry for this increment with owner, write set, acceptance
  criteria, browser evidence, review verdict, and retry count.
- Correct `P10-REMOTE`: distinguish branch publication, metadata update,
  Actions execution, Pages deployment, and live-page verification.
- Mark the old public metadata snapshot as historical rather than current.

### P3

#### 1. The new color test is a presence check, not a visual-contract test

[app.spec.ts](/Users/minghan/workspace/ssq-hub/tests/e2e/app.spec.ts:198)
checks that gradients exist and that small/big colors differ. It does not prove:

- big/odd/prime map to red;
- small/even/composite map to blue;
- the foreground reaches the required contrast in both themes;
- insights frequency balls share the same styling contract.

Axe passed, so this is a future-regression risk rather than a current failure.

## Passing evidence

### Right-side structure colors

The semantic mapping is present and works in both themes:

- Big / odd / prime use `--red-deep`.
- Small / even / composite use `--blue-deep`.
- The mapping is defined in
  [trend-table.css](/Users/minghan/workspace/ssq-hub/web/css/trend-table.css:266).

Measured text/background contrast:

| Theme | Red structure | Blue structure |
|---|---:|---:|
| Light | 6.82:1 | 6.61:1 |
| Dark | 7.63:1 | 9.12:1 |

### Number-ball radial treatment and contrast

Overview and trend balls have radial highlights:

- [layout.css](/Users/minghan/workspace/ssq-hub/web/css/layout.css:317)
- [trend-table.css](/Users/minghan/workspace/ssq-hub/web/css/trend-table.css:220)

Dark mode switches ball text to dark ink through
[layout.css](/Users/minghan/workspace/ssq-hub/web/css/layout.css:310), rather
than placing white text on the lighter dark-theme color tokens.

Measured center-background contrast:

| Theme | Red ball text | Blue ball text |
|---|---:|---:|
| Light | 5.20:1 | 4.98:1 |
| Dark | 5.92:1 | 7.44:1 |

The radial screenshots were visually inspected in both themes. Ball digits
remain legible and red/blue identity remains distinct.

### Horizontal drag and cloned header

The cloned first header cell is blanked in
[trend-overlay.js](/Users/minghan/workspace/ssq-hub/web/js/trend-overlay.js:91).
After setting the table to `scrollLeft=420` and `scrollTop=120`:

- The source issue header and fixed issue layer both start at `x=0`.
- The transformed clone issue cell starts at `x=-420` and contains no text.
- `elementFromPoint` at the fixed issue-header center resolves to one visible
  `期号`, not two.
- Both light and dark screenshots show one issue label.

### Top-right controls

Both controls are visually icon-only and have accessible names:

- GitHub: `在 GitHub 查看 SSQ Hub 源码`
- Theme: `主题：浅色，点击选择`

The mobile target boxes measured `40x40px`; visible text was empty. The static
markup and runtime icon update are in
[index.html](/Users/minghan/workspace/ssq-hub/web/index.html:76) and
[theme.js](/Users/minghan/workspace/ssq-hub/web/js/theme.js:30).

### README and AGENTS

The mdxcn value is concrete and appropriate for a static README:

- README uses a readable fenced ASCII delivery figure at
  [README.md](/Users/minghan/workspace/ssq-hub/README.md:88).
- The reusable figure patterns are stored in
  [mdxcn-figures.md](/Users/minghan/workspace/ssq-hub/docs/templates/mdxcn-figures.md).
- All 15 relative README links resolved.
- Every documented npm command referenced by the review exists in
  `package.json`.
- AGENTS defines a complete DAG, bounded retry rule, evidence bundle, review
  loop, and delivery record at
  [AGENTS.md](/Users/minghan/workspace/ssq-hub/AGENTS.md:181).
- All 15 task records have the required fields, allowed states, and retries no
  greater than two.

The protocol is executable in form. Its current-state data needs the P2 update
described above.

### GitHub About, Homepage, and Topics

The public GitHub API currently returns:

- Description: `A modern Double Color Ball historical data analysis and
  visualization platform with automated data pipelines, statistical insights,
  and responsive charts.`
- Homepage: `https://zhouminghan.github.io/ssq-hub/`
- Topics: `data-analysis`, `data-visualization`, `github-pages`, `lottery`,
  `python`, `ssq`, `typescript`
- Pages enabled: `true`

These values match the applied metadata section of
[GITHUB_METADATA.md](/Users/minghan/workspace/ssq-hub/docs/reports/GITHUB_METADATA.md:54).

## Limited command evidence

Observed in this review:

- Chrome Playwright custom scope: PASS
- Axe `color-contrast`, light trend: 0 violations
- Axe `color-contrast`, dark trend: 0 violations
- Page errors and console errors: none
- Header-icon mobile target sizes: GitHub `40x40`, theme `40x40`
- GitHub public API metadata and remote branch: verified
- README relative links and npm script names: verified
- Harness task field/state/retry validation: 15/15 valid

Not run:

- Full Playwright suite
- Full Python or data gates
- Remote Actions execution
- Pages deployment verification
- Live Pages browser verification

## Verdict

**Local delivery: PASS WITH P2 FOLLOW-UP.**

There are no P0 or P1 findings in the reviewed increment. The requested visual
semantics, contrast, single header label, icon-only controls, README figures,
and GitHub About values are working in the current local build.

The two P2 items should be closed before the next full acceptance record:
finish radial consistency in insights, then reconcile Harness and GitHub
metadata state with the actual remote branch.

**Remote status: BLOCKED.** The reviewed working tree is not committed or
pushed. Remote Actions/Pages and the live Pages version remain unverified.
The local `gh` keychain status also returned an invalid-token error during this
review, although public API reads succeeded.

## Main-Controller Follow-up

The P2/P3 follow-ups from this review were closed after the review:

- Insights high-frequency balls now use the same red/blue radial treatment as
  overview, trend-table, and profile balls.
- The color test now asserts big/odd/prime resolve to `--red-deep`,
  small/even/composite resolve to `--blue-deep`, and insights frequency balls
  have the radial treatment.
- `GITHUB_METADATA.md` and Harness task state now reflect the actual remote
  branch at `afc77bd`, the applied About/Homepage/Topics, and the fact that the
  current local commits remain ahead and unpushed.
- The current local `gh` keyring was independently rechecked and resolves
  `zhouminghan` successfully when stale inherited environment tokens are
  removed.

The remote branch still needs the latest local commits, Actions/PR execution,
Pages deployment, and live-page verification.
