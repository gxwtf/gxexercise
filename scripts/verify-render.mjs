#!/usr/bin/env node
/**
 * 渲染验证工具：给题组 / 套卷页面出一张无头浏览器截图，并对 HTML 做硬断言。
 *
 * 背景：历史 / 地理 / 政治 三科一模题组入库后要「亲眼确认」选择题、材料+小问、图表题
 * 都渲染正常。生产站点需要广学账号 SSO 登录，肉眼看图成本高；这里用 iron-session 自己封一个
 * 会话 cookie，起一个**临时**预览服务器（不碰生产的 1229 / gxercise.service），截图 + 断言一把过。
 *
 * 用法：
 *   node scripts/verify-render.mjs --group <id>[,<id>...] --expect "材料,设问,A．" --out /tmp/shots
 *   node scripts/verify-render.mjs --path "question/<id>" --path "test-paper/<id>" --expect "关键词"
 *
 * 选项：
 *   --group <ids>       题组 id（逗号分隔），内部换算成 question/<id>
 *   --path <rel>        相对路径（可重复或逗号分隔），如 question/<id>、test-paper/<id>、question/<id>/review
 *   --expect "a,b,c"    页面正文里必须出现的关键词（半角/全角逗号、竖线都算分隔符）
 *   --out <dir>         截图目录，默认 /tmp/verify-render
 *   --port <n>          预览服务器端口，默认 13001
 *   --relay-port <n>    会话中转/图片直出端口，默认 13002
 *   --user-id <n>       会话里的 userId，默认从 User 表或 QuestionSubmission 里取一个存在的
 *   --md-root <dir>     /exam-images 对应的本地根目录，默认 /home/gxwtf/jingshibang/output_docx_to_md
 *   --wait <ms>         等预览服务器就绪的上限，默认 120000
 *   --keep              结束时不杀预览服务器（调试用）
 *   --no-shot           只做断言，不截图
 *   --keep-pwa-prompt   截图时不要注入「添加到主屏幕」的关闭脚本（默认注入，免得浮层挡住正文）
 *   --script <file>     注入一段自定义 JS 到 <head>（页面水合后执行）。用于模拟作答 / 点击，
 *                       例如验证「没作答点返回不弹框、作答后点返回才弹框」这类纯前端状态逻辑。
 *   --height <px>       截图视口高度，默认 1800（长卷想看更多就给 3600/5000）
 *
 * 退出码：全部通过 0；任一断言失败 / 出图失败 非 0。
 *
 * 为什么中转服务除了发 cookie 还要代理：生产的 /exam-images/** 是 nginx alias 直出的
 * （解析流水线的图片目录），Next 自己没有这条路由，所以预览服务器上图片必然 404。
 * 中转服务把 /exam-images/** 从本地磁盘直出、其余请求带 cookie 反代到预览服务器，
 * 这样截图里的图片才是真的能看见的（否则「图片没显示」全是假警报）。
 */
import { createServer, request as httpRequest } from "node:http"
import { spawn, execFileSync } from "node:child_process"
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const REPO_ROOT = path.resolve(import.meta.dirname, "..")
const SESSION_COOKIE = "gxexercise_session"

/* ------------------------------------------------------------------ 参数 */

function parseArgs(argv) {
  const opts = {
    groups: [],
    paths: [],
    expect: [],
    out: "/tmp/verify-render",
    port: 13001,
    relayPort: 13002,
    userId: null,
    mdRoot: "/home/gxwtf/jingshibang/output_docx_to_md",
    wait: 120000,
    keep: false,
    shot: true,
    hidePwa: true,
    script: null,          // --script <file>：注入到 <head> 的自定义 JS（页面水合后执行，用于模拟作答/点击）
    height: 1800,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith("--")) throw new Error(`${arg} 缺少取值`)
      i += 1
      return v
    }
    const splitList = (v) => String(v).split(/[,，|]/).map((s) => s.trim()).filter(Boolean)
    switch (arg) {
      case "--group": opts.groups.push(...splitList(next())); break
      case "--path": opts.paths.push(...splitList(next())); break
      case "--expect": opts.expect.push(...splitList(next())); break
      case "--out": opts.out = next(); break
      case "--port": opts.port = Number(next()); break
      case "--relay-port": opts.relayPort = Number(next()); break
      case "--user-id": opts.userId = Number(next()); break
      case "--md-root": opts.mdRoot = next(); break
      case "--wait": opts.wait = Number(next()); break
      case "--keep": opts.keep = true; break
      case "--keep-pwa-prompt": opts.hidePwa = false; break
      case "--script": opts.script = argv[++i]; break
      case "--height": opts.height = Number(next()); break
      case "--no-shot": opts.shot = false; break
      case "-h": case "--help":
        console.log(readFileSync(import.meta.filename, "utf-8").split("*/")[0])
        process.exit(0)
        break
      default:
        throw new Error(`未知参数 ${arg}`)
    }
  }
  for (const g of opts.groups) opts.paths.push(`question/${g}`)
  // --path 支持「路径 => 该页专属关键词(逗号/分号分隔)」，
  // 便于一次跑多张内容不同的页面时各给各的关键词
  opts.pages = opts.paths.map((raw) => {
    const [rel, ...rest] = String(raw).split("=>")
    const own = rest.join("=>").split(/[,，;；|]/).map((s) => s.trim()).filter(Boolean)
    return { path: rel.trim(), expect: [...own, ...opts.expect] }
  })
  return opts
}

