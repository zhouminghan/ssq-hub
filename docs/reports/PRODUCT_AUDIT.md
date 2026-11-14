# Product & UX Audit：codex/product-rebuild

审计日期：2026-11-14（Asia/Shanghai）

> **历史快照 / SUPERSEDED**
>
> 本报告记录重构过程中、浏览器复验之前的一次源码审计。其“0 项浏览器通过”
> 和“部署 BLOCKED”是当时状态。后续已补齐真实浏览器、Axe、视觉与 WebKit
> 验证，并完成 Compare、焦点、来源和响应式修复。当前结论以
> `docs/reports/FINAL_ACCEPTANCE.md`、`QA_REPORT.md` 和
> `INDEPENDENT_REVIEW.md` 为准。

## 审计结论

本次只完成**源码级产品审计**，没有完成真实浏览器验收。

`codex/product-rebuild` 工作区的 `web/` 已包含新版产品概览、双视图导航、58 列走势表、筛选器、号码画像抽屉、数据洞察、主题系统和响应式规则。按代码阅读，34 项能力中 32 项已有完整实现路径，1 项部分实现（同期对比缺少选择期号的操作），1 项无法确认（页面部署）。

但是，`node scripts/dev-server.mjs 8773 web` 首次启动被沙箱以 `EPERM: operation not permitted 127.0.0.1:8773` 拒绝；随后的提权启动在用户中断时被中止。因此：

- 真实浏览器执行次数：**0**
- 1440 / 1280 / 768 / 390 / 375 宽度检查：**未执行**
- 浅色 / 深色截图：**未生成**
- Console / Network / 交互日志：**未采集**
- `Gate 3`（真实浏览器 UI 验收）：**未通过**
- `Gate 7`（浏览器 E2E 与截图回归）：**未通过**

以下“通过”仅表示**源码中存在对应实现且静态逻辑闭合**，不等于浏览器验收通过。

## 基线

- 分支：`codex/product-rebuild`
- HEAD：`8594a6b807de8f5e5860353929dde92be0c46d6c`
- 本地工作区：大量已修改和未跟踪文件；本报告未修改 `web/` 或其他文件
- 技术形态：原生 HTML + CSS + ES Modules，无前端框架运行时
- 核心源码：`web/index.html`、10 个 CSS 文件、11 个 JS 模块
- 可见能力：走势分析、数据洞察、主题切换、号码画像、筛选、数据缓存与 CDN 兜底

## 状态定义

| 标记 | 含义 |
|---|---|
| PASS-CODE | 源码存在完整实现路径，静态阅读未见阻断性逻辑缺口 |
| PARTIAL | 有实现，但用户操作或信息完整性不足 |
| BLOCKED | 当前无法验证或依赖未提交/未部署环境 |
| FAIL | 已确认功能缺失或实现错误 |

## 34 项能力对账

