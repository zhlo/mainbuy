// MainBuy 主力雷達 — 輕量安全 Service Worker
// 嚴格規則：絕不快取 live-data.json、market-stocks.json 與任何外部動態 API，確保每次皆讀取最新真實市場資料

const SHELL_CACHE = 'mainbuy-shell-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-192.png',
  './pwa-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. 外部公開 API / 券商分點主機：完全不攔截、不快取
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. 嚴格禁止快取 live-data.json 與 market-stocks.json 動態資料（強制直連最新網路）
  if (
    url.pathname.endsWith('/live-data.json') ||
    url.pathname.endsWith('/market-stocks.json') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 3. 靜態介面資產採用 Network-First（連線時永遠優先取最新版，離線時回退快取）
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