/* ------------------------------------------------------------------ .env */

/** 读仓库根的 .env（不覆盖已经存在的环境变量） */
function loadEnv(file = path.join(REPO_ROOT, ".env")) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
}

/* ------------------------------------------------------------------ 工具 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 带 cookie 的 GET，不自动跟随重定向（重定向本身就是要断言的一部分） */
function httpGet(url, { cookie, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, {
      method: "GET",
      headers: {
        ...(cookie ? { cookie } : {}),
        "accept-encoding": "identity",
        "user-agent": "gxexercise-verify-render/1.0",
      },
      timeout,
    }, (res) => {
      const chunks = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => resolve({
        status: res.statusCode || 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf-8"),
      }))
    })
    req.on("timeout", () => req.destroy(new Error(`请求超时：${url}`)))
    req.on("error", reject)
    req.end()
  })
}

/** HTML → 纯文本（去标签、解常见实体、压缩空白），用于关键词断言 */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&emsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

/** 关键词比对时的宽松化：去掉所有空白 + 全角字符归一（A． vs A.） */
function loose(text) {
  return String(text)
    .replace(/\s+/g, "")
    .replace(/[．。]/g, ".")
    .replace(/[，]/g, ",")
    .replace(/[（]/g, "(").replace(/[）]/g, ")")
    .replace(/[：]/g, ":")
}

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
}

/* ------------------------------------------------- 会话 cookie（iron-session） */

async function makeSessionCookie(password, sessionData) {
  const { sealData } = await import("iron-session")
  // ttl 与 getIronSession 的默认一致（14 天），否则 unseal 端会认为过期
  const sealed = await sealData(sessionData, { password, ttl: 1209600 })
  return sealed
}

/** 从库里挑一个存在的用户（优先 User 表，其次 QuestionSubmission） */
function pickUserId(databaseUrl) {
  const psql = (sql) => execFileSync("psql", [databaseUrl, "-Atc", sql], { encoding: "utf-8" }).trim()
  const queries = [
    `select id::text || '|' || coalesce("userName", '') from "User" order by id limit 1`,
    `select "userId"::text || '|u' from "QuestionSubmission" order by "userId" desc limit 1`,
  ]
  for (const sql of queries) {
    try {
      const out = psql(sql).split("\n").filter(Boolean)[0]
      if (!out) continue
      const [id, name] = out.split("|")
      if (id && Number(id) > 0) return { userid: Number(id), username: name || `user${id}` }
    } catch {
      /* 试下一条 */
    }
  }
  return null
}

/* --------------------------------------------------------------- 中转服务 */

/**
 * 13002 上的中转服务：
 * - /exam-images/** → 直接从本地流水线目录按 nginx 同样的规则直出图片
 * - 其余 → 带会话 cookie 反代到预览服务器（同时把 Set-Cookie 回给浏览器）
 */
