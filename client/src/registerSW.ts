// Register Service Worker for caching and offline support

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered successfully:', registration.scope);

          // 检查更新
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // 新版本可用
                  console.log('🔄 New version available! Please refresh.');
                  
                  // 可以在这里显示更新提示
                  if (confirm('发现新版本,是否立即更新?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });

      // 监听Service Worker控制器变化
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker controller changed, reloading page...');
        window.location.reload();
      });
    });
  }
}

// 清除所有缓存
export function clearAllCaches() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_CACHE' });
  }
}

// 预加载关键资源
export function preloadCriticalResources() {
  const criticalResources = [
    '/mediapipe/face_mesh_solution_simd_wasm_bin.wasm',
    '/mediapipe/face_mesh_solution_packed_assets.data'
  ];

  criticalResources.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}
