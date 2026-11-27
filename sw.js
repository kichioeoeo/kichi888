/* 餃浸腦汁鍋貼店 Service Worker：離線可開、靜態資源快取 */
const VERSION = 'v1';
const CORE = `core-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const CORE_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './images/logo.svg',
  './js/street3d.js',
  './fonts/GenSenRounded2TW-R.subset.woff2',
  './fonts/GenSenRounded2TW-M.subset.woff2',
  './fonts/GenSenRounded2TW-B.subset.woff2',
  './fonts/GenSenRounded2TW-H.subset.woff2'
];
// 可快取的外部資源（CDN 函式庫、圖片）
const CACHEABLE_HOSTS = ['cdn.tailwindcss.com', 'unpkg.com', 'cdn.jsdelivr.net', 'images.unsplash.com', 'i.postimg.cc'];

// 網頁用到的外部函式庫：安裝時一起存下來，第一次離線也能正常顯示
const CDN_FILES = [
  ['https://cdn.tailwindcss.com', 'no-cors'],
  ['https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js', 'no-cors'],
  ['https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js', 'cors']
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const core = await caches.open(CORE);
    await core.addAll(CORE_FILES);
    const runtime = await caches.open(RUNTIME);
    await Promise.all(CDN_FILES.map(async ([url, mode]) => {
      try { const res = await fetch(url, { mode }); if (res.ok || res.type === 'opaque') await runtime.put(url, res); } catch {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CORE && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 頁面：先抓網路（拿到最新版），失敗時用快取，讓離線也能打開
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CORE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 同網域靜態檔與 CDN：先用快取，背景更新
  if (url.origin === self.location.origin || CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(RUNTIME).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