| # | 能力 | 现状 | 源码位置与证据 |
|---:|---|---|---|
| 1 | 双色球历史开奖数据 | PASS-CODE | `web/data/history/2003.json` 至 `2026.json` 共 24 个年度文件；`web/data/history_index.json` 提供索引 |
| 2 | 期号和开奖日期 | PASS-CODE | `web/js/dashboard.js:18-19` 渲染 `issue`、`date`；`web/js/trend-table.js:92-99` 渲染期号列 |
| 3 | 红球 33 个号码 | PASS-CODE | `web/js/trend-table.js:32-40` 循环 1..33 生成表头；`:102-127` 生成 33 个红球单元格 |
| 4 | 蓝球 16 个号码 | PASS-CODE | `web/js/trend-table.js:42-50` 循环 1..16 生成表头；`:130-155` 生成 16 个蓝球单元格 |
| 5 | 遗漏值 | PASS-CODE | `web/js/trend-table.js:76-78` 维护红蓝遗漏状态；`:113-126`、`:141-153` 输出遗漏值 |
| 6 | 历史频次 | PASS-CODE | `web/js/number-profile.js:146-159` 展示 `freq_global`；`:165-172` 频次对比卡 |
| 7 | 近 50 期频次 | PASS-CODE | `web/js/number-profile.js:171` 读取 `freq_50`；`web/js/insights.js:114-135` 展示 `red_freq_50` / `blue_freq_50` |
| 8 | 近 100 期频次 | PASS-CODE | `web/js/number-profile.js:170` 读取 `freq_100` |
| 9 | 最大遗漏 | PASS-CODE | `web/js/number-profile.js:155-158`、`:182-190` 展示 `max_miss` 与发生期号 |
| 10 | 最近 5 次出现记录 | PASS-CODE | `web/js/number-profile.js:194-211` 渲染 `recent_5_issues` |
| 11 | 连号分析 | PASS-CODE | `web/js/insights.js:92-111` 的 `patternCard()` 展示连号覆盖比例 |
| 12 | 同尾分析 | PASS-CODE | `web/js/insights.js:95-109` 的 `same_tail` 指标 |
| 13 | AC 值分布 | PASS-CODE | `web/js/insights.js:71-90` 的 `acCard()` |
| 14 | 区间分布 | PASS-CODE | `web/js/insights.js:54-58` 展示 `zone1:zone2:zone3`；`web/js/utils/format.js:98-100` 计算三区 |
| 15 | 奇偶结构 | PASS-CODE | `web/js/insights.js:59-62`；`web/js/trend-table.js:164-167` |
| 16 | 大小结构 | PASS-CODE | `web/js/insights.js:63-66`；`web/js/trend-table.js:160-163` |
| 17 | Recent N 筛选 | PASS-CODE | `web/js/filter-bar.js:97-136` 的下拉与自定义 popover；`:139-191` 自定义期数 |
| 18 | 年份筛选 | PASS-CODE | `web/js/filter-bar.js:194-209` 渲染年份下拉 |
| 19 | Compare 对比模式 | PARTIAL | `web/js/filter-bar.js:211-220` 只展示当前对齐期号；`web/js/filter-bar.js:22-29` 默认期号由最新期 +1 自动生成，页面没有让用户选择对比期号的控件。模式存在，但“选择哪些期做对比”的核心操作缺失 |
| 20 | 号码画像抽屉 | PASS-CODE | `web/js/number-profile.js:24-77` 挂载抽屉；`:84-116` 打开/关闭、Escape、焦点返回；`:122-212` 完整画像内容 |
| 21 | 蓝球 SVG 连线 | PASS-CODE | `web/js/trend-overlay.js:13-50` 收集蓝球中奖格中心并绘制 `polyline`；`:56-75` 随滚动/resize 重绘 |
| 22 | 最近 5 期高亮 | PASS-CODE | `web/js/trend-table.js:80-83`、`:173-175` 标记 `recent-5`；`web/css/trend-table.css:211-215` 金色描边 |
| 23 | 最新期定位 | PASS-CODE | `web/js/trend-table.js:175-178` 标记 `is-latest`；`web/js/main.js:96`、`:109-120` 渲染后滚动到底部 |
| 24 | 横向滚动 | PASS-CODE | `web/css/layout.css:468-475` 的 `.trend-scroll { overflow: auto; }`；`web/css/trend-table.css:7-9` 表格使用 `max-content` |
| 25 | 固定期号列 | PASS-CODE | `web/css/trend-table.css:55-62` 表头 `left: 0`；`:97-110` 表体期号列 `position: sticky; left: 0` |
| 26 | 吸顶表头 | PASS-CODE | `web/css/trend-table.css:18-33` 的 `thead th { position: sticky; top: 0; }` |
| 27 | 深色模式 | PASS-CODE | `web/css/theme.css:72-120` 完整深色 token；`web/index.html:38-42` 首屏前应用主题 |
| 28 | 浅色模式 | PASS-CODE | `web/css/theme.css:1-70` 浅色 token |
| 29 | Auto 主题模式 | PASS-CODE | `web/js/theme.js:17-28`、`:74-121` 监听 `prefers-color-scheme`；移除 `theme` key 即回到 Auto |
| 30 | 移动端适配 | PASS-CODE | `web/css/responsive.css:58-284` 覆盖 760px 以下布局；`web/css/filter-bar.css:181-222` 筛选栏横向滚动；`web/css/number-profile.css:302-305` 抽屉全屏 |
| 31 | 数据加载失败提示 | PASS-CODE | `web/js/main.js:30-58` 重试 2 次后展示错误；`:134-152` 错误态与重试按钮；`web/index.html:188-206` 12 秒启动兜底 |
| 32 | CDN fallback | PASS-CODE | `web/js/data-loader.js:69-129` 主源失败切 jsDelivr，再失败读浏览器缓存 |
| 33 | 加载缓存 | PASS-CODE | `web/js/data-loader.js:19-26` 内存 TTL；`:46-67`、`:113-123` localStorage 缓存 |
| 34 | 页面部署 | BLOCKED | 存在 `.github/workflows/deploy-pages.yml`，但当前分支相关改动尚未提交，无法确认部署分支内容、Pages 构建结果或线上地址；本次未访问线上页面 |

