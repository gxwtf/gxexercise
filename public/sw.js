/* 极简 Service Worker：只为了让浏览器提供「添加到主屏幕」能力。
   不做离线缓存（题库页面是动态数据，缓存反而容易看到旧内容）。 */
const SW_VERSION = 'gxexercise-v1';
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
  // 直接走网络，仅用于满足可安装条件
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((r) => r || Response.error())));
});
