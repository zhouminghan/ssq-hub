# SSQ Hub 项目文件与目录审查清单

审查日期：2026-11-15

审查范围：

- 已跟踪文件：156 个。
- 已忽略的本地生成目录：11 个。
- 未跟踪文件：0 个。
- 空文件：1 个，即 `web/.nojekyll`，这是 GitHub Pages 的刻意配置。
- 损坏 JSON：0 个。
- 重复文件内容：0 组。
- 本次删除文件：0 个。

标记说明：

- `保留-运行`：生产运行、构建、测试或部署必需。
- `保留-数据`：受保护的历史数据或数据契约。
- `保留-证据`：验收、审计、架构或交付证据。
- `保留-内容`：可以用于产品说明或延伸阅读。
- `保留-可选`：当前不是运行必需，但有明确参考价值。
- `待确认删除`：可以删除，但必须先得到用户确认。
- `忽略`：属于生成物、缓存或本地依赖，不应提交。

## 一、目录审查

| 目录 | 文件数 | 建议 | 说明 |
|---|---:|---|---|
| `.github/workflows/` | 4 | 保留-运行 | CI、数据更新、历史修复和 Pages 部署 |
| `docs/architecture/` | 7 | 保留-证据 | 系统、数据、前端和 CI/CD 架构 |
| `docs/development/` | 6 | 保留-运行 | 新人接手、开发、测试、部署和排障 |
| `docs/harness/` | 1 | 保留-证据 | 可恢复任务状态与执行证据 |
| `docs/reports/` | 14 | 保留-证据 | 基线、审计、验收和本清单 |
| `docs/screenshots/` | 6 | 保留-运行 | README 和视觉回归使用的真实截图 |
| `docs/templates/` | 1 | 保留-可选 | README 图形模板，删除不影响运行 |
| `pocs/vue-table/` | 9 | 保留-可选 | 架构 ADR 的历史对照实验，删除不影响生产 |
| `schemas/` | 10 | 保留-数据 | JSON Schema 2020-12 数据契约 |
| `scripts/` | 10 | 保留-运行 | 数据抓取、统计、清单、服务和验证 |
| `tests/e2e/` | 4 | 保留-运行 | Playwright 产品验收 |
| `tests/python/` | 4 | 保留-运行 | 数据管道与历史保护测试 |
| `tests/schema/` | 1 | 保留-运行 | Ajv 数据验证 |
| `tests/unit/` | 2 | 保留-运行 | 浏览器模块单元测试 |
| `web/assets/img/` | 3 | 保留-运行 | 站点图标、Logo 和分享图 |
| `web/config/` | 1 | 保留-运行 | 官方休市和临时停售窗口 |
| `web/css/` | 9 | 保留-运行 | 主题、布局、表格、抽屉和响应式样式 |
| `web/data/history/` | 24 | 保留-数据 | 2003 至 2026 年受保护历史记录 |
| `web/data/` | 30 | 保留-数据 | 历史记录、统计、清单、来源和指纹 |
| `web/js/` | 12 | 保留-运行 | 浏览器应用与工具模块 |

## 二、根目录文件

| 文件 | 建议 | 用途 |
|---|---|---|
| `.gitignore` | 保留-运行 | 忽略依赖、缓存、测试报告和工具生成物 |
| `AGENTS.md` | 保留-运行 | 项目级工程规则和 Agent 边界 |
| `LICENSE` | 保留-运行 | MIT 开源许可证 |
| `README.md` | 保留-运行 | 简体中文项目说明和 GitHub 链接 |
| `eslint.config.js` | 保留-运行 | JavaScript lint 配置 |
| `package-lock.json` | 保留-运行 | Node 依赖锁定 |
| `package.json` | 保留-运行 | 前端开发与质量命令 |
| `playwright.config.ts` | 保留-运行 | Chrome 桌面与移动端 E2E 配置 |
| `playwright.cross-browser.config.ts` | 保留-运行 | Firefox 与 WebKit 测试配置 |
| `pyproject.toml` | 保留-运行 | Python 测试和 Ruff 配置 |
| `requirements-dev.txt` | 保留-运行 | Python 测试依赖入口 |
| `requirements-lint.txt` | 保留-运行 | Ruff 依赖入口 |
| `requirements-runtime.lock` | 保留-运行 | 生产数据任务锁定依赖 |
| `requirements.lock` | 保留-运行 | CI 完整开发依赖锁 |
| `requirements.txt` | 保留-运行 | Python 运行时依赖入口 |
| `tsconfig.json` | 保留-运行 | JavaScript 类型检查配置 |