function startRelay({ relayPort, port, sealed, mdRoot, hidePwa, injectScript }) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${relayPort}`)
    const setCookie = `${SESSION_COOKIE}=${sealed}; Path=/; HttpOnly; SameSite=Lax`

    if (url.pathname.startsWith("/exam-images/")) {
      const rel = decodeURIComponent(url.pathname.slice("/exam-images/".length))
      // 与生产 nginx 同一套约束：只要 images/ 子目录下的图片扩展名，防止穿越
      const ok = /^[^/]+\/[^/]+\/[^/]+\/images\/[^/]+\.(?:png|jpg|jpeg|gif|webp)$/i.test(rel)
      const file = path.resolve(mdRoot, rel)
      if (!ok || !file.startsWith(path.resolve(mdRoot) + path.sep) || !existsSync(file)) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
        res.end("404 image not found")
        return
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "content-length": statSync(file).size,
        "cache-control": "no-store",
      })
      res.end(readFileSync(file))
      return
    }

    const upstream = httpRequest({
      host: "127.0.0.1",
      port,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${port}`,
        cookie: `${SESSION_COOKIE}=${sealed}`,
        "accept-encoding": "identity",
      },
      timeout: 60000,
    }, (upRes) => {
      const headers = { ...upRes.headers, "set-cookie": setCookie }
      const isHtml = /text\/html/i.test(String(upRes.headers["content-type"] || ""))
      if ((!hidePwa && !injectScript) || !isHtml) {
        delete headers["content-length"]
        res.writeHead(upRes.statusCode || 502, headers)
        upRes.pipe(res)
        return
      }
      // 截图模式：预置「不显示添加到主屏幕浮层」的 localStorage，避免浮层盖住正文。
      // 必须注入在 <head> 里、React 水合之前生效（WebAppManager 挂载时读这个键）。
      const chunks = []
      upRes.on("data", (c) => chunks.push(c))
      upRes.on("end", () => {
        const pwa = hidePwa
          ? '<script>try{localStorage.setItem("gxexercise-a2hs-dismissed","true")}catch(e){}</script>'
          : ""
        const extra = injectScript ? `<script>${injectScript.replace(/<\/script>/gi, "<\\/script>")}</script>` : ""
        const html = Buffer.concat(chunks).toString("utf-8").replace(
          /<head([^>]*)>/i,
          `<head$1>${pwa}${extra}`
        )
        const body = Buffer.from(html, "utf-8")
        delete headers["content-length"]
        delete headers["transfer-encoding"]
        headers["content-length"] = String(body.length)
        res.writeHead(upRes.statusCode || 502, headers)
        res.end(body)
      })
    })
    upstream.on("error", (err) => {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" })
      res.end(`502 upstream error: ${err.message}`)
    })
    req.pipe(upstream)
  })

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(relayPort, "127.0.0.1", () => resolve(server))
  })
}

/* --------------------------------------------------------- 预览服务器 */

async function startPreview({ port, waitMs }) {
  const logFile = path.join("/tmp", `verify-render-next-${port}.log`)
  const child = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, NODE_ENV: "production" },
  })
  const log = createWriteStream(logFile)
  child.stdout.pipe(log)
  child.stderr.pipe(log)
  let exited = null
  child.on("exit", (code, signal) => { exited = { code, signal } })

  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    if (exited) throw new Error(`预览服务器提前退出（code=${exited.code}），日志：${logFile}`)
    try {
      await httpGet(`http://127.0.0.1:${port}/login`, { timeout: 3000 })
      return { child, logFile }
    } catch {
      await sleep(700)
    }
  }
  throw new Error(`预览服务器 ${waitMs}ms 内没起来，日志：${logFile}`)
}

/* ------------------------------------------------------------- 截图 */

