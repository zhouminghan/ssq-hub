# CLAUDE.md — ssq-hub AI 协作指南

> 用户视角说明见 `README.md`。本文件只放"AI 改代码时必须知道的事"。

---

## 🎯 项目定位

纯前端双色球走势图，零构建、零依赖、GitHub Pages 静态托管。
数据由 GitHub Actions 定时抓取并 commit 入库。

仅用于走势研究与编程学习，**不做"预测推荐"**。

---

## 🏛 红线

| ✅ 允许 | ❌ 禁止 |
|---|---|
| 原生 ES Modules | 任何打包工具（webpack/vite/rollup） |
| 模块化 CSS（每组件一文件） | CSS-in-JS / Tailwind / SCSS |
| 原生 DOM + SVG | Vue / React / 任何前端框架 |
| Python 标准库 + `requests` | Node 后端 / 数据库 |

**绝不**：引入构建工具 · 把 CSS 揉进一个大文件 · 做"AI 智能选号/高分推荐" · 加 cookie/localStorage 身份逻辑 · 修改 `web/data/history/*.json` 的历史记录（只能 append 新期）。

---

## 📂 模块速查

```
ssq-hub/
├── README.md / CLAUDE.md / requirements.txt / .gitignore
├── docs/                       # 延伸阅读，不发布到 Pages
├── scripts/                    # Python 数据脚本，不发布到 Pages
│   ├── fetch_latest.py         # 多源容错抓取（cwl → 500 → idcd）
│   ├── calc_all.py             # 重算 stats/latest
│   ├── verify_data.py          # 数据 + 文件结构自检
│   └── update_readme.py        # no-op，保留入口
├── web/                        # 📦 GitHub Pages 发布根（deploy-pages.yml: path: ./web）
│   ├── index.html / .nojekyll
│   ├── css/    （reset/theme/layout/filter-bar/trend-table/trend-overlay/picker/number-profile/responsive）
│   ├── js/
│   │   ├── main.js             # 入口
│   │   ├── store.js            # 极简 pub/sub
│   │   ├── data-loader.js      # 数据加载 + jsDelivr CDN fallback
│   │   ├── filter-bar.js       # 三模式筛选（最近 N / 年份 / 同期对比）
│   │   ├── trend-table.js      # 走势表 + recent-5 标记 + tbody 点击代理
│   │   ├── trend-overlay.js    # SVG 蓝球连号轨迹
│   │   ├── picker.js           # 模拟选号 + 6 种策略机选
│   │   ├── number-profile.js   # 号码画像抽屉
│   │   └── utils/{dom,format,lottery}.js
│   └── data/
│       ├── history/{year}.json     # 按年存储
│       ├── history_index.json      # total / range / years[]
│       ├── latest.json
│       └── stats.json              # 频次 + 遗漏 + 每号画像 + 模式分布
└── .github/workflows/
    ├── update-data.yml         # 开奖日 22:00 + 23:00 重试 + 月初强制重算
    └── deploy-pages.yml        # push 到 main 自动部署（仅 web/ 上传）
```

**本地预览**：`cd web && python3 -m http.server 5173`

---

## 🔑 关键模块约定

> 这些是「看代码看不出来」的业务规则。

### `utils/format.js::structure(red[6])`

```js
{
  sum, span,                                   // 和值、跨度
  odd, even, small, big, prime, composite,
  zone: '1:2:3', z1, z2, z3,                   // 三区分布（保留，UI 已不展示）
  bigSmallShape, oddEvenShape, primeShape,     // 升序后的形态串，如 "小小小大大大"
}
```
红球 1-33 的质数集：`[2,3,5,7,11,13,17,19,23,29,31]`。

### `picker.js` 选号

- 表内 `tr.picker-row` 点球 → 累积到 `state.reds/blues`
- 草稿归类：≤6红+≤1蓝=单式；≥7红 或 ≥2蓝=复式
- 单式上限 5 注，超出替换最旧一注
- **数组按"老→新"push；渲染时倒序**（新加入的显示在 `#1`，老的下沉到 `#5`）。`data-idx` 索引映射不受影响
- **6 种机选策略**（`utils/lottery.js::STRATEGIES`）：`uniform` / `cold` / `hot` / `bigmiss` / `zonebalanced` / `oddevenbalanced`
  - 默认 uniform 不依赖 stats；切其他时按需 `loadStats()`，失败回退 uniform
  - 仅是「加权随机抽样策略」，**文案/tooltip/title 必须保持中性**——不构成投注建议
  - `zonebalanced` / `oddevenbalanced` 在 `pickRedByStrategy` 直接控制结构
  - 其他策略走 `buildWeightMaps`，权重最小值恒为 1（防黑洞）

### 号码画像抽屉（`number-profile.js`）

- 入口：`trend-table.js` 的 `tbody.onclick` 事件代理（仅 tbody）
- 数据：`stats.json::red_per_number[NN]` / `blue_per_number[NN]`
- 视图：右侧 360px 抽屉，移动端全屏；ESC / 点遮罩 / × 关闭
- **绝不加「推荐」「下期可能出」类措辞**，底部固定声明"历史数据，不预测未来"
- 频次条形图用「相对期望」可视化（红期望=total×6/33；蓝期望=total/16），50% 刻度线即理论期望

### 走势表列顺序（共 58 列）

```
期号 | 红1..33 | 蓝1..16 | 和值 | 跨度 | 大小形态 | 大小比 | 奇偶形态 | 奇偶比 | 质合形态 | 质合比
```

