# CLAUDE.md — ssq-hub 项目工作指南

> 给 AI 编程助手（Claude Code / CodeBuddy 等）看的项目说明。
> 用户视角的功能介绍请看 `README.md`。

---

## 🎯 项目定位

**纯前端双色球走势图**，零构建、零依赖、GitHub Pages 静态托管。
数据通过 GitHub Actions 定时抓取并自动 commit 入库。

仅用于走势研究与编程学习，**不涉及真实购彩，也不做"预测推荐"**。

---

## 🏛 架构核心约束

### 技术栈红线

| ✅ 允许 | ❌ 禁止 |
|--------|--------|
| 原生 ES Modules（`<script type="module">`） | 任何 npm/构建工具（webpack/vite/rollup） |
| 模块化 CSS（每组件一文件） | CSS-in-JS / TailwindCSS / SCSS |
| 原生 DOM + SVG | Vue / React / 任何前端框架 |
| Python 标准库 + `requests` | Node 后端 / 数据库 |

**原因**：GitHub Pages 推送即生效，零构建延迟；走势图本质是「期数 × 号码」二维表格，原生足够。

### 不要做的事

- ❌ 不要引入打包工具，哪怕"为了开发体验"
- ❌ 不要把 CSS 揉进一个大文件，组件化是有意为之
- ❌ 不要做"AI 智能选号 / 高分推荐"——这是彩票，没有真实预测价值
- ❌ 不要在前端加 cookie / localStorage 的用户身份逻辑——纯静态站
- ❌ 不要修改 `data/history/*.json` 的任何历史记录（必要时由抓取脚本覆盖）

---

## 📂 模块速查表

```
ssq-hub/
├── index.html              # 单页入口，<link>/<script> 必须显式声明
├── README.md               # 用户视角说明（含 Pages 自动部署的数据 badge）
├── CLAUDE.md               # 本文件，AI 协作指南
├── requirements.txt        # Python 依赖（仅 requests）
├── .nojekyll               # GitHub Pages 必需（避免 Jekyll 处理）
├── .gitignore
├── css/
│   ├── reset.css           # 通用 reset
│   ├── theme.css           # 设计 tokens（CSS 变量）
│   ├── layout.css          # 全局布局
│   ├── filter-bar.css      # 顶部筛选栏
│   ├── trend-table.css     # 走势主表
│   ├── trend-overlay.css   # SVG 蓝球连线层
│   ├── picker.css          # 模拟选号 dock + 表内 picker 行
│   └── responsive.css      # 媒体查询
├── js/
│   ├── main.js             # 装配各模块（入口）
│   ├── store.js            # 极简 pub/sub 状态（~20 行）
│   ├── data-loader.js      # 数据加载（按需 lazy load 年份）
│   ├── filter-bar.js       # 三模式筛选（最近 N / 年份 / 同期对比）
│   ├── trend-table.js      # 走势表渲染（thead + tbody + 辅助列）
│   ├── trend-overlay.js    # SVG 蓝球连号轨迹
│   ├── picker.js           # 模拟选号（单式 + 复式 + 草稿条）
│   └── utils/
│       ├── dom.js              # h() 创建元素 / qs / clear
│       ├── format.js           # pad2 / structure() / debounce / rafThrottle
│       └── lottery.js          # randomPickMany / 常量 RED_MAX 等
├── data/
│   ├── history/{year}.json     # 按年存储，单文件约 130~155 期
│   ├── history_index.json      # 年份索引（total / range / years[]）
│   ├── latest.json             # 最新一期
│   └── stats.json              # 频次 / 遗漏 / 近 50 期结构
├── scripts/
│   ├── fetch_latest.py     # 多源容错抓取（cwl → idcd → mxnzp）
│   ├── calc_all.py         # 重算 stats/latest（被 Action 调用）
│   ├── verify_data.py      # 数据完整性 + 项目结构自检
│   └── update_readme.py    # 更新 README 期数 badge
└── .github/workflows/
    ├── update-data.yml     # 开奖日 22:30 + 23:30 + 次日 08:00 三次重试 + 月初强制重算
    └── deploy-pages.yml    # push 到 main 自动部署
```

### 关键模块约定

**`utils/format.js`** —— `structure(red[6])` 返回：
```js
{ sum, odd, even, small, big, prime, composite, zone: '1:2:3', z1, z2, z3 }
```
红球范围 1-33 的质数集：`[2,3,5,7,11,13,17,19,23,29,31]`。

**`picker.js` 状态机**：
- 用户在表格 `tr.picker-row` 里点红/蓝球 → 累积到 `state.reds/blues` Set
- 草稿自动归类：≤6红+≤1蓝 = 单式草稿；≥7红 或 ≥2蓝 = 复式草稿
- 草稿合法时草稿条上有红色 `+ 加注` 按钮（事件委托在 dock 容器上）
- 单式上限 5 注（达到 5 注后再加，会替换最旧的）

**模拟选号顺序约定（重要）**：
- `state.bets` 数组内部按"老→新"顺序 push（最新加入的在数组尾部）
- **渲染时倒序**：`[...arr].reverse()`，新加入的显示为 `#1`（顶部），老的下沉
- **草稿条永远在最顶部**（实条目之前）
- 单式满 5 注后再加：数组首部最旧的被淘汰（即视觉上的 `#5`，老的下沉到底部被挤掉）
- 数据结构和淘汰算法保持不变，"新的在顶"是纯渲染层处理 → 不影响 `data-idx` 索引映射

