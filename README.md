<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg"/>
    <source media="(prefers-color-scheme: light)" srcset="assets/logo.svg"/>
    <img src="assets/logo.svg" alt="双色球数据中心" width="520"/>
  </picture>
</p>

<p align="center">
  <a href="https://zhouminghan.github.io/ssq-hub/"><img src="https://img.shields.io/badge/在线访问-GitHub_Pages-E8192C?style=for-the-badge&logo=googlechrome&logoColor=white" alt="在线访问"/></a>
  <a href="https://github.com/zhouminghan/ssq-hub"><img src="https://img.shields.io/badge/源码仓库-GitHub-181717?style=for-the-badge&logo=github" alt="GitHub"/></a>
  <a href="https://github.com/zhouminghan/ssq-hub/tree/mastser/data"><img src="https://img.shields.io/badge/数据量-3436期-2A5CAA?style=for-the-badge&logo=databricks&logoColor=white" alt="数据量"/></a>
  <a href="https://github.com/zhouminghan/ssq-hub/actions"><img src="https://img.shields.io/badge/自动更新-GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white" alt="自动更新"/></a>
</p>

> 一个可在 GitHub Pages 上一键部署、自动更新数据的双色球历史查询 + 智能选号 Web 应用。
>
> 数据覆盖 **2003-02-23 ~ 至今**（自动更新），当前共 **3436** 期完整开奖记录。

---

## ✨ 功能特性

|       功能模块       | 说明                                                                    |
| :------------------: | ----------------------------------------------------------------------- |
| 📊**历史查询** | 3436 期开奖数据，支持按期号 / 日期 / 号码搜索，年份筛选，分页浏览       |
| 🎯**智能选号** | 基于频率分析的多维度推荐引擎，4 项权重滑块自由调节，加权随机选号        |
| 🎲**随机选号** | 带约束条件的随机选号器（区间均衡 / 奇偶均衡），摇一摇动画               |
| 📈**统计分析** | 红球频率、蓝球频率、遗漏追踪、评分排名 4 种图表 + 结构特征可视化        |
| 🏆**最新开奖** | 显示最新一期开奖结果 + 3 套下期推荐方案（均衡型 / 热号追击 / 冷号回补） |
| 🔄**动态刷新** | 下期推荐支持「换一批」一键刷新，前端基于统计数据加权随机实时重算        |
| 🤖**自动更新** | GitHub Actions 定时抓取最新开奖数据，无需手动维护                       |

## 🖼️ 界面预览

前端采用 **Vue 3** + **Chart.js** 构建，纯静态页面，响应式设计，支持移动端。

- 🔴 红球渐变立体球样式
- 🔵 蓝球渐变立体球样式
- 📱 移动端自适应布局
- ✨ 刷新方案时带淡出→淡入过渡动画

## 🚀 快速开始

### 方式一：在线访问

