// 童趣数学小王国 - PWA Service Worker (支持离线畅玩 + 自动热更新 + 绕过在线语音动态签名请求)
const CACHE_NAME = 'kid-math-pwa-v20261106-ktest';
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

  // 1. 绝不拦截 /api/tts 在线语音接口（保留动态签名与 CORS 边缘缓存通道）
  if (url.pathname.includes('/api/tts') || url.pathname === '/qr') {
    return;
  }

  // 2. 仅处理同源静态资源请求
  if (url.origin !== self.location.origin) {
    return;
  }

  // 忽略版本号查询参数匹配核心静态文件 (如 css/style.css?v=...)
  const cleanUrl = new URL(url.origin + url.pathname);

  // HTML 页面导航采用 Network-First，断网时回退缓存
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, copy);
              cache.put('./index.html', copy.clone());
            });
          }
          return networkRes;
        })
        .catch(async () => {
          const cached =
            (await caches.match(req)) ||
            (await caches.match(cleanUrl)) ||
            (await caches.match('./index.html')) ||
            (await caches.match('./'));
          return cached || Response.error();
        })
    );
    return;
  }

  // JS / CSS / 图标等静态资源采用 Stale-While-Revalidate + Network 更新
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