function shoot({ url, outFile, height }) {
  return new Promise((resolve) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=1280,${height}`,
      "--virtual-time-budget=12000",
      `--screenshot=${outFile}`,
      url,
    ]
    const child = spawn("/usr/bin/microsoft-edge", args, { stdio: ["ignore", "ignore", "pipe"] })
    let err = ""
    child.stderr.on("data", (c) => { err += c.toString() })
    const timer = setTimeout(() => { try { child.kill("SIGKILL") } catch { /* 忽略 */ } }, 90000)
    child.on("exit", (code) => {
      clearTimeout(timer)
      const ok = existsSync(outFile) && statSync(outFile).size > 20000
      resolve({
        ok,
        size: existsSync(outFile) ? statSync(outFile).size : 0,
        code,
        err: ok ? "" : err.split("\n").filter(Boolean).slice(-3).join(" | "),
      })
    })
  })
}

/* ------------------------------------------------------------------ 主流程 */

async function main() {
  loadEnv()
  const opts = parseArgs(process.argv.slice(2))
  if (opts.paths.length === 0) {
    console.error("至少给一个 --group 或 --path（--help 看用法）")
    process.exit(2)
  }
  const databaseUrl = process.env.DATABASE_URL
  const secret = process.env.SES_SECRET
  if (!secret) {
    console.error(`.env 里没有 SES_SECRET（${path.join(REPO_ROOT, ".env")}）`)
    process.exit(2)
  }

  let session = { userid: opts.userId, username: `user${opts.userId ?? ""}` }
  if (!opts.userId) {
    if (!databaseUrl) {
      console.error("既没有 --user-id，.env 里也没有 DATABASE_URL，无法挑用户")
      process.exit(2)
    }
    const picked = pickUserId(databaseUrl)
    if (!picked) {
      console.error("库里没找到可用用户，请用 --user-id 指定")
      process.exit(2)
    }
    session = picked
  }
  const sealed = await makeSessionCookie(secret, {
    username: session.username,
    isLoggedIn: true,
    counter: 0,
    email: "",
    userid: session.userid,
    admin: true,
    real_name: session.username,
    grade: 3,
  })

  mkdirSync(opts.out, { recursive: true })
  let preview = null
  let relay = null
  const results = []

  try {
    console.log(`▶ 会话：userid=${session.userid} username=${session.username}`)
    console.log(`▶ 起预览服务器 127.0.0.1:${opts.port} ...`)
    preview = await startPreview({ port: opts.port, waitMs: opts.wait })
    console.log(`  就绪（日志 ${preview.logFile}）`)
    relay = await startRelay({
      relayPort: opts.relayPort, port: opts.port, sealed, mdRoot: opts.mdRoot, hidePwa: opts.hidePwa,
      injectScript: opts.script ? readFileSync(opts.script, "utf-8") : null,
    })
    console.log(`▶ 中转/图片服务 127.0.0.1:${opts.relayPort}`)

    for (const { path: rel, expect: pageExpect } of opts.pages) {
      const clean = rel.replace(/^\/+/, "")
      const url = `http://127.0.0.1:${opts.relayPort}/${clean}`
      const slug = clean.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120)
      const outFile = path.join(opts.out, `${slug}.png`)
      const problems = []

      const res = await httpGet(url, { cookie: `${SESSION_COOKIE}=${sealed}` })
      const text = htmlToText(res.body)

      // 1) HTTP 200 且不是重定向（没有会话时 Next 会 307 到 /login）
      if (res.status !== 200) problems.push(`HTTP ${res.status}${res.headers.location ? ` → ${res.headers.location}` : ""}`)
      // 2) 不是登录页
      if (/name="password"|请输入用户名|用户登录页面/.test(res.body)) problems.push("渲染成登录页（会话没生效）")
      if (/(?:^|\/)sso\/login/.test(res.headers.location || "")) problems.push("被重定向到 SSO 登录")
      // 3) 预期关键词
      const missing = pageExpect.filter((kw) => !loose(text).includes(loose(kw)))
      if (missing.length) problems.push(`缺少关键词：${missing.join(" / ")}`)
      // 4) 页面里 <img> 的 /exam-images 文件必须真实存在于磁盘
      const srcs = [...res.body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1])
      const imgFiles = srcs.map((s) => s.replace(/[?&]v=\d+$/, ""))
      const broken = imgFiles.filter((s) => s.startsWith("/exam-images/") &&
        !existsSync(path.resolve(opts.mdRoot, decodeURIComponent(s.slice("/exam-images/".length)))))
      if (broken.length) problems.push(`图片文件缺失 ${broken.length} 个：${broken.slice(0, 3).join(" , ")}`)
      if (/暂无文章内容|暂不支持的题型|NotFound|页面不存在/.test(text)) problems.push("页面显示「暂无/不支持/404」占位")

      // 5) 截图
      let shotInfo = null
      if (opts.shot) {
        shotInfo = await shoot({ url, outFile, height: opts.height })
        if (!shotInfo.ok) problems.push(`截图失败（size=${shotInfo.size}B code=${shotInfo.code}）${shotInfo.err}`.trim())
      }

      results.push({
        path: clean, status: res.status, problems, images: imgFiles.length,
        shot: shotInfo ? outFile : null, text: text.slice(0, 100),
      })
      console.log(`${problems.length ? "✗" : "✓"} /${clean}  status=${res.status} 图${imgFiles.length} ` +
        `${shotInfo ? `截图=${outFile}(${Math.round(shotInfo.size / 1024)}KB)` : ""}`)
      for (const p of problems) console.log(`    - ${p}`)
    }
  } finally {
    if (relay) await new Promise((r) => relay.close(r))
    if (preview && !opts.keep) {
      try { process.kill(-preview.child.pid, "SIGKILL") } catch { /* 忽略 */ }
      try { preview.child.kill("SIGKILL") } catch { /* 忽略 */ }
    }
  }

  const failed = results.filter((r) => r.problems.length > 0)
  console.log(`\n==== 汇总 ====`)
  console.log(`页面 ${results.length} 个：通过 ${results.length - failed.length}，失败 ${failed.length}`)
  if (failed.length) {
    console.log("失败明细：")
    for (const r of failed) console.log(`  /${r.path} → ${r.problems.join("；")}`)
    process.exit(1)
  }
  console.log(`结论：PASS —— 所有页面 200、会话有效、关键词齐备、图片文件存在、截图已生成`)
}

main().catch((err) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