## 三、GitHub 工作流

| 文件 | 建议 | 用途 |
|---|---|---|
| `.github/workflows/ci.yml` | 保留-运行 | 完整质量门禁 |
| `.github/workflows/data-repair.yml` | 保留-运行 | 人工确认的受保护历史修复 |
| `.github/workflows/deploy-pages.yml` | 保留-运行 | 差异门禁和 Pages 发布 |
| `.github/workflows/update-data.yml` | 保留-运行 | 定时和手动数据更新 |

## 四、架构与开发文档

| 文件 | 建议 | 用途 |
|---|---|---|
| `docs/architecture/CI_CD.md` | 保留-证据 | CI/CD 设计 |
| `docs/architecture/DATA_FLOW.md` | 保留-证据 | 数据流说明 |
| `docs/architecture/DATA_PIPELINE.md` | 保留-证据 | 数据管道设计 |
| `docs/architecture/FRONTEND_ARCHITECTURE.md` | 保留-证据 | 前端模块边界 |
| `docs/architecture/SYSTEM_ARCHITECTURE.md` | 保留-证据 | 系统架构 |
| `docs/architecture/SYSTEM_OVERVIEW.md` | 保留-证据 | 系统概览 |
| `docs/architecture/TECHNICAL_DECISIONS.md` | 保留-证据 | 技术选型与 POC 结论 |
| `docs/development/CONTRIBUTING.md` | 保留-运行 | 贡献规范 |
| `docs/development/DEPLOYMENT_GUIDE.md` | 保留-运行 | 部署指南 |
| `docs/development/DEVELOPMENT_GUIDE.md` | 保留-运行 | 开发指南 |
| `docs/development/GETTING_STARTED.md` | 保留-运行 | 新人安装和运行 |
| `docs/development/TESTING_GUIDE.md` | 保留-运行 | 测试指南 |
| `docs/development/TROUBLESHOOTING.md` | 保留-运行 | 常见故障排查 |

## 五、任务证据、报告和截图

| 文件 | 建议 | 用途 |
|---|---|---|
| `docs/harness/tasks.json` | 保留-证据 | 任务依赖、状态和证据索引 |
| `docs/reports/BASELINE.md` | 保留-证据 | 重构前基线 |
| `docs/reports/COLOR_DOC_REVIEW.md` | 保留-证据 | 配色和文档独立复核 |
| `docs/reports/FINAL_ACCEPTANCE.md` | 保留-证据 | 最终验收报告 |
| `docs/reports/FUNCTION_PARITY.md` | 保留-证据 | 原版功能逐项对账 |
| `docs/reports/GITHUB_METADATA.md` | 保留-证据 | GitHub About 和历史状态 |
| `docs/reports/INDEPENDENT_REVIEW.md` | 保留-证据 | 独立审核记录 |
| `docs/reports/ONBOARDING.md` | 保留-证据 | 干净克隆接手测试 |
| `docs/reports/PERFORMANCE.md` | 保留-证据 | 启动和全量渲染性能 |
| `docs/reports/PRODUCT_AUDIT.md` | 保留-证据 | 原产品功能审计 |
| `docs/reports/PROJECT_FILE_INVENTORY.md` | 保留-证据 | 当前文件与删除候选清单 |
| `docs/reports/QA_REPORT.md` | 保留-证据 | 自动化测试和浏览器证据 |
| `docs/reports/UX_AUDIT_2026-11-14.md` | 保留-证据 | UX 走查 |
| `docs/reports/UX_BOUNDARY_REVIEW.md` | 保留-证据 | 边界、跨年、停开奖和容错复核 |
| `docs/reports/baseline-sha256.txt` | 保留-证据 | 重构前受保护数据校验和 |
| `docs/screenshots/desktop-dark.png` | 保留-运行 | README 深色桌面截图 |
| `docs/screenshots/desktop-light.png` | 保留-运行 | README 浅色桌面截图 |
| `docs/screenshots/insights-light.png` | 保留-运行 | 数据洞察截图 |
| `docs/screenshots/insights-mobile-dark.png` | 保留-运行 | README 深色移动端截图 |
| `docs/screenshots/mobile-dark.png` | 保留-运行 | 深色移动端截图 |
| `docs/screenshots/mobile-light.png` | 保留-运行 | README 浅色移动端截图 |

## 六、内容文档与模板

