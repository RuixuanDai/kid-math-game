// 童趣数学小王国 - PWA Service Worker (Network-First 实时热更新 + 断网离线畅玩兜底)
const CACHE_NAME = 'kid-math-pwa-v20261107-games-v8';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/game.js',
  './js/audio.js',
  './js/confetti.js',
  './lib/web-natural-tts.js',
  './lib/web-online-tts.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' }).then((res) => {
            if (res.ok) return cache.put(url, res);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. 绝不拦截 /api/tts 在线语音接口
  if (url.pathname.includes('/api/tts') || url.pathname === '/qr') {
    return;
  }

  // 2. 仅处理同源静态资源请求
  if (url.origin !== self.location.origin) {
    return;
  }

  const cleanUrl = new URL(url.origin + url.pathname);
  const isCodeOrDoc =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.webmanifest');

  // 3. HTML / JS / CSS / Manifest 全部采用 Network-First（杜绝旧缓存吞掉新功能），仅在断网离线时回退缓存
  if (isCodeOrDoc) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, copy.clone());
              cache.put(cleanUrl, copy);
            });
          }
          return networkRes;
        })
        .catch(async () => {
          const cached =
            (await caches.match(req)) ||
            (await caches.match(cleanUrl)) ||
            (req.mode === 'navigate' ? (await caches.match('./index.html')) || (await caches.match('./')) : null);
          return cached || Response.error();
        })
    );
    return;
  }

  // 4. 图标等纯静态图片采用 Cache-First + 后台更新
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = (await cache.match(req)) || (await cache.match(cleanUrl));
      const networkPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            cache.put(req, networkRes.clone());
            cache.put(cleanUrl, networkRes.clone());
          }
          return networkRes;
        })
        .catch(() => null);

      return cached || (await networkPromise) || Response.error();
    })
  );
});
