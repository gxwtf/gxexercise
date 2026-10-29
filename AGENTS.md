<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 颜色与深色模式约定（改前端必读）

本项目的界面对同时支持 **浅色 / 深色**（`next-themes`，`attribute="class"`，`.dark` 挂在 `<html>` 上，
默认 `system`）。**任何前端改动都必须同时看浅色和深色两种模式**，颜色一律走语义 token。

## 1. 唯一颜色来源

- 颜色变量只定义在 `src/app/globals.css`：`:root`（浅色）+ `.dark`（深色）**两份必须成对**，
  再在 `@theme inline` 里映射成 Tailwind 颜色，业务代码只写语义名。
- 需要新颜色（含品牌色、状态底色）时：先在 `:root` 加 `--xxx`，再到 `.dark` 加同名变量（改明暗，
  不是照抄），然后在 `@theme inline` 写 `--color-xxx: var(--xxx)`，最后才在组件里用。
- **`#hex` / `rgb()` / `oklch()` 只允许出现在 `globals.css`（以及打印稿这类自带独立配色方案的
  局部 CSS，见第 5 条）**，组件 className 里一个都不要写。

## 2. 语义 token 对照表（优先用这些）

| 用途 | 写法 |
| --- | --- |
| 页面底色 / 正文 | `bg-background` / `text-foreground` |
| 卡片、弹层 | `bg-card text-card-foreground` / `bg-popover text-popover-foreground` |
| 次要文字、说明、占位 | `text-muted-foreground`（**正文不要用它**，深色下偏灰） |
| 弱底色块（信息条、答题卡格子） | `bg-muted/50`、`bg-muted` |
| 边框 / 输入框 / 焦点环 | `border-border`、`border-input`、`ring-ring` |
| 主按钮 | `bg-primary text-primary-foreground` |
| 次级按钮 / 选中态 | `bg-secondary`、`bg-accent text-accent-foreground` |
| 危险操作 | `text-destructive` / `bg-destructive`（**只表示危险或报错**） |
| 品牌红（广学红 #A31F24） | `text-brand` / `bg-brand` / `border-brand`（深色模式自动提亮） |
| 1px 边框 | `border`（不要写 `border-1`） |

## 3. 状态色（对/错/评阅中）成对出现

语义色之外的绿/红/黄/蓝**必须浅深成对**，并保持“浅底深字 + 深底浅字”：

```tsx
// ✅ 正确
"border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
"text-green-700 dark:text-green-400"                 // 只有文字时
"border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500 dark:text-green-950"

// ❌ 错误
"text-green-600"                                     // 深色模式对比度不足
"bg-white text-black"                                // 深色模式直接瞎
"text-gray-400 dark:text-gray-500"                   // 深色模式下更黑，越改越糟
```

选色对照（经验值，改完请按第 6 条实测对比度）：

| 语义 | 浅色 | 深色 |
| --- | --- | --- |
| 正确 | `green-700` 文字 / `green-50` 底 / `green-500` 边 | `green-300` 文字 / `green-950` 底 / `green-400` 边 |
| 错误 | `red-700` / `red-50` / `red-500` | `red-300` / `red-950` / `red-400` |
| 待评阅/警告 | `amber-700` / `amber-50` / `amber-400` | `amber-300` / `amber-950/30` / `amber-800` |
| 信息 | `blue-800` / `blue-50` / `blue-200` | `blue-200` / `blue-950/30` / `blue-800` |

## 4. 禁止清单（`pnpm check:colors` 会拦）

1. `bg-white` / `text-black` / `border-black` —— 深色模式下白块、隐形字、隐形框。
2. className 里的 `bg-[#xxx]`、`text-[#xxx]`、任何 `#hex`（品牌色用 `text-brand`）。
3. 调色板原始色阶（`gray|slate|zinc|neutral|stone-50…950`）**没有** `dark:` 变体。
4. `text-white` 配浅色底（如 `bg-gray-400`）—— 白字浮白底；只允许配 `primary`/`destructive`/600+ 饱和色，且要有 `dark:`。
5. 用 `destructive` 变体做普通标签（它是“危险/报错”语义）。
6. 深色页面里出现固定浅色底（白纸效果）——除第 5 条的特殊场景。

## 5. 特殊场景：打印稿 / PDF 报告

打印类页面（如 `report/EssayReport.tsx`）要“白纸黑字”，但里面复用 MDX 组件（用的是语义 token），
直接放在深色页面里会变成“白纸 + 近白字”。做法：**在容器上把语义变量钉回浅色值并声明 `color-scheme: light`**：

```css
.essay-report {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --muted-foreground: oklch(0.42 0 0);
  --border: oklch(0.85 0 0);
  /* …其余 token 同理，见该文件 */
  color-scheme: light;
  background: oklch(1 0 0);
  color: oklch(0.145 0 0);
}
```

不要用“把整块 `bg-white` 写死”来糊，也不要反过来给文字写 `#111` 而忽略里面的 token 组件。

## 6. 改完必须做的三件事

```bash
pnpm check:colors      # 颜色约定自检（改前端必跑，必须 0 问题）
pnpm check:answers     # 判题口径自检（动 answer-check / 判题接口 / 题型大小写规则必跑，必须 PASS）
pnpm build             # 生产构建（线上用 next start，务必本地先过）
# pnpm lint 目前会因 eslint-plugin-react 与 ESLint 10 不兼容而直接崩（与本约定无关），
# 修好之前以 check:colors + build 作为颜色相关的准入门槛。
```

**判题大小写的口径**（`src/lib/answer-check.ts`，改之前先读）：
选择题（choice / single / multiple，含完形、阅读、七选五、数学 / 物理 / 化学 / 语文选择题）的答案是
选项字母，大小写 / 分隔符 / 全角一律忽略；**语法填空 grammar、选词填空 word-choice 的答案是单词，
判分必须区分大小写**（由 `isCaseSensitiveAnswer()` 按题型判定，两个提交接口都要传）。
注意答案只是字母（含选词填空语料框 A–K）时仍按不敏感处理。

**并肉眼过一遍浅色和深色**：`ThemeToggle` 切换，或浏览器 DevTools → Rendering →
`prefers-color-scheme: dark`。重点看：文字是否发灰看不清、白块、隐形边框、图表/圆环/进度条、
代码/公式（KaTeX 跟随 `currentColor`）、图片说明文字、弹窗与下拉菜单。

## 7. 常见“深色模式下显示不好”的原因（本项目踩过的坑）

| 现象 | 根因 | 正确做法 |
| --- | --- | --- |
| 词库/材料框边框消失 | `border-1 border-black` | `border border-border bg-muted/40` |
| 导航当前项几乎看不见 | 写死 `text-[#A31F24]` | `text-brand` |
| 回顾页干扰项很暗 | `dark:text-gray-500` | `text-muted-foreground` |
| 题号按钮白字浮浅灰底 | `text-white` + `bg-gray-400` | `bg-primary text-primary-foreground` 或 `bg-muted text-foreground` |
| 进度圆环/统计数字糊 | 写死 `gray-200/700/400` | `text-muted` / `text-foreground` / `text-muted-foreground` |
| 滚动条、原生控件发白 | 缺 `color-scheme` | `:root{color-scheme:light}`、`.dark{color-scheme:dark}`（已配） |
| 批改报告白纸里看不见字 | 打印稿继承了深色 token | 第 5 条：容器内重置变量 + `color-scheme: light` |
