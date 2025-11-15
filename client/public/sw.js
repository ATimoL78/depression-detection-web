// Service Worker for caching static assets and API responses
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `depression-detection-${CACHE_VERSION}`;

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// AI模型文件 - 长期缓存
const AI_MODEL_CACHE = 'ai-models-v1';
const AI_MODEL_URLS = [
  '/mediapipe/face_mesh_solution_simd_wasm_bin.wasm',
  '/mediapipe/face_mesh_solution_packed_assets.data',
  '/mediapipe/face_mesh.binarypb'
];

// 安装Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // 缓存静态资源
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // 缓存AI模型文件
      caches.open(AI_MODEL_CACHE).then((cache) => {
        console.log('[SW] Caching AI model files');
        return cache.addAll(AI_MODEL_URLS);
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// 激活Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本缓存
          if (cacheName !== CACHE_NAME && cacheName !== AI_MODEL_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非GET请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过chrome扩展请求
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // AI模型文件 - Cache First策略
  if (AI_MODEL_URLS.some(modelUrl => url.pathname.includes(modelUrl))) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Serving AI model from cache:', url.pathname);
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            return caches.open(AI_MODEL_CACHE).then((cache) => {
              cache.put(request, response.clone());
              return response;
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 静态资源 - Stale While Revalidate策略
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        });

        // 返回缓存的响应,同时在后台更新
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // API请求 - Network First策略
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/trpc/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 只缓存成功的GET请求
          if (response.ok && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败时返回缓存
          return caches.match(request);
        })
    );
    return;
  }

  // HTML页面 - Network First策略
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 其他请求 - Network Only
  event.respondWith(fetch(request));
});

// 监听消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
        return self.clients.matchAll();
      }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      })
    );
  }
});
