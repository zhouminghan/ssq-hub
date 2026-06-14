# AGENT.md — ssq-hub AI 协作指南

> 只放「AI 改代码时必须知道、但看代码看不出来的事」。其余信息自行读取项目。

---

## Project Snapshot

纯前端双色球走势图。零构建零依赖，原生 ES Modules + 模块化 CSS，GitHub Pages 静态托管。
数据由 GitHub Actions 定时抓取入库。仅用于走势研究与编程学习。

前端入口: `web/index.html` · 数据脚本: `scripts/` · Actions: `.github/workflows/`

---

## Non-negotiables（红线）

| 允许 | 禁止 |
|---|---|
| 原生 ES Modules | webpack/vite/rollup 等任何打包工具 |
| 模块化 CSS（每组件一文件） | CSS-in-JS / Tailwind / SCSS / PostCSS |
| 原生 DOM + SVG | Vue / React / 任何框架 |
| Python 标准库 + `requests` | Node 后端 / 数据库 |

- **绝不引入构建工具**、不做"AI 智能选号/推荐"、不加 cookie/localStorage 身份逻辑
- **绝不修改历史记录**：`web/data/history/*.json` 只能 append 新期
- **绝不做干扰性动画**：数据密集型扫描工具，动画打断扫读流
- **主题只允许 auto/light/dark 三态**，不引入自定义颜色/字体等花哨功能

---

## 隐性知识（代码里看不到的理由）

### 号码画像抽屉（number-profile.js）
- **不加「推荐」「下期可能出」类措辞**，底部固定声明"历史数据，不预测未来"

### 数据脚本
- `calc_all.py` 每次**全量重算**（刻意不做增量），~36ms
- `_write_if_changed()` 不变式：读旧 → 字符串比较 → 不等才写。破坏会让 mtime 失真

### GitHub Actions
- cron 用 UTC，注释写明北京时间换算
- 幂等跳过：`latest.json` 已是今日则整流程跳过；`mode=full` 与手动触发不跳过

### 默认值
近N期默认 **50**，主题默认 **auto**。改一处须同步所有 fallback 路径（grep `loadRecent` 和 `aria-checked`）。

---

## 同步约束（改 A 必须改 B）

| 改动点 | 必须同步的位置 |
|---|---|
| 走势表增删列 | `trend-table.js` 空 colspan(58) / `responsive.css` / `index.html` |
| `stats.json` 结构变动 | `calc_all.py::calc_stats` 输出 / `verify_data.py::verify_stats_latest` 校验 / 前端消费方 |
| `web/js/` 或 `web/css/` 文件增删 | `verify_data.py::required_files` 清单（路径加 `web/` 前缀） |

---

## Git 安全

**未经用户明确说「提交/commit/push」，绝不执行 git commit 或 git push。**

```
改完 → 列改动 → 等「提交」→ git add + commit → 等「推送」→ push
```

---

## 验证

```bash
python3 scripts/verify_data.py       # 数据自检（必须全过）
cd web && python3 -m http.server 5173 # 本地预览
```

> 不要手动跑 `fetch_latest.py`（避免本地修改 web/data/）。
