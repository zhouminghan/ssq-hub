# AGENT.md — ssq-hub

> 只放「AI 改代码时必须知道、但看代码看不出来的事」。
> 项目概述、技术栈、目录结构等 → 见 [README.md](./README.md)。

---

## Dev environment

```bash
pip install -r requirements.txt     # 仅 requests
python3 scripts/verify_data.py      # 数据自检（必须全过）
cd web && python3 -m http.server 5173  # 本地预览
```

- 不要手动跑 `fetch_latest.py`（避免本地修改 `web/data/`）。

---

## Constraints

### 技术红线

| 允许 | 禁止 |
|---|---|
| 原生 ES Modules | webpack/vite/rollup 等任何打包工具 |
| 模块化 CSS（每组件一文件） | CSS-in-JS / Tailwind / SCSS / PostCSS |
| 原生 DOM + SVG | Vue / React / 任何框架 |
| Python 标准库 + `requests` | Node 后端 / 数据库 |

### 行为红线

- **绝不引入构建工具**
- **绝不做"AI 智能选号/推荐"** — 号码画像底部固定声明"历史数据，不预测未来"
- **绝不修改历史记录**：`web/data/history/*.json` 只能 append 新期
- **绝不做干扰性动画**：数据密集型扫描工具，动画打断扫读流
- **主题只允许 auto/light/dark 三态**，不引入自定义颜色/字体等花哨功能

---

## Implicit knowledge

- `calc_all.py` 每次**全量重算**（刻意不做增量），~36ms
- `_write_if_changed()` 不变式：读旧 → 字符串比较 → 不等才写。破坏会让 mtime 失真
- 近N期默认 **50**，主题默认 **auto**。改一处须同步所有 fallback 路径（grep `loadRecent` 和 `aria-checked`）

---

## Sync constraints（改 A 必须改 B）

| 改动点 | 必须同步的位置 |
|---|---|
| 走势表增删列 | `trend-table.js` 空 colspan(58) / `responsive.css` / `index.html` |
| `stats.json` 结构变动 | `calc_all.py::calc_stats` 输出 / `verify_data.py::verify_stats_latest` 校验 / 前端消费方 |
| `web/js/` 或 `web/css/` 文件增删 | `verify_data.py::required_files` 清单（路径加 `web/` 前缀） |

---