| 文件 | 建议 | 用途 |
|---|---|---|
| `docs/双色球概率统计.md` | 保留-内容 | 概率、期望和理性决策说明 |
| `docs/双色球真相.md` | 保留-内容 | 历史事件和公信力资料汇编 |
| `docs/templates/mdxcn-figures.md` | 保留-可选 | README ASCII 图形模板 |

## 七、Vue 架构对照实验

| 文件 | 建议 | 用途 |
|---|---|---|
| `pocs/vue-table/.gitignore` | 保留-可选 | POC 生成物忽略规则 |
| `pocs/vue-table/README.md` | 保留-可选 | POC 运行说明 |
| `pocs/vue-table/index.html` | 保留-可选 | POC 页面入口 |
| `pocs/vue-table/package-lock.json` | 保留-可选 | POC 依赖锁定 |
| `pocs/vue-table/package.json` | 保留-可选 | POC 依赖和脚本 |
| `pocs/vue-table/scripts/copy-data.mjs` | 保留-可选 | 复制真实数据 |
| `pocs/vue-table/src/main.js` | 保留-可选 | Vue 表格实验 |
| `pocs/vue-table/src/style.css` | 保留-可选 | POC 样式 |
| `pocs/vue-table/vite.config.js` | 保留-可选 | Vite 配置 |

整个 `pocs/vue-table/` 不参与生产运行。若用户确认不再需要技术选型证据，可以整体删除，并同步移除架构文档和任务证据中的引用。

## 八、数据契约

| 文件 | 建议 | 用途 |
|---|---|---|
| `schemas/corrections.schema.json` | 保留-数据 | 历史修正记录契约 |
| `schemas/draw.schema.json` | 保留-数据 | 单期开奖记录契约 |
| `schemas/history-baseline.schema.json` | 保留-数据 | 历史指纹契约 |
| `schemas/history-index.schema.json` | 保留-数据 | 年度索引契约 |
| `schemas/history.schema.json` | 保留-数据 | 年度历史文件契约 |
| `schemas/latest.schema.json` | 保留-数据 | 最新开奖契约 |
| `schemas/manifest.schema.json` | 保留-数据 | 数据清单契约 |
| `schemas/pause-windows.schema.json` | 保留-数据 | 停开奖窗口契约 |
| `schemas/source-state.schema.json` | 保留-数据 | 数据来源状态契约 |
| `schemas/stats.schema.json` | 保留-数据 | 统计结果契约 |

## 九、脚本

| 文件 | 建议 | 用途 |
|---|---|---|
| `scripts/_paths.py` | 保留-运行 | 统一数据路径 |
| `scripts/_utils.py` | 保留-运行 | 原子写入和共享工具 |
| `scripts/calc_all.py` | 保留-运行 | 全量统计计算 |
| `scripts/dev-server.mjs` | 保留-运行 | 本地静态服务器 |
| `scripts/fetch_latest.py` | 保留-运行 | 数据源抓取和交叉核验 |
| `scripts/manifest.py` | 保留-运行 | 数据清单生成 |
| `scripts/measure-performance.mjs` | 保留-运行 | 性能测量 |
| `scripts/schema.py` | 保留-运行 | Python Schema 验证 |
| `scripts/update_baseline.py` | 保留-运行 | 受保护基线刷新 |
| `scripts/verify_data.py` | 保留-运行 | 严格数据质量门禁 |

## 十、测试

| 文件 | 建议 | 用途 |
|---|---|---|
| `tests/e2e/app.spec.ts` | 保留-运行 | 核心产品 E2E |
| `tests/e2e/cross-browser.spec.ts` | 保留-运行 | 跨浏览器冒烟 |
| `tests/e2e/performance.spec.ts` | 保留-运行 | 浏览器性能测试 |
| `tests/e2e/visual.spec.ts` | 保留-运行 | 视觉回归 |
| `tests/python/test_fetch_logic.py` | 保留-运行 | 抓取与容错测试 |
| `tests/python/test_history_protection.py` | 保留-运行 | 历史保护测试 |
| `tests/python/test_schema.py` | 保留-运行 | Python Schema 测试 |
| `tests/python/test_stats.py` | 保留-运行 | 统计一致性测试 |
| `tests/schema/validate-data.mjs` | 保留-运行 | JSON Schema 验证 |
| `tests/unit/format.test.js` | 保留-运行 | 日期与期号工具测试 |
| `tests/unit/store.test.js` | 保留-运行 | 状态订阅测试 |

## 十一、Web 入口、资源与样式

