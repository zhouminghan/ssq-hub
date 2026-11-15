# SSQ Hub · 双色球历史数据分析与可视化

SSQ Hub 是一个面向双色球历史开奖记录的静态数据产品，提供 58 列走势矩阵、
号码画像、统计洞察、研究笔记和多端响应式体验。生产环境不依赖应用服务器、
数据库或前端框架运行时。

> 历史数据只用于查询、统计和可视化，不能预测未来开奖结果。

[![数据更新](https://github.com/zhouminghan/ssq-hub/actions/workflows/update-data.yml/badge.svg?branch=main&style=flat-square)](https://github.com/zhouminghan/ssq-hub/actions/workflows/update-data.yml)
[![Pages 部署](https://github.com/zhouminghan/ssq-hub/actions/workflows/deploy-pages.yml/badge.svg?branch=main&style=flat-square)](https://github.com/zhouminghan/ssq-hub/actions/workflows/deploy-pages.yml)
[![最新期号](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fzhouminghan.github.io%2Fssq-hub%2Fdata%2Flatest.json&query=%24.latest_draw.issue&label=%E6%9C%80%E6%96%B0%E6%9C%9F%E5%8F%B7&color=dc2626&style=flat-square)](https://zhouminghan.github.io/ssq-hub/data/latest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-d97706?style=flat-square)](LICENSE)

## 功能

- 覆盖 2003 年至今的完整历史开奖记录，支持自动数据抓取、交叉核验和质量门禁。
- 58 列走势矩阵：期号、33 个红球、16 个蓝球和 8 个结构指标。
- 红蓝球遗漏、蓝球 SVG 走势线、近 5 期高亮、最新一期定位和跨年同期对比。
- 号码画像：全局及近期频次、当前遗漏、最大遗漏和最近 5 次出现。
- 数据洞察：分区、奇偶、大小、AC 值、连号、同尾和近期高频号码。
- 研究笔记：站内 Markdown、KaTeX 数学公式、概率图表和期望拆解。
- `auto`、浅色、深色三态主题，响应式表格、冻结期号列和吸顶表头。
- 数据新鲜度、来源核验、CDN 回退和浏览器缓存回退状态。

## 架构

```mermaid
flowchart LR
    A[500.com / 福彩官方] --> B[抓取与交叉核验]
    B --> C[Schema 与语义校验]
    C --> D[受保护的年度 JSON]
    D --> E[确定性统计]
    E --> F[质量门禁]
    F --> G[GitHub Actions]
    F --> H[静态 Web]
    G --> I[GitHub Pages]
    H --> I
```

运行层使用原生 HTML、ES Modules、DOM/SVG 和 CSS；公式由本地 KaTeX MathML
渲染。系统分层、数据契约和技术选择见 [架构文档](docs/ARCHITECTURE.md)。

## 数据更新

定时任务在开奖日自动更新数据，并在春节等已配置的休市窗口跳过网络请求。空结果、
过期结果或双源冲突会重试，超过上限后明确失败。历史修正只能经过受控的数据管道。

## 仓库范围

远端只跟踪静态站点、数据管道、数据契约、架构说明，以及数据更新和 Pages 发布
两个工作流。Playwright、ESLint、单元测试、开发服务器和测试报告只保留在本机，
并由 Git 忽略，不进入远程仓库，也不消耗 Actions 资源。

## 目录

```text
ssq-hub/
├── .github/workflows/   数据更新与 Pages 部署
├── docs/                架构设计
├── schemas/             JSON Schema 2020-12 数据契约
├── scripts/             抓取、统计、清单和验证脚本
└── web/
    ├── assets/          图标、Logo 与本地 KaTeX
    ├── config/          停开奖窗口
    ├── content/notes/   站内 Markdown 研究笔记
    ├── css/             主题与组件样式
    ├── data/            年度历史记录和生成数据
    └── js/              浏览器 ES Modules
```

研究内容位于 `web/content/notes/`。公式使用 `$$ ... $$`，图表使用
`:::chart` 指令。

## 部署

项目没有生产构建步骤，GitHub Pages 直接发布 `web/`。工作流按实际文件差异决定
是否部署，并在发布前执行数据检查。

## 兼容与限制

- 浏览器自动化只在本地开发环境运行，远端 Actions 不执行浏览器测试。
- 一次性渲染全部历史会创建大量 DOM 节点，默认 50 期视图不受影响。
- 下一期日期根据常规开奖规律和已配置休市窗口估算，不覆盖所有临时调整。
- 历史频次只描述过去，不构成预测、推荐或投注建议。

## 许可证

本项目采用 [MIT License](LICENSE)，版权所有 © 2026 zhouminghan。
