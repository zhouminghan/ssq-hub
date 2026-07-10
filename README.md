# <img src="./web/assets/img/logo.svg" width="28" height="28" alt="" style="vertical-align: -5px;"> ssq-hub · 双色球走势图

🌐 **在线访问**：[https://zhouminghan.github.io/ssq-hub/](https://zhouminghan.github.io/ssq-hub/)
🛠 **GitHub 仓库**：[github.com/zhouminghan/ssq-hub](https://github.com/zhouminghan/ssq-hub)

[![Update](https://github.com/zhouminghan/ssq-hub/actions/workflows/update-data.yml/badge.svg)](https://github.com/zhouminghan/ssq-hub/actions/workflows/update-data.yml)
[![Data](https://img.shields.io/badge/dynamic/json?label=%E6%95%B0%E6%8D%AE%E9%87%8F&query=%24.total&url=https%3A%2F%2Fzhouminghan.github.io%2Fssq-hub%2Fdata%2Flatest.json&suffix=%E6%9C%9F&color=red)](https://zhouminghan.github.io/ssq-hub/data/latest.json)
[![Latest](https://img.shields.io/badge/dynamic/json?label=%E6%9C%80%E6%96%B0%E6%9C%9F&query=%24.latest_draw.issue&url=https%3A%2F%2Fzhouminghan.github.io%2Fssq-hub%2Fdata%2Flatest.json&color=orange)](https://zhouminghan.github.io/ssq-hub/data/latest.json)
[![License](https://img.shields.io/badge/License-MIT-orange)](#-license)

> 纯前端双色球走势图，零成本 GitHub Pages 部署，开奖数据自动入库。

---

## 🏗️ 整体架构

```mermaid
graph LR
    A["📡 公开数据源<br/>500彩票网 · 福彩官方 · idcd.com"]
    B["🐍 Python 脚本<br/>fetch_latest → calc_all → verify_data"]
    C["📁 静态数据<br/>web/data/<br/>history/ · stats · latest · index"]
    D["🌐 前端<br/>Vanilla JS · 模块化 CSS<br/>首屏 0 外部请求"]

    A -->|抓取| B
    B -->|生成| C
    C -->|读取| D
```

---

## ✨ 核心功能

- **走势表**：红球 33 + 蓝球 16 矩阵，遗漏值标注，蓝球 SVG 连号轨迹；右 8 列辅助数据（和值/跨度/大小/奇偶/质合）
- **号码画像**：点击任意号码 → 抽屉滑出，频次/当前遗漏/最长遗漏/最近 5 次出现
- **三模式筛选**：近 N 期 / 指定年份 / 同期对比（跨年同号对比）
- **自动更新**：开奖日 Actions 轻量流水线 `fetch → calc → verify → commit`，校验通过后由独立 Pages workflow 发布
- **主题切换**：auto/light/dark 三态下拉，系统偏好跟随
- **纯原生**：零框架、零构建、零依赖，前端静态资源直推即可发布

---

## 📂 项目结构

```
ssq-hub/
├── web/                     # 前端静态资源
│   ├── index.html
│   ├── assets/img/          # 静态图标
│   ├── css/                 # 模块化样式（8 文件）
│   ├── js/                  # ES Modules（10 文件 + utils/）
│   └── data/                # 静态 JSON（按年存储 + stats + latest + index）
├── scripts/                 # Python 数据脚本
│   ├── _paths.py             # 共用路径常量
│   ├── _utils.py             # 共用工具（write_if_changed）
│   ├── fetch_latest.py      # 多源抓取（500彩票 / 福彩 / idcd）
│   ├── calc_all.py          # 全量重算 stats / latest
│   └── verify_data.py       # 数据自检
├── docs/                    # 概率统计 / 历史事件
└── .github/workflows/       # 定时抓取 + Pages 部署
```

---

## 🚀 部署

**GitHub Pages**，部署链路保持解耦：

- `update-data.yml`：定时/手动抓取 → 重算 → 自检 → 提交 `web/data/`
- `deploy-pages.yml`：
  - 监听 `update-data.yml` 成功完成后自动部署
  - 监听前端静态资源直推（`web/index.html`、`web/js/**`、`web/css/**` 等）
  - **不监听** `web/data/**`，避免数据更新时重复部署

### 本地预览

```bash
cd web && python3 -m http.server 5173
```

---

## 🧪 数据维护

```bash
pip install -r requirements.txt    # requests（JSON API + HTML 解析）

python3 scripts/fetch_latest.py    # 抓取最新开奖
python3 scripts/calc_all.py        # 重算 stats / latest
python3 scripts/verify_data.py     # 数据自检
```

数据源（多源 fallback）：[500 彩票网](https://datachart.500.com/ssq/)（GitHub Actions 首选） → [福彩官方](https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/) → [idcd.com](https://www.idcd.com/)。

---

## ⚠️ 免责声明

- 本项目仅用于前端数据可视化与编程学习
- 历史数据**不预测未来**；"高分推荐 / 玄学选号"为娱乐
- 理性购彩，未成年人请勿参与

延伸阅读：[双色球概率统计](./docs/双色球概率统计.md) · [双色球真相](./docs/双色球真相.md)

---

## 📜 License

MIT
