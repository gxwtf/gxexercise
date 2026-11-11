/**
 * 「进入做题页之前的那一页」的记录（做题页 / 回顾页的「返回」按钮用）。
 *
 * 为什么不用 document.referrer：站内跳转全是客户端路由（<Link>），
 * document.referrer 永远停在「整页加载时的那一页」，拿不到真实来路；
 * 之前「从筛选过的列表点进题目、返回后筛选没了」就是这么来的。
 *
 * 现在的做法：
 *   1) 列表页每次筛选 / 翻页都把当前地址（**含 ?year=2020 这类查询串**）写进 list_url；
 *   2) 点卡片的那一刻，再按题目 / 套卷 id 记一份 practice_entry_<id>（多标签、多题目互不覆盖）。
 * 「返回」的顺序见 resolveBackTarget：先按 id 那份，再浏览器历史，最后 list_url。
 */

const LIST_URL_KEY = "list_url";
const ENTRY_PREFIX = "practice_entry_";

const currentUrl = () => window.location.pathname + window.location.search;

function safeRead(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key) || null;
  } catch {
    return null; // 隐私模式 / 存储被禁用
  }
}

function safeWrite(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* 忽略 */
  }
}

/** 记下列表页当前地址（含筛选条件）。列表页每次筛选、翻页都要调一次。 */
export function rememberListUrl(url?: string) {
  if (typeof window === "undefined") return;
  const value = url ?? currentUrl();
  if (!value) return;
  safeWrite(LIST_URL_KEY, value);
}

/** 最近一次列表页地址（含筛选条件）。 */
export function readListUrl(): string | null {
  if (typeof window === "undefined") return null;
  return safeRead(LIST_URL_KEY);
}

/** 记下「从这一页点进去的题目 / 套卷」，返回时按 id 取回。 */
export function rememberPracticeEntry(id: string, url?: string) {
  if (typeof window === "undefined" || !id) return;
  const value = url ?? currentUrl();
  if (!value) return;
  safeWrite(`${ENTRY_PREFIX}${id}`, value);
}

/** 取「进入这道题之前的那一页」。 */
export function readPracticeEntry(id: string): string | null {
  if (typeof window === "undefined" || !id) return null;
  return safeRead(`${ENTRY_PREFIX}${id}`);
}

/**
 * 「返回」该去哪儿：
 *   1) 点卡片时按 id 记下的那一页（最准，带筛选条件）；
 *   2) 浏览器历史（比如从首页 / 记录页点进来的）；
 *   3) 最近一次列表页（新标签页打开套卷时历史只有一条，靠这个兜底）；
 *   4) 实在没有就回首页。
 * 做题页 / 回顾页的返回按钮共用这一套，避免各写一套各踩各的坑。
 */
export function resolveBackTarget(id?: string): { type: "push"; url: string } | { type: "back" } {
  const entry = id ? readPracticeEntry(id) : null;
  if (entry) return { type: "push", url: entry };

  if (typeof window !== "undefined" && window.history.length > 1) return { type: "back" };

  const listUrl = readListUrl();
  if (listUrl) return { type: "push", url: listUrl };

  return { type: "push", url: "/" };
}