| 文件 | 建议 | 用途 |
|---|---|---|
| `web/.nojekyll` | 保留-运行 | 禁用 Jekyll，空文件是预期配置 |
| `web/index.html` | 保留-运行 | 应用入口和 SEO 元信息 |
| `web/robots.txt` | 保留-运行 | 搜索引擎规则 |
| `web/sitemap.xml` | 保留-运行 | 站点地图 |
| `web/assets/img/favicon.svg` | 保留-运行 | 站点图标 |
| `web/assets/img/logo.svg` | 保留-运行 | 品牌 Logo |
| `web/assets/img/og-cover.png` | 保留-运行 | Open Graph 分享图 |
| `web/config/lottery_pause_windows.json` | 保留-运行 | 春节等停开奖配置 |
| `web/css/filter-bar.css` | 保留-运行 | 筛选器样式 |
| `web/css/insights.css` | 保留-运行 | 数据洞察样式 |
| `web/css/layout.css` | 保留-运行 | 页面布局 |
| `web/css/number-profile.css` | 保留-运行 | 号码画像样式 |
| `web/css/reset.css` | 保留-运行 | 基础重置 |
| `web/css/responsive.css` | 保留-运行 | 响应式覆盖 |
| `web/css/theme.css` | 保留-运行 | 深浅色设计变量 |
| `web/css/trend-overlay.css` | 保留-运行 | 蓝球 SVG 连线样式 |
| `web/css/trend-table.css` | 保留-运行 | 58 列走势表样式 |

## 十二、浏览器 JavaScript

| 文件 | 建议 | 用途 |
|---|---|---|
| `web/js/dashboard.js` | 保留-运行 | 概览和数据状态 |
| `web/js/data-loader.js` | 保留-运行 | JSON、CDN 和缓存加载 |
| `web/js/filter-bar.js` | 保留-运行 | 筛选和对比 |
| `web/js/insights.js` | 保留-运行 | 数据洞察视图 |
| `web/js/main.js` | 保留-运行 | 应用装配和启动 |
| `web/js/number-profile.js` | 保留-运行 | 号码画像抽屉 |
| `web/js/store.js` | 保留-运行 | 浏览器状态订阅 |
| `web/js/theme.js` | 保留-运行 | 三态主题 |
| `web/js/trend-overlay.js` | 保留-运行 | 蓝球 SVG 与吸顶表头 |
| `web/js/trend-table.js` | 保留-运行 | 58 列走势矩阵 |
| `web/js/utils/dom.js` | 保留-运行 | DOM 工具 |
| `web/js/utils/format.js` | 保留-运行 | 日期、期号和节流工具 |

## 十三、Web 数据

| 文件 | 建议 | 用途 |
|---|---|---|
| `web/data/history/2003.json` | 保留-数据 | 2003 年受保护历史 |
| `web/data/history/2004.json` | 保留-数据 | 2004 年受保护历史 |
| `web/data/history/2005.json` | 保留-数据 | 2005 年受保护历史 |
| `web/data/history/2006.json` | 保留-数据 | 2006 年受保护历史 |
| `web/data/history/2007.json` | 保留-数据 | 2007 年受保护历史 |
| `web/data/history/2008.json` | 保留-数据 | 2008 年受保护历史 |
| `web/data/history/2009.json` | 保留-数据 | 2009 年受保护历史 |
| `web/data/history/2010.json` | 保留-数据 | 2010 年受保护历史 |
| `web/data/history/2011.json` | 保留-数据 | 2011 年受保护历史 |
| `web/data/history/2012.json` | 保留-数据 | 2012 年受保护历史 |
| `web/data/history/2013.json` | 保留-数据 | 2013 年受保护历史 |
| `web/data/history/2014.json` | 保留-数据 | 2014 年受保护历史 |
| `web/data/history/2015.json` | 保留-数据 | 2015 年受保护历史 |
| `web/data/history/2016.json` | 保留-数据 | 2016 年受保护历史 |
| `web/data/history/2017.json` | 保留-数据 | 2017 年受保护历史 |
| `web/data/history/2018.json` | 保留-数据 | 2018 年受保护历史 |
| `web/data/history/2019.json` | 保留-数据 | 2019 年受保护历史 |
| `web/data/history/2020.json` | 保留-数据 | 2020 年受保护历史 |
| `web/data/history/2021.json` | 保留-数据 | 2021 年受保护历史 |
| `web/data/history/2022.json` | 保留-数据 | 2022 年受保护历史 |
| `web/data/history/2023.json` | 保留-数据 | 2023 年受保护历史 |
| `web/data/history/2024.json` | 保留-数据 | 2024 年受保护历史 |
| `web/data/history/2025.json` | 保留-数据 | 2025 年受保护历史 |
| `web/data/history/2026.json` | 保留-数据 | 2026 年受保护历史 |
| `web/data/history_baseline.json` | 保留-数据 | 历史记录 SHA-256 指纹 |
| `web/data/history_index.json` | 保留-数据 | 年度索引与总期数 |
| `web/data/latest.json` | 保留-数据 | 最新一期摘要 |
| `web/data/manifest.json` | 保留-数据 | 年度和全量数据清单 |
| `web/data/source_state.json` | 保留-数据 | 数据源核验状态 |
| `web/data/stats.json` | 保留-数据 | 完整统计结果 |