👉 **[https://zhouminghan.github.io/ssq-hub/](https://zhouminghan.github.io/ssq-hub/)**

### 方式二：Fork 部署

1. 点击右上角 **[Fork](https://github.com/zhouminghan/ssq-hub/fork)** 本仓库
2. 进入你 Fork 的仓库 → **Settings** → **Pages** → Source 选择 `main` 分支
3. 等待约 1 分钟，访问 `https://<你的用户名>.github.io/ssq-hub/`

> 💡 Fork 后 GitHub Actions 会自动在每个开奖日（周二 / 四 / 日）22:30（北京时间）更新数据。

### 方式三：本地运行

```bash
# 克隆仓库
git clone https://github.com/zhouminghan/ssq-hub.git
cd ssq-hub

# 直接用任意 HTTP 服务器打开即可（纯静态页面）
python3 -m http.server 8080
# 或
npx serve .
```

浏览器打开 `http://localhost:8080` 即可。

## 🏗️ 项目结构

```
ssq-hub/
├── index.html                  # 主页面（Vue 3 SFC 模板）
├── css/
│   └── style.css               # 全局样式（CSS Variables + 响应式 + 动画）
├── js/
│   └── app.js                  # Vue 3 应用逻辑（Composition API）
├── data/
│   ├── history_index.json      # 年份索引（总期数、各年期数/范围）
│   ├── history/                # 按年存储的历史开奖数据
│   │   ├── 2003.json ~ 2026.json
│   ├── stats.json              # 统计分析数据（频率/评分/遗漏/结构）
│   └── latest.json             # 最新开奖 + 推荐号码
├── scripts/
│   ├── fetch_latest.py         # 福彩官网 API 增量抓取（按年存储 + 更新索引）
│   ├── calc_all.py             # 统计计算 → stats.json + latest.json
│   ├── update_readme.py        # 自动更新 README 期数与日期范围
│   └── verify_data.py          # 数据完整性自检（格式/一致性/结构）
├── .github/
│   └── workflows/
│       └── update-data.yml     # GitHub Actions 自动更新
└── README.md                   # 本文件
```

## 📊 评分算法

### 红球综合评分公式

```
综合评分 = 全局频率 × 0.15 + 近50期频率 × 0.30 + 近10期频率 × 0.30 + 冷号回补 × 0.25
```

其中 **冷号回补** 触发条件：全局频率 > 18% 且近 50 期频率 < 14%

### 热度等级

|   等级   | 条件                |
| :-------: | ------------------- |
|  🔥 极热  | 近 10 期频率 ≥ 40% |
|   🔥 热   | 近 10 期频率 ≥ 20% |
|    温    | 近 10 期频率 ≥ 10% |
|   偏冷   | 近 50 期频率 > 6%   |
| ❄️ 冷号 | 近 50 期频率 ≤ 6%  |

### 三套推荐方案

|     方案     | 策略                                    | 动态刷新行为                             |
| :-----------: | --------------------------------------- | ---------------------------------------- |
|   🎯 均衡型   | 综合评分前列，按一 / 二 / 三区各取 2 个 | 从评分 Top15 按区间加权随机，每区选 2 个 |
|  🔥 热号追击  | 近 10 期出现频率最高的红球              | 从近 10 期高频 Top10 中加权随机选 6 个   |
| ❄️ 冷号回补 | 全局热门但近期沉寂的冷号 + 热号         | 冷号池随机 4 个 + 热号补齐 2 个          |

> 💡 初始加载时方案来自 `latest.json`（静态），点击「🔄 换一批」后基于 `stats.json` 中的统计数据**前端加权随机实时重算**，每次点击结果不同，但偏好高评分号码。

### 加权随机算法

选号器（智能选号、下期推荐刷新）均采用 **加权随机** 而非简单取 Top-N：

1. 将候选球的评分归一化为概率权重
2. 按权重分布随机抽取，评分越高被选中概率越大
3. 已选中的球从候选池中移除，避免重复

## 🔧 数据管线

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│  福彩官网API │────▶│fetch_latest.py│────▶│ history/年份.json  │
└─────────────┘     └──────────────┘     │ history_index.json │
                                          └────────┬──────────┘
                                                   │
                                                   ▼
                    ┌──────────────┐     ┌──────────────┐
                    │  stats.json  │◀────│  calc_all.py │
                    │  latest.json │     └──────────────┘
                    └──────────────┘
                          ▲
                          │ 前端加权随机
                    ┌──────────────┐
                    │  🔄 换一批   │
                    │（app.js 实时） │
                    └──────────────┘
```

- **`fetch_latest.py`** — 调用福彩官网 API 增量抓取最近 30 期，按年存储到 `history/` + 更新 `history_index.json`
- **`calc_all.py`** — 合并 `history/*.json` 全量数据，计算全局/近 50 期/近 10 期频率、评分、遗漏、结构特征，生成推荐号码
- **`app.js` (前端)** — 先加载年份索引，按需加载对应年份数据；点击「换一批」基于 stats.json 前端加权随机实时重算

## 🤖 自动更新 (GitHub Actions)

项目配置了 [GitHub Actions 工作流](https://github.com/zhouminghan/ssq-hub/blob/mastser/.github/workflows/update-data.yml)，自动在每周 **二、四、日** 的 **22:30**（北京时间 / UTC 14:30）执行：

1. 抓取最新开奖数据 (`fetch_latest.py`)
2. 重新计算统计指标 (`calc_all.py`)
3. 自动提交并推送更新

也支持在 Actions 页面手动触发 (`workflow_dispatch`)。

## 🛠️ 技术栈

|    层    | 技术                                                 |
| :------: | ---------------------------------------------------- |
| 前端框架 | [Vue 3](https://vuejs.org/) (CDN, Composition API)      |
|  图表库  | [Chart.js 4](https://www.chartjs.org/)                  |
|   样式   | 原生 CSS (CSS Variables + Flexbox + Grid + 过渡动画) |
| 数据脚本 | Python 3.11                                          |
|  数据源  | 福彩官网 API（自动增量抓取）                         |
|  CI/CD  | GitHub Actions                                       |
|   部署   | GitHub Pages（纯静态）                               |

## ⚠️ 免责声明

> 🎰 彩票开奖为**完全随机事件**，以上统计分析仅供**娱乐参考**，不构成任何购买建议。请理性购彩！

## 📄 License

[MIT](https://opensource.org/licenses/MIT) © 2026

---

<p align="center">
  <a href="https://github.com/zhouminghan/ssq-hub">⭐ Star this repo</a> ·
  <a href="https://github.com/zhouminghan/ssq-hub/issues">🐛 Report Bug</a> ·
  <a href="https://github.com/zhouminghan/ssq-hub/fork">🍴 Fork</a>
</p>
