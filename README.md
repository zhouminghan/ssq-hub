# 🎱 ssq-hub · 双色球走势图

🌐 **在线访问**：[https://zhouminghan.github.io/ssq-hub/](https://zhouminghan.github.io/ssq-hub/)
🛠 **GitHub 仓库**：[github.com/zhouminghan/ssq-hub](https://github.com/zhouminghan/ssq-hub)

[![Pages](https://img.shields.io/badge/GitHub_Pages-自动部署-blue)](https://zhouminghan.github.io/ssq-hub/)
[![Data](https://img.shields.io/badge/dynamic/json?label=%E6%95%B0%E6%8D%AE%E9%87%8F&query=%24.total&url=https%3A%2F%2Fzhouminghan.github.io%2Fssq-hub%2Fdata%2Flatest.json&suffix=%E6%9C%9F&color=red)](https://zhouminghan.github.io/ssq-hub/data/latest.json)
[![Latest](https://img.shields.io/badge/dynamic/json?label=%E6%9C%80%E6%96%B0%E6%9C%9F&query=%24.latest_draw.issue&url=https%3A%2F%2Fzhouminghan.github.io%2Fssq-hub%2Fdata%2Flatest.json&color=orange)](https://zhouminghan.github.io/ssq-hub/data/latest.json)
[![Stack](https://img.shields.io/badge/Stack-纯原生JS-green)](#-技术栈)
[![Update](https://img.shields.io/badge/数据更新-周二/四/日_22:30-purple)](#-数据自动更新)
[![License](https://img.shields.io/badge/License-MIT-orange)](#-license)

> 纯前端双色球走势图 Web 应用，零成本部署到 GitHub Pages，开奖数据通过 GitHub Actions 定时抓取并自动 commit 入库。
>
> **本应用仅用于走势研究与数据可视化学习，与任何真实购彩行为无关。**

> 上方两个红/橙色 badge 由 shields.io 实时拉取 `data/latest.json` 渲染，README 本身不需要每期更新。

---

## ✨ 核心功能

- 📊 **走势图主表**：左 sticky 期号列 / 中红 33 + 蓝 16 球矩阵 / 右辅助列（**和值 · 奇偶 · 大小 · 区间 · 质合**）
- 🎨 **遗漏值与连号轨迹**：每个号码格显示遗漏值，蓝球用 SVG 连号轨迹叠加
- 🔍 **三模式筛选**：近 N 期 / 指定年份 / 同期对比（如 2023055 vs 2024055 vs 2025055）
- 🎟 **支付宝风格模拟选号**：表内 sticky 选号行 + 底部 dock
  - 自动归类草稿：≤6 红 + ≤1 蓝 = 单式草稿；≥7 红 或 ≥2 蓝 = 复式草稿
  - 草稿合法时草稿条上有红色「+ 加注」按钮
  - 单式上限 5 注（满后再加自动淘汰最旧的一注）
  - 新加入的注永远在 `#1`，老的下沉
- 🤖 **数据自动更新**：GitHub Actions 定时（周二/四/日 22:30 北京时间）抓取最新开奖
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
├── index.html              # 单页入口
├── css/                    # 模块化样式
│   ├── reset.css
│   ├── theme.css           # 设计 tokens
│   ├── layout.css
│   ├── filter-bar.css
│   ├── trend-table.css
│   ├── trend-overlay.css
│   ├── picker.css
│   └── responsive.css
├── js/                     # ES Modules
│   ├── main.js             # 入口
│   ├── store.js            # pub/sub 状态
│   ├── data-loader.js      # 数据加载层
│   ├── filter-bar.js       # 筛选栏
│   ├── trend-table.js      # 走势表
│   ├── trend-overlay.js    # SVG 连号轨迹
│   ├── picker.js           # 选号器
│   └── utils/
│       ├── dom.js
│       ├── format.js
│       └── lottery.js
├── data/                   # 静态数据（自动更新）
│   ├── history/            # 按年存储 2003.json ... 2026.json
│   ├── history_index.json  # 年份索引
│   ├── latest.json         # 最新一期（badge 数据来源）
│   └── stats.json          # 频次/遗漏/结构
├── scripts/                # Python 数据脚本
│   ├── fetch_latest.py     # 多源容错抓取
│   ├── calc_all.py         # 重算 stats/latest
│   ├── verify_data.py      # 数据自检
│   └── update_readme.py    # README 检查（已不再写入，保留为兼容）
├── .github/workflows/
│   ├── update-data.yml     # 定时抓取
│   └── deploy-pages.yml    # 部署 Pages
└── requirements.txt
```

## 🚀 部署

### 在线访问（GitHub Pages）

仓库设置启用 GitHub Pages：
- Source: GitHub Actions（推荐，由 `deploy-pages.yml` 自动发布）
- 或：Deploy from a branch → main / `(root)`

任何 push 到 `main` 都会自动部署。

### 本地预览

任意静态服务器即可，例如：

```bash
# Python 3
python3 -m http.server 8080

# Node.js（如已安装）
npx serve .
```

然后访问 `http://localhost:8080`。

## 🤖 数据自动更新

双色球开奖时间：**周二 / 四 / 日 21:15 北京时间**。

`update-data.yml` 多次重试以保证开奖数据能稳定入库：

| 时间（北京时间） | 用途 |
|---|---|
| 开奖日 22:30 | 首次抓取（开奖后约 1 小时，数据源已就绪） |
| 开奖日 23:30 | 重试 1（首次没抓到时兜底，例如官方源延迟） |
| 次日 08:00 | 重试 2（极端情况，仍未抓到时最后一次兜底） |
| 每月 1 日 02:00 | 强制重算 stats / latest（即便无新数据） |
| 手动触发 | GitHub 网页 → Actions → Run workflow（可选 incremental / full 模式） |

> 多次重试都是幂等的：抓到新期 → commit；没抓到 → 静默跳过，不污染仓库历史。
>
> README 本身不会因数据更新而频繁变动 —— 期数和最新期号显示交给 shields.io 实时 badge。

抓取数据源（按优先级 fallback）：

1. **福彩官方 API**（cwl.gov.cn）— 国内首选，需先取 cookie
2. **idcd.com** — 海外可用（GitHub Actions runner 在海外）
3. **mxnzp.com** — 兜底（仅返回最新一期）

任意一个成功即可，全部失败时跳过本次（不阻塞仓库）。

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
- 备用：idcd.com / mxnzp.com 第三方公开 API

## ⚠️ 免责声明

- 本项目仅作为前端数据可视化与编程学习用途
- 历史开奖数据**不能预测未来**；任何"高分推荐 / 玄学选号"皆为娱乐
- 请理性对待彩票，量力而行，未成年人请勿购彩

## 📜 License

MIT
