# 设计规格：三态主题切换 + Header 布局重构

> 日期: 2026-06-14
> 状态: 待审核
> 决策记录: 方案 A（三态分段）+ 方案 A（紧凑信息栏）

---

## 1. 变更概述

两项 UI 改进：
1. **主题切换**：从 2 态 emoji 按钮升级为 3 态 SVG 分段控制器
2. **Header 布局**：从扁平三段平铺改为紧凑信息栏结构

---

## 2. 主题切换设计

### 2.1 三态模式

| 状态 | 含义 | localStorage 值 | 行为 |
|------|------|-----------------|------|
| 跟随系统 | auto | `null` 或不设 key | 读 `prefers-color-scheme`，监听系统变化 |
| 浅色 | light | `'light'` | 固定浅色，忽略系统变化 |
| 深色 | dark | `'dark'` | 固定深色，忽略系统变化 |

**默认行为修正**：首次访问时 `localStorage` 无 key → 跟随系统（当前代码逻辑正确，但需确保清除旧 key 后表现正确）。

### 2.2 控件形态

```
┌─────────┬─────────┬─────────┐
│   ☐    │   ☀    │   🌙   │  ← SVG 内联图标
│ 跟随系统 │  浅色  │  深色   │
└─────────┴─────────┴─────────┘
     ↑        ↑ 选中     ↑
   未激活   白底+阴影  未激活
```

- **容器**: `display:flex; background:#f0f0f0; border-radius:8px; padding:2px; gap:2px`
- **按钮**: `width:32px; height:28px; border-radius:6px`
- **激活态**: `background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.08)`
- **未激活**: `background:transparent; opacity:0.4~0.45`

### 2.3 图标规范

全部使用内联 SVG（无外部依赖），stroke 风格统一 `stroke-width="2"` `stroke-linecap="round"`：

| 状态 | SVG 图标 | 激活色 |
|------|----------|--------|
| 跟随系统 | 显示器/网格图标（4 格窗口） | `#555`（未激活）/ 主题色（激活）|
| 浅色 | 太阳（圆心+8 射线）| `#F59E0B` (amber) |
| 深色 | 月牙（弧形路径）| `#A0C4FF` (淡蓝) |

**暗色模式适配**：
- 容器背景: `#333`（替代 `#f0f0f0`）
- 激活态背景: `#444`（替代 `#fff`）
- 未激活 opacity: `0.35`
- 激活太阳色: 保持 `#F59E0B`
- 激活月牙色: 保持 `#A0C4FF`

### 2.4 JS 逻辑变更

```javascript
// 新增第三态 'auto'（跟随系统）
const THEMES = ['auto', 'light', 'dark'];

function getPreferredTheme() {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  // null / undefined / 'auto' → 跟随系统
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function getEffectiveTheme() {
  const stored = localStorage.getItem('theme');
  if (stored === 'light') return 'light';
  if (stored === 'dark') return 'dark';
  // auto → 读系统
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 切换循环：auto → light → dark → auto
btn.addEventListener('click', () => {
  const current = localStorage.getItem('theme'); // 可能是 null/auto/light/dark
  const next = current === 'light' ? 'dark' : current === 'dark' ? null : 'light';
  // null = 删除 key = 跟随系统
  if (next === null) localStorage.removeItem('theme');
  else localStorage.setItem('theme', next);
  applyTheme(getEffectiveTheme());
  syncThemeToggleUI(getEffectiveTheme(), next === null ? 'auto' : next);
});

// 系统变化监听（仅 auto 模式下生效）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) { // 无存储 = auto
    applyTheme(e.matches ? 'dark' : 'light');
    syncThemeToggleUI(e.matches ? 'dark' : 'light', 'auto');
  }
});
```

**防闪烁 script 更新**（`<head>` 内联）：

```html
<script>
(function(){
  var t=localStorage.getItem('theme');
  if(t==='light') document.documentElement.setAttribute('data-theme','light');
  else if(t==='dark') document.documentElement.setAttribute('data-theme','dark');
  else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches)
    document.documentElement.setAttribute('data-theme','dark');
})();
</script>
```
*注：此脚本无需改动（已正确处理 null → 跟随系统的行为）。*

---

## 3. Header 布局设计

### 3.1 结构

```
┌──────────────────────────────────────────────────────────────┐
│ [🎱 双色球走势图] │ 下期 2026060（周二） │ [☐|☀|🌙]      │
└──────────────────────────────────────────────────────────────┘
                      ↑ border-bottom: 2px solid
```

**三区域**：
1. **品牌区**（左）：SVG Logo + 标题文字，`gap: 7px`，`flex-shrink: 0`
2. **信息区**（中）：竖线分隔 + "下期" + 期数（红色粗体）+ 星期，`padding-left: 12px`，`border-left: 1px solid var(--border)`
3. **操作区**（右）：三态主题切换器，`margin-left: auto`，`flex-shrink: 0`

### 3.2 尺寸与样式

| 属性 | 值 |
|------|-----|
| 高度 | `48px`（原 52px 缩小 4px） |
| 内边距 | `0 16px` |
| 背景 | `var(--bg-card)` |
| 底部边框 | `border-bottom: 2px solid var(--border)`（加强视觉分割） |
| 阴影 | `var(--shadow-sm)` |
| 定位 | `sticky; top: 0; z-index: 30`（不变）|

**品牌区**：
- Logo SVG: 22×22px，`stroke: var(--red)`，`stroke-width: 2.2`
- 标题: `font-size: 14px; font-weight: 600; color: var(--text); letter-spacing: 0.5px`