## 代码层验收汇总

- PASS-CODE：32 / 34
- PARTIAL：1 / 34（#19 同期对比）
- BLOCKED：1 / 34（#34 页面部署）
- FAIL（已确认源码缺陷，未计入 34 项阻断）：0 个直接功能缺失；另有 4 个需要修复的 UX/可访问性/元信息问题，见下节
- 真实浏览器验收通过：0 / 34

## 已确认缺陷

### P1：同期对比没有真正的选择操作

`web/js/filter-bar.js:22-29` 根据最新期号自动生成对比期号列表，`web/js/filter-bar.js:211-220` 只显示“第 N 期”和匹配年份数，没有年份多选、期号输入或对齐方式选择。用户可以进入 Compare tab，但不能控制比较对象，不能完成“跨年同期对比”的核心用户流程。

### P1：真实浏览器 Gate 未完成

`node scripts/dev-server.mjs 8773 web` 在沙箱内返回 `EPERM`；提权启动在完成前被中断。没有真实页面、截图、Console、Network 或交互证据，因此以下项目均不能标记为通过：

- 1440 / 1280 / 768 / 390 / 375 五种宽度
- 深色 / 浅色主题
- 横向滚动、固定期号列、吸顶表头在真实布局中的同步
- SVG 连线与表格坐标对齐
- 抽屉移动端全屏与焦点管理
- 主题菜单、筛选器、自定义期数 popover 的实际交互

### P1：页面部署状态不可确认

当前分支的 `web/`、workflow、测试和文档中仍有大量未提交文件。即使源码存在部署 workflow，也不能把 GitHub Pages 视为已部署或已通过。`#34` 必须保持 BLOCKED，直到分支提交、workflow 运行并访问真实 Pages URL。

### P2：OG/Twitter 分享图缺失

`web/index.html:14` 和 `web/index.html:20` 引用 `assets/img/og-cover.png`，但 `web/assets/img/` 当前只有 `favicon.svg` 和 `logo.svg`。分享卡片会请求不存在的图片，属于元信息缺陷。

### P2：走势表号码单元无法通过键盘聚焦

`web/js/trend-table.js:188-195` 仅给 `tbody` 绑定 click，红蓝号码格是普通 `td`，没有 `tabindex`、`role="button"` 或键盘事件。用户可以用表头按钮打开画像，但不能用 Tab 遍历表体号码并回车打开画像，未达到 WCAG 2.2 AA 的完整键盘操作要求。

### P2：筛选器和主题菜单的键盘语义不完整

- `web/js/filter-bar.js:47-57` 使用 `role="tab"`，但没有 `aria-controls`、tabpanel 关系或方向键切换。
- `web/index.html:93-103` 使用 `role="listbox"` / `role="option"`，但菜单项是 `button`，没有列表键盘导航或 `aria-activedescendant`。
- `web/js/theme.js:93-105` 只处理 click，没有 ArrowUp / ArrowDown / Home / End 键支持。

### P2：移动端概览隐藏历史规模信息

`web/css/responsive.css:177-194` 在 760px 以下隐藏“历史样本”和“覆盖年份”，只保留数据状态。移动端用户无法在首屏确认数据总量和覆盖年份，适合后续改为紧凑摘要或可展开信息。