**`trend-table.js` 列顺序**（共 55 列）：
```
期号 | 红1..33 | 蓝1..16 | 和值 | 奇偶 | 大小 | 区间 | 质合
```
任何加列/删列必须同步：
1. `index.html` 中的 colspan（如有）
2. `picker.js` 中 `picker-aux-fill` 的 `colspan`（当前为 5）
3. `trend-table.js` 中空状态行的 `colspan: 55`
4. `responsive.css` 中相应列宽

---

## 🚦 工作流 SOP

### 修改前端代码

1. 改完后启动本地预览：`python3 -m http.server 5173`
2. 浏览器打开 `http://localhost:5173/` 自查
3. 视觉验证可用 Playwright（项目 `scripts/` 目录无验证脚本，但 `/opt/homebrew/lib/node_modules/@playwright/cli/` 有现成 chromium）
4. 完成后告知用户改动文件清单，**等待用户明确说"提交"才能 git commit**

### 修改数据脚本

1. 本地跑一遍：
   ```bash
   python3 scripts/calc_all.py
   python3 scripts/verify_data.py   # 必须 100% 通过
   ```
2. **不要**触发 `fetch_latest.py`，除非用户明确要求（避免在本地修改 `data/`）

### 涉及 GitHub Actions

- 工作流改动后，先用 `actionlint`（如本地有）或人工 review YAML
- 时区：cron 用的是 UTC，注释里写明北京时间换算
- `update-data.yml` 已有 `continue-on-error` 容错 + concurrency 互斥 + 多次重试（22:30 / 23:30 / 次日 08:00），不要随意收紧
- 每次重试都是幂等的：抓到新期才 commit，否则静默跳过 → 不会污染历史

### 增量更新设计约定

| 脚本 | 增量策略 | 说明 |
|---|---|---|
| `fetch_latest.py` | **按期号 merge + 按内容比对写入** | dict[issue]→draw merge，写入年份文件前先 byte 级比对，未变化的年份跳过；mtime 真实反映"哪一年改了" |
| `calc_all.py` | **每次全量重算**（刻意不做增量） | 3456 期跑完只要 ~36ms，stats 是全局聚合（频次/遗漏/结构）任何一期变更都可能影响多个值，做增量收益为零反而引入复杂度 |

**改 `save_by_year` 时**：写入函数 `_write_if_changed(path, payload_str)` 是关键，必须保持"读旧文件 → 字符串 == 比较 → 不等才写"这个不变式，否则会破坏 mtime 真实性。

---

## 🔍 数据自检清单

任何涉及数据/结构的改动后，必须跑：

```bash
python3 scripts/verify_data.py
```

期望输出：`🎉 自检全部通过，数据完整无误！`

校验内容：
1. `history_index.json` 字段完整 + total 与各年 count 之和一致
2. 所有 `history/*.json` 红球 6 个 / 范围 1-33 / 蓝球 1-16 / 期号唯一
3. `stats.json` + `latest.json` 字段完整且 total 与 index 一致
4. README 中的期数 badge / 正文期数与实际一致
5. **27 个必要文件**全部存在（任何文件增删都要同步更新 `verify_data.py` 的 `required_files` 清单）

---

## ⚠️ Git 安全（最高优先级）

**绝对不要**在用户明确说"提交 / commit / push"之前执行 `git commit` 或 `git push`。

正确流程：
1. 改完代码 → 列出修改文件 → 询问"需要我提交吗？"
2. 用户说"提交" → `git add` + `git commit`
3. 询问"需要推送到远端吗？"
4. 用户说"推送" → `git push`

---

## 🐛 已知坑 & 避坑指南

### 1. `picker.js` 的列对齐

走势表有 55 列。模拟选号行（`tr.picker-row`）必须严格对齐 thead 列宽。
新增辅助列时，记得改 `picker-aux-fill` 的 colspan，否则右侧背景会缺一块。

### 2. `dock` 高度同步

`picker-dock` 高度通过 ResizeObserver 同步到 CSS 变量 `--picker-dock-h`，
用于 `trend-scroll` 的 `padding-bottom`，避免 dock 遮挡 picker 行。
**`.result-list` 必须保持固定高度（160px）+ 内部滚动**，否则 dock 会被撑高遮挡 picker-row。

### 3. CSS 选择器特异性

`tfoot.picker-tfoot tr.picker-row td.picker-title-cell` 的 sticky-left 必须用三层选择器，
否则会被 `.trend-table tfoot td` 的更通用规则覆盖。

### 4. ES Module 路径必须带 `.js`

```js
// ✅ 正确
import { qs } from './utils/dom.js';

// ❌ 浏览器原生 ESM 不支持省略后缀
import { qs } from './utils/dom';
```

### 5. 修改 `verify_data.py` 的 required_files 清单

任何 `js/` 或 `css/` 下的文件增删，都要同步更新这个清单，否则 Action 自检会假绿/假红。

---

## 📞 用户偏好

- 中文交流，简体中文
- 直接、简洁，不要寒暄
- 修改前先讲方案让用户确认（除非是非常小的修复）
- 用 `ask_followup_question` 问关键决策点，不要一股脑全做完才问
- 涉及视觉的改动，主动用 Playwright 截图验证
- 提交前必须征得明确同意

---

最后更新：2026-05-28
