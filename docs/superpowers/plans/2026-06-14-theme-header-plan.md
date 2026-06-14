# 三态主题切换 + Header 重构 实施计划

> **Goal:** 将 2 态 emoji 主题按钮升级为 3 态 SVG 分段控制器，Header 从扁平三段式改为紧凑信息栏
> **Architecture:** 纯前端 HTML/CSS/JS 改造，无新依赖，SVG 内联
> **Tech Stack:** Vanilla HTML/CSS/ES Module JS

---

### Task 1: HTML 结构改造 (`index.html`)

**Files:**
- Modify: `index.html` (header 区域)

- [ ] **Step 1: 替换 header 结构**

将 `<span class="logo">🎱</span>` → SVG inline logo，`.theme-toggle` 单按钮 → `.theme-segment` 三态分段控制器。保留 `id` 引用。

---

### Task 2: CSS 样式重构 (`layout.css` + `theme.css` + `responsive.css`)

**Files:**
- Modify: `css/layout.css`
- Modify: `css/theme.css`
- Modify: `css/responsive.css`

- [ ] **Step 1: layout.css — Header 布局**
  - `.app-header`: height 52→48px, border-bottom 加粗
  - `.brand` → `.header-brand`, 新增 `.logo-icon`
  - 删除 `.logo` / `.meta`, 新增 `.header-meta`(带 border-left)
  - 删除全部 `.theme-toggle` 规则
  - 新增 `.theme-segment` 容器 + button + aria-checked 态

- [ ] **Step 2: theme.css — 清理死样式**
  - 删除 `.theme-toggle` 全部规则 (~20 行)
  - 暗色模式补充 `.theme-segment` 覆盖

- [ ] **Step 3: responsive.css — 移动端适配**
  - 小屏隐藏标题文字、精简 meta

---

### Task 3: JS 逻辑重写 (`main.js`)

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: 重写主题切换逻辑**
  - `syncThemeToggleUI()` → 更新 3 按钮 aria-checked + active class
  - `initThemeToggle()` → 绑定 3 按钮 click, auto→light→dark→auto 循环
  - localStorage: null=auto, 'light'=light, 'dark'=dark
  - 系统变化监听仅在 auto 模式下生效

---

### Task 4: 验证门控

- [ ] **Step 1:** 6/6 JS syntax pass
- [ ] **Step 2:** 0 lint error
- [ ] **Step 3:** HTTP 全 200
- [ ] **Step 4:** 浏览器预览确认视觉效果

---

## 自审清单

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 三态分段控件 | Task 1 + Task 2.1 |
| SVG 图标（无 emoji）| Task 1 |
| auto→light→dark→auto 循环 | Task 3 |
| localStorage null=auto | Task 3 |
| 暗色模式适配 | Task 2.1 + Task 2.2 |
| 移动端适配 | Task 2.3 |
| ARIA 无障碍 | Task 1 |
| Header 高度 48px | Task 2.1 |