## 十四、已忽略的本地目录

以下内容不会进入 Git，当前可以保留在本地以加快开发，也可以在需要释放空间时清理：

| 目录 | 说明 | 建议 |
|---|---|---|
| `.codebuddy/` | AI 工具生成的架构执行计划 | 忽略；可在确认后删除 |
| `.pytest_cache/` | pytest 缓存 | 忽略；可随时删除 |
| `.ruff_cache/` | Ruff 缓存 | 忽略；可随时删除 |
| `.venv/` | Python 虚拟环境 | 忽略；删除后需重新安装 |
| `node_modules/` | 根项目 Node 依赖 | 忽略；删除后运行 `npm ci` |
| `playwright-report/` | Playwright HTML 报告 | 忽略；可随时删除 |
| `test-results/` | Playwright 失败和运行证据 | 忽略；可随时删除 |
| `pocs/vue-table/dist/` | Vue POC 构建产物 | 忽略；可随时删除 |
| `pocs/vue-table/node_modules/` | Vue POC 依赖 | 忽略；删除后可释放较多空间 |
| `pocs/vue-table/public/data/` | 从 `web/data/` 复制的 POC 数据 | 忽略；可随时删除 |
| `scripts/__pycache__/` | Python 字节码缓存 | 忽略；可随时删除 |
| `tests/python/__pycache__/` | Python 测试字节码缓存 | 忽略；可随时删除 |

## 十五、待用户确认的清理项

以下操作尚未执行：

1. 删除整个 `pocs/vue-table/`，包括 9 个已跟踪文件。
2. 删除 `docs/templates/mdxcn-figures.md`。
3. 删除全部已忽略缓存、测试报告和本地 POC 依赖。
4. 只删除 `pocs/vue-table/node_modules/`、`dist/`、`public/data/`，保留 9 个 POC 源文件。

当前建议：

- 推荐先执行第 4 项，释放本地空间，同时保留架构选型证据。
- 第 1 项应在确认不再需要 Vue POC 后执行，并同步更新 `TECHNICAL_DECISIONS.md` 和任务证据。
- 第 2 项价值较低，但体积很小，可以继续保留。
- 第 3 项中的 `.venv/` 和根 `node_modules/` 删除后需要重新安装，不建议在本轮直接执行。

## 十六、本次忽略规则调整

`.gitignore` 新增以下内容：

```text
blob-report/
coverage/
ci-logs/
deploy-logs/
.eslintcache
*.tsbuildinfo
```

这些路径属于测试、CI、覆盖率或工具生成物，不应进入 Git。

## 十七、审查执行证据

| 检查 | 结果 |
|---|---|
| `git status --short --untracked-files=all` | 审查前无未跟踪文件 |
| 已跟踪文件存在性 | 全部存在 |
| 非预期空文件 | 0 个；`web/.nojekyll` 为刻意保留 |
| JSON 全量解析 | 全部通过 |
| 重复文件内容 | 0 组 |
| README 与清单本地链接 | 全部可解析 |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| `npm run test:unit` | 7 项通过 |
| `npm run test:python` | 47 项通过 |
| `npm run test:schema` | 31 个数据文件通过 |
| `.venv/bin/python scripts/verify_data.py` | 0 个错误，0 个警告 |
| GitHub 仓库地址 | HTTP 200 |
| GitHub Pages 地址 | HTTP 200 |

## 十八、审查结论

- 除刻意保留的 `web/.nojekyll` 外，没有空文件。
- 所有 JSON 文件均可解析。
- 所有已跟踪文件均存在。
- 未发现重复文件内容。
- 未发现未跟踪文件。
- 生产 Web、数据、测试、工作流和受保护历史数据均有明确用途。
- 真正可删除的内容主要是本地生成物和可选 POC，不建议直接删除核心文档、测试证据或历史数据。