加列/删列必须四处同步：① `picker.js::picker-aux-fill` colspan（当前 8）  ② `trend-table.js` 空状态行 `colspan: 58`  ③ `responsive.css` 列宽  ④ `index.html` colspan（如有）

### 形态列配色（`td.col-aux.col-shape`）

红球升序后逐字符 `<span class="s-xxx">`，等宽字体。配色（CSS 变量来自 `theme.css`）：
- `.s-small` / `.s-even` / `.s-composite` → `var(--blue-deep)`
- `.s-big` / `.s-odd` / `.s-prime` → `var(--red-deep)`

新增形态列：在 `format.js::structure()` 输出 `xxxShape` 字符串，`trend-table.js` 用 `[...str].map(ch => h('span.s-xxx', null, ch))` 渲染。

### `stats.json` 字段约定

```
{
  "updated": "YYYY-MM-DD",       // verify ≤7 天=正常 / ≤30 天=警告 / >30 天=错误
  "latest_issue": "YYYYNNN",
  "total": int,
  "red_freq_global"/"red_freq_50"/"blue_freq_global"/"blue_freq_50",
  "red_missing"/"blue_missing",
  "red_per_number":  { "01": { freq_global, freq_50, freq_100, current_miss, max_miss, max_miss_issue, recent_5_issues }, ... 33 项 },
  "blue_per_number": { ... 16 项 },
  "consecutive":     { window: 100, with_consec_count, ratio },
  "same_tail":       { window: 100, with_same_tail_count, ratio },
  "ac_distribution": { "5": n, ... },
  "structure_recent_50": { zone1, zone2, zone3, odd, even, small, big, total_balls }
}
```
动结构必须三处同步：① `calc_all.py::calc_stats` 输出  ② `verify_data.py::verify_stats_latest` 校验  ③ 前端消费方（`number-profile.js` / `lottery.js`）

### 数据更新设计

| 脚本 | 策略 |
|---|---|
| `fetch_latest.py` | 按期号 merge + byte 级写入比对，未变化的年份跳过；mtime 真实 |
| `calc_all.py` | **每次全量重算**（刻意不增量）。3457 期跑完 ~36ms，stats 是全局聚合，做增量收益为零 |

`_write_if_changed(path, payload_str)` 的不变式必须保留：读旧 → 字符串 == 比较 → 不等才写。破坏它会让 mtime 失真。

---

## 🚦 工作流

### 改前端

`cd web && python3 -m http.server 5173` → 浏览器自查 → 列出改动文件 → 等用户说"提交"。

### 改数据脚本

```bash
python3 scripts/calc_all.py
python3 scripts/verify_data.py     # 必须 100% 通过
```
**不要**手动跑 `fetch_latest.py`（避免本地修改 `web/data/`）。

### 改 GitHub Actions

- cron 用 UTC，注释写明北京时间换算
- `update-data.yml` 节奏：开奖日（周二/四/日）22:00 首抓 + 23:00 重试 + 月初强制重算
- **幂等跳过**：`web/data/latest.json::latest_draw.date == 今日（北京时间）` 则整流程跳过；`mode=full` 与手动触发不跳过
- 抓不到新期时 `git diff --cached --quiet` 静默跳过 commit

---

## 🔍 数据自检

```bash
python3 scripts/verify_data.py
```
期望：`🎉 自检全部通过`。校验 5 项：history_index 一致性 / history 红蓝球范围与期号唯一 / stats+latest 一致性 / README 期数一致 / **30 个必要文件齐全**（增删文件必须同步 `verify_data.py::required_files`，路径以 `web/` 开头）。

---

## ⚠️ Git 安全（最高优先级）

**未经用户明确说"提交/commit/push"，绝不执行 `git commit` 或 `git push`。**

流程：改完 → 列改动 → 等"提交" → `git add` + `git commit` → 等"推送" → `git push`。

---

## 🐛 避坑指南

1. **picker.js 列对齐**：走势表 58 列；新增辅助列时改 `picker-aux-fill` 的 colspan，否则右侧背景缺一块。
2. **dock 高度同步**：`picker-dock` 通过 ResizeObserver 同步到 `--picker-dock-h`。`.result-list` 必须固定 160px + 内部滚动，否则 dock 撑高遮挡 picker-row。
3. **CSS 选择器特异性**：`tfoot.picker-tfoot tr.picker-row td.picker-title-cell` 的 sticky-left 必须三层选择器，否则被 `.trend-table tfoot td` 覆盖。
4. **ES Module 路径必须带 `.js` 后缀**：浏览器原生 ESM 不支持省略。
5. **required_files 清单**：任何 `web/js/` 或 `web/css/` 文件增删要同步 `verify_data.py`（路径加 `web/` 前缀），否则自检假绿/假红。当前 30 个必要文件。
6. **下期期号推算**：`utils/format.js::nextIssue(latest, idx)` 依赖 `history_index.years[].count` 判定年末末期。改 `history_index.json` 结构会让跨年那两期显示错误。跨年缺位时临时显示同年 `seq+1`，下次抓取自纠——别去"修"。
7. **tbody.onclick 直接覆盖**：`trend-table.js` 用 `tbody.onclick = ...`（不是 `addEventListener`），是有意——每次 `renderTrend` 重建 tbody 事件随节点 GC。要在 tbody 加更多 click 监听必须改 `addEventListener` 或在同一个 onclick 里分发，否则后加的覆盖前者。
