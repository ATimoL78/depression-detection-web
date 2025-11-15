/**
 * Vite性能优化配置 - 2025
 * 目标: 提升响应速度和加载性能
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // 使用SWC进行更快的编译
      jsxRuntime: 'automatic',
      // 启用Fast Refresh
      fastRefresh: true,
    }),
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },

  // 构建优化
  build: {
    // 目标浏览器
    target: 'es2015',
    
    // 启用CSS代码分割
    cssCodeSplit: true,
    
    // 生成sourcemap用于调试(生产环境可关闭)
    sourcemap: false,
    
    // 块大小警告限制
    chunkSizeWarningLimit: 1000,
    
    // Rollup优化选项
    rollupOptions: {
      output: {
        // 手动代码分割
        manualChunks: {
          // React核心库
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          
          // UI组件库
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-slider',
            '@radix-ui/react-tabs',
          ],
          
          // Three.js 3D库
          'three-vendor': ['three'],
          
          // 面部识别库
          'faceapi-vendor': ['face-api.js'],
          
          // 图表库
          'chart-vendor': ['recharts'],
          
          // 工具库
          'utils-vendor': ['date-fns', 'clsx', 'tailwind-merge'],
        },
        
        // 优化chunk命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    
    // 压缩选项
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // 移除console
        drop_debugger: true, // 移除debugger
        pure_funcs: ['console.log', 'console.info'], // 移除特定函数
      },
    },
  },

  // 服务器配置
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false,
    
    // 预热常用文件
    warmup: {
      clientFiles: [
        './client/src/App.tsx',
        './client/src/pages/Home.tsx',
        './client/src/components/Face3DPointCloudUltra.tsx',
      ],
    },
  },

  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'three',
      'face-api.js',
      'recharts',
    ],
    exclude: [
      // 排除不需要预构建的大型库
    ],
  },

  // 性能优化
  esbuild: {
    // 移除所有debugger和console
    drop: ['console', 'debugger'],
    // 压缩标识符
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
});
