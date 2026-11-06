import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * 取站点版本号（`package.json` 的 `version`）。
 *
 * 为什么运行时读而不是 `import pkg from "../../package.json"`：
 * 后者会被构建期内联，改了 package.json 必须重新 build 才会变；
 * 这里按请求读一次并缓存，**改完 version 重启服务即可生效**（首页是 force-dynamic）。
 */
let cached: string | null = null

export function getAppVersion(): string {
  if (cached) return cached
  try {
    const raw = readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
    const version = (JSON.parse(raw) as { version?: unknown }).version
    if (typeof version === "string" && version.trim()) {
      cached = version.trim()
      return cached
    }
  } catch {
    // 读不到就返回 unknown，首页照常渲染
  }
  return "unknown"
}