**信息区**：
- "下期" label: `font-size: 11px; color: var(--text-3)`
- 期号: `font-size: 13px; font-weight: 700; color: var(--red); font-variant-numeric: tabular-nums`
- 星期: `font-size: 11px; color: var(--text-3)`
- 分隔竖线: `width: 1px; height: 20px; background: var(--border)`（或用 `border-left` 在信息区父元素上）

### 3.3 移动端适配（≤480px）

- 标题文字隐藏（`:after { content:'' }` 或 `font-size:0`），只保留 Logo
- 期数信息精简为"下期 NNNNNN"去掉星期括号
- 主题切换器保持不变（已足够紧凑）

### 3.4 HTML 结构变更

```html
<!-- Before -->
<header class="app-header">
  <div class="brand"><span class="logo">🎱</span><h1>双色球走势图</h1></div>
  <div class="meta" id="meta-info">数据加载中…</div>
  <button class="theme-toggle" id="theme-toggle">🌙</button>
</header>

<!-- After -->
<header class="app-header">
  <div class="header-brand">
    <svg class="logo-icon" viewBox="..."><!-- inline --></svg>
    <h1>双色球走势图</h1>
  </div>
  <div class="header-meta" id="meta-info">数据加载中…</div>
  <div class="theme-segment" id="theme-segment" role="radiogroup" aria-label="主题切换">
    <button role="radio" data-theme="auto" aria-checked="false" title="跟随系统">
      <svg><!-- monitor icon --></svg>
    </button>
    <button role="radio" data-theme="light" aria-checked="true" title="浅色模式">
      <svg><!-- sun icon --></svg>
    </button>
    <button role="radio" data-theme="dark" aria-checked="false" title="深色模式">
      <svg><!-- moon icon --></svg>
    </button>
  </div>
</header>
```

**关键变更点**：
- `logo` 从 `<span>🎱</span>` 改为 `<svg>` 内联
- `theme-toggle` 单按钮改为 `theme-segment` 三按钮容器
- 移除 `.meta` 类，改用 `.header-meta`
- 增加 ARIA 属性：`role="radiogroup"` + `role="radio"` + `aria-checked`

---

## 4. CSS 变更清单

### 4.1 文件：`layout.css`

| 选择器 | 变更类型 | 说明 |
|--------|----------|------|
| `.app-header` | 修改 | 高度 52→48px；底部 border 加粗至 2px |
| `.app-header .brand` | 重命名→`.header-brand` | 保留 flex+gap 布局 |
| `.app-header .logo` | 重命名→`.logo-icon` | span→svg 样式，移除 filter drop-shadow |
| `.app-header h1` | 微调 | font-size 16→14px |
| `.app-header .meta` | 替换→`.header-meta` | 新增 border-left 分隔线样式 |
| `.theme-toggle` | **删除** | 被 `.theme-segment` 替代 |
| **新增 `.theme-segment`** | 新增 | 分段控制器容器（flex, bg, radius, padding） |
| **新增 `.theme-segment button`** | 新增 | 单个按钮样式（32×28px, radius, transition） |
| **新增 `.theme-segment [aria-checked=true]`** | 新增 | 激活态白底+阴影 |
| **新增 `.theme-segment [aria-checked=false]`** | 新增 | 未激活透明+opacity |
| **暗色 `.theme-segment`** | 新增 | `#333` 背景, `#444` 激活 |

### 4.2 文件：`theme.css`

| 选择器 | 变更类型 | 说明 |
|--------|----------|------|
| `.theme-toggle` 全部规则 | **删除** | ~20 行死样式 |
| **暗色模式补充** | 新增 | `.theme-segment` 暗色变量覆盖 |

### 4.3 文件：`responsive.css`

| 选择器 | 变更类型 | 说明 |
|--------|----------|------|
| **移动端 header** | 修改/新增 | 小屏隐藏标题、精简 meta |

---

## 5. JS 变更清单 (`main.js`)

| 函数/块 | 变更 |
|----------|------|
| `getPreferredTheme()` | 保留，逻辑不变（已兼容 null=auto） |
| `syncThemeToggleUI()` | **重写**：更新 3 按钮 aria-checked + 激活态样式 |
| `initThemeToggle()` | **重写**：绑定 3 个按钮 click，实现 auto→light→dark→auto 循环 |
| 防闪烁 script (`index.html`) | **无需改动** |

---

## 6. 无障碍 checklist

- [x] `role="radiogroup"` + `role="radio"` 语义化单选组
- [x] `aria-checked` 动态同步当前状态
- [x] `aria-label` 容器级别 + `title` 每个按钮
- [x] 键盘导航：Tab 可聚焦每个按钮，Space/Enter 触发切换
- [x] SVG 图标有 `aria-hidden="true"`（ decorative）
- [ ] （待验证）screen reader 读出"跟随系统 / 浅色模式 / 深色模式"

---

## 7. 不做之事（YAGNI）

- ~~主题色自定义面板~~ — 3 态足够
- ~~过渡动画渐变~~ — 主题切换应即时生效（可加 150ms fade 后续优化）
- ~~记忆上次位置~~ — localStorage 已处理
- ~~多语言~~ — 当前只有中文用户

---

## 8. 验收标准

1. 首次访问 → 跟随系统（白天亮/夜晚暗）
2. 点击切换：auto → light → dark → auto 循环
3. 选定后刷新页面保持选择
4. 选"跟随系统"后，修改 OS 主题 → 页面自动跟随
5. SVG 图标在两种模式下清晰可见（对比度 ≥ 3:1）
6. 移动端 Header 不溢出、不换行
7. 6/6 JS 语法通过，0 lint error
