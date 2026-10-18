#!/usr/bin/env node
/**
 * 前端颜色自检（深色/浅色模式约定）
 *
 * 用法：pnpm check:colors        # 自检，发现问题时退出码 1
 *      node scripts/check-colors.mjs --verbose
 *
 * 规则（与 AGENTS.md「颜色与深色模式约定」一致）：
 *  1. 禁止固定色值：bg-white / text-black / border-black / bg-[#xxxxxx] / #xxxxxx 写在 className 里。
 *  2. 使用调色板原始色阶（gray-500、slate-400 之类）时，必须在同一处给出 dark: 变体，
 *     否则请改用语义 token（foreground / muted-foreground / border / muted …）。
 *  3. Tailwind 里 1px 边框就是 `border`，禁止写 `border-1`。
 *  4. text-white 只能配 primary / destructive / 600+ 饱和底色，且同样需要 dark: 成对。
 *  5. globals.css 里 :root 定义的语义色变量，必须在 .dark 里同样定义（反之亦然）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const VERBOSE = process.argv.includes('--verbose')

const PALETTE = '(?:gray|slate|zinc|neutral|stone)'
const COLOR_PREFIX = '(?:text|bg|border|divide|ring|outline|from|via|to|fill|stroke|decoration|shadow|placeholder|caret|accent)'
const SCALE_RE = new RegExp(`\\b${COLOR_PREFIX}-${PALETTE}-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`, 'g')

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/
const BANNED_ABSOLUTE = [
  { re: /\bbg-white\b/g, hint: '深色模式会变成刺眼白块 → 用 bg-background / bg-card / bg-muted' },
  { re: /\btext-black\b/g, hint: '深色模式下不可见 → 用 text-foreground' },
  { re: /\bborder-black\b/g, hint: '深色模式下边框不可见 → 用 border-border / border-foreground/20' },
  { re: /\bborder-1\b/g, hint: 'Tailwind 里 1px 就是 border，写 border-1 容易和 border-<color> 混淆' },
]
const DARK_ONLY_HEX_ALLOW = new Set(['src/app/globals.css'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === 'generated') continue
      walk(p, out)
    } else if (/\.(tsx|ts|css)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

const problems = []
const add = (file, line, rule, detail) => problems.push({ file: relative(ROOT, file), line, rule, detail })

/** 抓取所有“像 class 名”的字符串字面量（含模板字符串与 CSS 片段） */
function classLiterals(text) {
  const lits = []
  const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g
  let m
  while ((m = re.exec(text))) {
    const body = m[2]
    if (!/[a-z]/.test(body)) continue
    // 只保留包含 Tailwind 颜色/边框写法的片段，避免误报普通文案
    if (!new RegExp(`${COLOR_PREFIX}-|\\bborder\\b|dark:`).test(body)) continue
    const start = text.slice(0, m.index).split('\n').length
    lits.push({ body, start })
  }
  return lits
}

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')

  if (file.endsWith('.css')) {
    // 规则 4：:root 与 .dark 的变量集合必须一致
    if (rel.endsWith('globals.css')) {
      const blockOf = (sel) => {
        const i = text.indexOf(sel + ' {')
        if (i < 0) return null
        const start = text.indexOf('{', i) + 1
        const end = text.indexOf('\n}', start)
        return text.slice(start, end)
      }
      const rootBlock = blockOf(':root')
      const darkBlock = blockOf('.dark')
      // --radius / --font-* 这类尺寸类变量只在 :root 定义，不参与成对校验
      const varsOf = (block) => new Set(
        [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)]
          .map((m) => m[1])
          .filter((v) => !/^--(radius|font|spacing)/.test(v)),
      )
      if (rootBlock && darkBlock) {
        const a = varsOf(rootBlock)
        const b = varsOf(darkBlock)
        for (const v of a) if (!b.has(v)) add(file, 0, 'css-var-pair', `:root 有 ${v}，.dark 里缺少同名变量（深色模式会落回浅色值）`)
        for (const v of b) if (!a.has(v)) add(file, 0, 'css-var-pair', `.dark 有 ${v}，:root 里缺少同名变量`)
      }
    }
    continue
  }

  const lits = classLiterals(text)

  // 规则 1 / 3：固定色值
  for (const { re, hint } of BANNED_ABSOLUTE) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const line = text.slice(0, m.index).split('\n').length
      if (lines[line - 1]?.includes('color-check: ignore')) continue
      add(file, line, 'absolute-color', `${m[0]} —— ${hint}`)
    }
  }

  // 十六进制色值只允许出现在 globals.css（并由 :root/.dark 成对定义）
  if (!DARK_ONLY_HEX_ALLOW.has(rel)) {
    for (const { body, start } of lits) {
      if (/#[0-9a-fA-F]{3,8}/.test(body)) {
        const hit = body.match(/#[0-9a-fA-F]{3,8}/)[0]
        add(file, start, 'hex-color', `${hit} 是写死的色值 → 改成语义 token 或 CSS 变量`)
      }
    }
  }

  // 规则 2：原始色阶缺少 dark: 成对
  for (const { body, start } of lits) {
    SCALE_RE.lastIndex = 0
    if (!SCALE_RE.test(body)) continue
    if (/dark:/.test(body)) continue
    const sample = body.match(SCALE_RE).slice(0, 3).join(' ')
    add(file, start, 'missing-dark', `${sample} 没有 dark: 变体 → 加 dark: 成对颜色，或换成语义 token`)
  }

  // 规则 4：text-white 只能配主色/饱和底色
  for (const { body, start } of lits) {
    if (!/\btext-white\b/.test(body)) continue
    const okBg = /\bbg-(?:primary|destructive|black)\b/.test(body) ||
      /\bbg-[a-z]+-(?:500|600|700|800|900)\b/.test(body)
    if (!okBg) add(file, start, 'text-white', 'text-white 缺少足够的深色背景配对 → 用 text-primary-foreground 或配 600+ 饱和底色')
    else if (!/dark:/.test(body) && !/\bbg-(?:primary|destructive)\b/.test(body)) {
      add(file, start, 'text-white', 'text-white + 调色板底色需要 dark: 变体，避免深色模式里白字浮在浅色块上')
    }
  }
}

if (problems.length === 0) {
  console.log('✔ 颜色自检通过：没有发现固定色值 / 缺少深色变体的写法')
  process.exit(0)
}

const byFile = new Map()
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, [])
  byFile.get(p.file).push(p)
}
for (const [file, list] of [...byFile.entries()].sort()) {
  console.log(`\n${file}`)
  for (const p of list.slice(0, VERBOSE ? 100 : 20)) {
    console.log(`  ${p.line}: [${p.rule}] ${p.detail}`)
  }
  if (!VERBOSE && list.length > 20) console.log(`  … 另外 ${list.length - 20} 处（--verbose 查看全部）`)
}
console.log(`\n共 ${problems.length} 处问题，涉及 ${byFile.size} 个文件。`)
console.log('约定详见 AGENTS.md「颜色与深色模式约定」。')
process.exit(1)
