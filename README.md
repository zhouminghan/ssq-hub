# 🎱 ssq-hub · 双色球走势图

🌐 **在线访问**：[https://zhouminghan.github.io/ssq-hub/](https://zhouminghan.github.io/ssq-hub/)
🛠 **GitHub 仓库**：[github.com/zhouminghan/ssq-hub](https://github.com/zhouminghan/ssq-hub)

[![Pages](https://img.shields.io/badge/GitHub_Pages-自动部署-blue)](https://zhouminghan.github.io/ssq-hub/)
[![Data](https://img.shields.io/badge/dynamic/json?label=%E6%95%B0%E6%8D%AE%E9%87%8F&query=%24.total&url=https%3A%2F%2Fzhouminghan.github.io%2Fssq-hub%2Fdata%2Flatest.json&suffix=%E6%9C%9F&color=red)](https://zhouminghan.github.io/ssq-hub/data/latest.json)
[![Latest](https://img.shields.io/badge/dynamic/json?label=%E6%9C%80%E6%96%B0%E6%9C%9F&query=%24.latest_draw.issue&url=https%3A%2F%2Fzhouminghan.github.io%2Fssq-hub%2Fdata%2Flatest.json&color=orange)](https://zhouminghan.github.io/ssq-hub/data/latest.json)
[![Stack](https://img.shields.io/badge/Stack-纯原生JS-green)](#-技术栈)
[![License](https://img.shields.io/badge/License-MIT-orange)](#-license)

> 纯前端双色球走势图 Web 应用，零成本部署到 GitHub Pages，开奖数据通过 GitHub Actions 自动入库。
>
> **本应用仅用于走势研究与数据可视化学习，与任何真实购彩行为无关。**

---

## ✨ 核心功能

- 📊 **走势图主表**：左 sticky 期号列 / 中红 33 + 蓝 16 球矩阵 / 右 8 列辅助（**和值 · 跨度 · 大小形态 · 大小比 · 奇偶形态 · 奇偶比 · 质合形态 · 质合比**）
  - 形态列按红球升序逐位标注，6 字串如 `小小小大大大` / `奇偶奇奇偶奇` / `质合合质合合`
  - 字符双色编码：**小 / 偶 / 合 → 蓝**，**大 / 奇 / 质 → 红**，扫一眼即可感知形态分布
- 🎨 **遗漏值与连号轨迹**：每个号码格显示遗漏值，蓝球用 SVG 连号轨迹叠加
- 🔍 **三模式筛选**：近 N 期 / 指定年份 / 同期对比（如 2023055 vs 2024055 vs 2025055）
- 🎟 **支付宝风格模拟选号**：表内 sticky 选号行 + 底部 dock
  - 自动归类草稿：≤6 红 + ≤1 蓝 = 单式草稿；≥7 红 或 ≥2 蓝 = 复式草稿
  - 草稿合法时草稿条上有红色「+ 加注」按钮
  - 单式上限 5 注（满后再加自动淘汰最旧的一注）
  - 新加入的注永远在 `#1`，老的下沉
  - **6 种机选策略**：均匀随机 / 偏冷号 / 偏热号 / 大遗漏 / 三区均衡 / 奇偶均衡（仅加权随机，不构成投注建议）
- 🔎 **号码画像抽屉**：点走势表任意红/蓝号码 → 右抽屉滑出，展示频次（全局/近 100/近 50）、当前遗漏、历史最长遗漏（含发生期号）、最近 5 次出现期号；移动端全屏
- ✨ **最近 5 期命中高亮**：仅最末 5 行命中球加柔和金边脉冲，肉眼一秒定位本期号码
- 🧭 **右上角实时元信息**：`共 X 期 · 最新 YYYYNNN（日期）· 下期 YYYYNNN+1`，下期期号自动跨年进位（基于 `history_index.years[].count` 推算）
- 🤖 **数据自动更新**：开奖日 GitHub Actions 自动抓取并 commit
- 📱 **响应式设计**：移动端、平板、桌面全适配
- 🚫 **零构建零依赖**：纯原生 ESM + 模块化 CSS，push 即生效

## 🛠 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| HTML | 原生 HTML5 | 单页应用，无构建 |
| CSS | 模块化 CSS（每组件一文件） | 设计 tokens via CSS variables |
| JS | 原生 ES Modules | 零依赖、零构建 |
| 渲染 | HTML Table + SVG Overlay | 表格语义保留 + 49 条连号轨迹 |
| 数据 | JSON 静态文件 | 按年分文件 + 索引 |
| 自动化 | GitHub Actions | 定时抓取 + 自动 commit + Pages 部署 |

## 📂 项目结构

```
ssq-hub/
├── web/                     # 🌐 前端静态资源（GitHub Pages 发布根）
│   ├── index.html
│   ├── .nojekyll            # 避免 Jekyll 处理
│   ├── css/                 # 模块化样式
│   │   ├── reset.css
│   │   ├── theme.css        # 设计 tokens
│   │   ├── layout.css
│   │   ├── filter-bar.css
│   │   ├── trend-table.css
│   │   ├── trend-overlay.css
│   │   ├── picker.css
│   │   ├── number-profile.css  # 号码画像抽屉
│   │   └── responsive.css
│   ├── js/                  # ES Modules
│   │   ├── main.js          # 入口
│   │   ├── store.js         # pub/sub 状态
│   │   ├── data-loader.js   # 数据加载层（含 loadStats）
│   │   ├── filter-bar.js    # 筛选栏
│   │   ├── trend-table.js   # 走势表（号码点击 → 画像抽屉）
│   │   ├── trend-overlay.js # SVG 连号轨迹
│   │   ├── picker.js        # 选号器（含 6 种策略机选）
│   │   ├── number-profile.js   # 号码画像抽屉
│   │   └── utils/
│   │       ├── dom.js
│   │       ├── format.js
│   │       └── lottery.js   # 含 randomPickByStrategy + STRATEGIES
│   └── data/                # 静态数据（自动更新）
│       ├── history/         # 按年存储 2003.json ... 2026.json
│       ├── history_index.json
│       ├── latest.json      # badge 数据来源
│       └── stats.json       # 频次/遗漏/每号画像/连号/同尾/AC 值
├── scripts/                 # Python 数据脚本
│   ├── fetch_latest.py      # 多源容错抓取
│   ├── calc_all.py          # 重算 stats/latest（含每号画像 + 模式分布）
│   ├── verify_data.py       # 数据自检（含 stats 新鲜度检查）
│   └── update_readme.py     # README 检查（已不再写入，保留为兼容）
├── docs/                    # 延伸阅读（概率/历史事件）
├── .github/workflows/
│   ├── update-data.yml      # 定时抓取
│   └── deploy-pages.yml     # 部署 Pages（发布根 = web/）
└── requirements.txt
```
## 🚀 部署

### 在线访问（GitHub Pages）

仓库设置启用 GitHub Pages：
- Source: GitHub Actions（推荐，由 `deploy-pages.yml` 自动发布）
- 或：Deploy from a branch → main / `(root)`

任何 push 到 `main` 都会自动部署。

### 本地预览

```bash
cd web && python3 -m http.server 8080
# 或：npx serve ./web
```

访问 `http://localhost:8080`。

## 🤖 数据自动更新

开奖日（周二 / 四 / 日）由 GitHub Actions 自动抓取并 commit 入库；详细机制见 [`CLAUDE.md`](./CLAUDE.md)。

抓取数据源（按优先级 fallback）：

1. **福彩官方 API**（cwl.gov.cn）— 国内首选
2. **500 彩票网**（datachart.500.com）— 海外可用（GitHub Actions runner 在海外），HTML 表格解析无需 key
3. **idcd.com** — 兜底（第三方 JSON 公开接口）

## 🧪 本地数据维护

```bash
pip install -r requirements.txt    # 仅依赖 requests

# 抓取最新开奖
python3 scripts/fetch_latest.py

# 重算 stats / latest
python3 scripts/calc_all.py

# 数据自检（必须全过）
python3 scripts/verify_data.py
```

## 📊 数据来源

- 官方：[中国福利彩票发行管理中心 - 双色球](https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/)
- 备用：500 彩票网 datachart / idcd.com 第三方公开接口

## ⚠️ 免责声明

- 本项目仅作为前端数据可视化与编程学习用途
- 历史开奖数据**不能预测未来**；任何"高分推荐 / 玄学选号"皆为娱乐
- 请理性对待彩票，量力而行，未成年人请勿购彩

延伸阅读（本仓库 `docs/`）：

- [双色球概率统计](./docs/双色球概率统计.md) — 一等奖 1/1772 万、长期期望必亏的数学推导
- [双色球真相](./docs/双色球真相.md) — 历史事件 / 管理腐败 / 制度公信力梳理

## 📜 License

MIT
