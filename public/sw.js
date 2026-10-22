/* 极简 Service Worker：只为了让浏览器提供「添加到主屏幕」能力。
   不做离线缓存（题库页面是动态数据，缓存反而容易看到旧内容）。

   注意：/api/、/exam-images/、/_next/ 一律不接管，直接交给浏览器原生处理。
   原因：Safari 在 SW 接管下处理 Content-Disposition: attachment 的下载有问题——
   请求被 SW 的 fetch 吞掉后，浏览器的下载管理器拿不到它，页面就一直转圈。 */
const SW_VERSION = 'gxexercise-v2';
const BYPASS = ['/api/', '/exam-images/', '/_next/', '/sw.js'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  let url;
  try { url = new URL(event.request.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  if (BYPASS.some((p) => url.pathname.startsWith(p))) return;   // 交给浏览器原生处理（下载/图片）
  // 直接走网络，仅用于满足可安装条件
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((r) => r || Response.error())));
});