### P2：数据来源与生成时间展示不完整

`web/js/dashboard.js:35-56` 只展示新鲜度或“使用本地缓存”，没有稳定展示数据来源、生成时间和 pipeline 版本。`web/js/data-loader.js:40-43` 虽记录 `source` / `lastLoadedAt`，但页面只使用 `cached` 分支。若数据来自 CDN 或内存缓存，用户无法明确区分。

### P3：洞察视图只渲染一次

`web/js/insights.js:187-206` 使用模块级 `rendered` 标志；首次加载后切换到洞察视图不会重新读取 stats。数据更新后需要刷新整页，不能在同一会话内自然刷新。

### P3：最新期自动滚底可能在筛选切换时打断阅读

`web/js/main.js:96` 每次筛选渲染后都调用 `scrollToBottom()`。这满足“最新期定位”，但用户选择历史年份或对比模式时也会被强制滚到底部，可能干扰查看早期数据。

## 待浏览器验证清单

恢复执行环境后，至少完成以下检查并把截图/日志作为证据：

1. 五种视口：`1440x1000`、`1280x900`、`768x1024`、`390x844`、`375x812`。
2. 每个视口在 Light / Dark 下检查首屏、表格、筛选器、抽屉和洞察页；记录 `document.documentElement.scrollWidth <= innerWidth`。
3. 检查首屏最新期号、日期、六个红球和一个蓝球是否与 `web/data/latest.json` 一致。
4. 检查表格列数：期号 1 + 红球 33 + 蓝球 16 + 辅助 8 = 58。
5. 横向滚动后确认期号列固定、表头吸顶、蓝球 SVG 连线与中奖格中心对齐。
6. 验证 Recent 30/50/100/150/300/全部、自定义 N、年份筛选、Compare 默认模式及重置。
7. 点击红球/蓝球打开抽屉，核对全局频次、近 50/100、当前遗漏、最大遗漏、最近 5 次；验证 Escape、遮罩关闭和焦点返回。
8. 验证 Auto / Light / Dark 切换、刷新持久化、系统主题变化；检查首屏无闪白。
9. 拦截 `latest.json` / `stats.json` 请求，验证失败提示、缓存回退和“使用本地缓存”状态。
10. 检查右上角 GitHub 按钮在新标签页打开 `https://github.com/zhouminghan/ssq-hub`，并检查 `rel="noopener noreferrer"`。

## 最终判定

**源码层：基本通过，不可作为产品验收通过。**

新版 `web/` 已覆盖绝大多数目标能力，代码结构也从单文件脚本演进为按职责拆分的模块。当前最需要返工的是 Compare 交互、表体键盘可访问性、分享图缺失和移动端数据透明度。

**浏览器层（历史快照）：未通过。****部署层（历史快照）：BLOCKED。**

在真实浏览器截图、交互日志和线上部署证据补齐前，`Gate 3`、`Gate 7` 以及 #34 均不能标记为 PASS，整体交付仍处于 REVIEW_REQUIRED。

## 主控复验后的更新（2026-11-14）

主控交付 Agent 已完成独立浏览器复验，并修复了本报告中的若干源码缺陷：

- 同期对比新增期号选择器，可选择 001–最大历史同期序号，不再只有自动默认值。
- `web/assets/img/og-cover.png` 已由真实新版页面生成。
- 表头 49 个号码均改为真实按钮，键盘用户可打开全部红/蓝球画像。
- 筛选 Tab 和主题菜单增加方向键、Home、End 导航。
- Compare、重置、数据来源/生成时间提示和移动端概览可读性已改进。
- 真实 Playwright 已覆盖 1440、1280、768、390、375 宽度，桌面/移动端，浅色/深色，Axe 颜色对比度，失败态、缓存回退和全历史性能。

因此本文件上方的“0 项真实浏览器验收”是子 Agent 当次会话的状态，不是最终
交付状态。最终结果以 `docs/reports/FINAL_ACCEPTANCE.md` 和 Playwright 实际输出为准。
