# 抑郁症检测网站性能优化方案

## 📊 项目分析

### 技术栈
- **前端**: React 19 + TypeScript + Vite + TailwindCSS
- **后端**: Express + tRPC + Node.js
- **数据库**: MySQL (Drizzle ORM)
- **AI模型**: MediaPipe FaceMesh (468点) + TensorFlow.js + Python AI模型
- **3D渲染**: Three.js
- **实时通信**: WebSocket (语音分析)

### 现有功能
1. ✅ 468点高精度面部识别
2. ✅ 3D点云可视化
3. ✅ AU动作单元分析(14个AU)
4. ✅ 假表情识别(Duchenne Smile)
5. ✅ 微表情检测
6. ✅ 语音情绪识别
7. ✅ 多模态情绪融合
8. ✅ AI对话助手
9. ✅ 语音访谈
10. ✅ 情绪日记
11. ✅ 趋势分析
12. ✅ 用户认证系统

---

## 🎯 优化目标

### 1. 性能指标
- **首屏加载时间**: < 2秒 (目标)
- **API响应时间**: < 500ms (目标)
- **面部检测帧率**: 30 FPS (稳定)
- **3D渲染帧率**: 60 FPS (流畅)
- **AI模型加载**: < 3秒 (目标)

### 2. 用户体验
- ✅ 实时显示当前心情状态(新增需求)
- ✅ 流畅的动画和过渡效果
- ✅ 快速的页面切换
- ✅ 即时的反馈提示

---

## 🚀 优化策略

### 阶段1: 前端性能优化

#### 1.1 代码分割和懒加载
```typescript
// 路由级别代码分割
const FaceDetection = lazy(() => import('@/pages/FaceDetection'));
const RealtimeDetection = lazy(() => import('@/pages/RealtimeDetection'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));

// 组件级别懒加载
const Face3DPointCloud468 = lazy(() => import('@/components/Face3DPointCloud468'));
const AIAssistantEnhanced = lazy(() => import('@/components/AIAssistantEnhanced'));
```

#### 1.2 资源优化
- **图片优化**: WebP格式 + 懒加载
- **字体优化**: 字体子集化 + preload
- **CSS优化**: Critical CSS内联 + 异步加载
- **JS优化**: Tree shaking + 代码压缩

#### 1.3 缓存策略
```typescript
// Service Worker缓存
- AI模型文件: 长期缓存(1年)
- 静态资源: 长期缓存(1个月)
- API响应: 短期缓存(5分钟)
- 用户数据: IndexedDB本地存储
```

#### 1.4 Three.js渲染优化
```typescript
// 使用对象池减少GC
// 降低点云渲染频率(30fps)
// 使用LOD(Level of Detail)
// 启用WebGL优化选项
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.powerPreference = "high-performance";
```

---

### 阶段2: 后端性能优化

#### 2.1 API优化
```typescript
// 响应压缩
app.use(compression({ level: 6 }));

// 请求限流
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制100个请求
});

// 并发处理
import cluster from 'cluster';
import os from 'os';
const numCPUs = os.cpus().length;
```

#### 2.2 数据库优化
```sql
-- 添加索引
CREATE INDEX idx_user_id ON detections(user_id);
CREATE INDEX idx_created_at ON detections(created_at);
CREATE INDEX idx_detection_type ON detections(detection_type);

-- 查询优化
SELECT * FROM detections 
WHERE user_id = ? 
  AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY created_at DESC 
LIMIT 10;
```

#### 2.3 缓存层
```typescript
// Redis缓存
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// 缓存用户数据
await redis.setex(`user:${userId}`, 3600, JSON.stringify(userData));

// 缓存检测结果
await redis.setex(`detection:${detectionId}`, 1800, JSON.stringify(result));
```

---

### 阶段3: AI模型优化

#### 3.1 模型加载优化
```typescript
// 预加载关键模型
const preloadModels = async () => {
  const models = [
    '/mediapipe/face_mesh_solution_simd_wasm_bin.wasm',
    '/mediapipe/face_mesh_solution_packed_assets.data'
  ];
  
  await Promise.all(
    models.map(url => fetch(url).then(res => res.arrayBuffer()))
  );
};
```

#### 3.2 推理优化
```typescript
// 使用Web Worker处理AI推理
const aiWorker = new Worker('/workers/ai-inference.worker.js');

// 批量处理
const batchSize = 10;
const results = await processBatch(frames.slice(0, batchSize));
```

#### 3.3 MediaPipe优化
```typescript
faceMesh.setOptions({
  maxNumFaces: 1, // 只检测一张脸
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// 限制处理频率(30fps)
if (timeSinceLastDetection < 33) return;
```

---

### 阶段4: 新功能 - 实时心情显示

#### 4.1 心情状态组件
```typescript
// EmotionDisplay.tsx
interface EmotionDisplayProps {
  emotion: string;
  confidence: number;
  timestamp: number;
}

const EmotionDisplay = ({ emotion, confidence, timestamp }: EmotionDisplayProps) => {
  const emotionEmoji = {
    'happy': '😊',
    'sad': '😢',
    'angry': '😠',
    'fear': '😨',
    'disgust': '🤢',
    'surprise': '😲',
    'neutral': '😐'
  };
  
  return (
    <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-4 text-white">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{emotionEmoji[emotion]}</span>
        <div>
          <div className="text-lg font-bold">{emotion}</div>
          <div className="text-sm text-gray-300">置信度: {confidence}%</div>
        </div>
      </div>
    </div>
  );
};
```

#### 4.2 实时情绪分析
```typescript
// 在Face3DPointCloud468.tsx中添加
const analyzeEmotion = useCallback((landmarks: any[]): EmotionResult => {
  const auValues = calculateAUValues(landmarks);
  
  // 情绪分类规则
  if (auValues.AU6 > 0.6 && auValues.AU12 > 0.6) {
    return { emotion: 'happy', confidence: 85 };
  } else if (auValues.AU1 > 0.5 && auValues.AU4 > 0.5 && auValues.AU15 > 0.5) {
    return { emotion: 'sad', confidence: 80 };
  } else if (auValues.AU4 > 0.6 && auValues.AU7 > 0.5 && auValues.AU23 > 0.5) {
    return { emotion: 'angry', confidence: 75 };
  }
  // ... 其他情绪规则
  
  return { emotion: 'neutral', confidence: 60 };
}, []);

// 在onFaceMeshResults中调用
const emotionResult = analyzeEmotion(landmarks);
setCurrentEmotion(emotionResult);
```

#### 4.3 情绪历史记录
```typescript
// 记录情绪变化历史
const [emotionHistory, setEmotionHistory] = useState<EmotionRecord[]>([]);

useEffect(() => {
  if (currentEmotion) {
    setEmotionHistory(prev => [
      ...prev.slice(-30), // 保留最近30条记录
      {
        emotion: currentEmotion.emotion,
        confidence: currentEmotion.confidence,
        timestamp: Date.now()
      }
    ]);
  }
}, [currentEmotion]);
```

---

### 阶段5: 部署优化

#### 5.1 生产环境配置
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'three-vendor': ['three'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

#### 5.2 CDN配置
```typescript
// 静态资源CDN加速
const CDN_URL = 'https://cdn.example.com';

// 使用CDN加载大文件
<script src={`${CDN_URL}/mediapipe/face_mesh.js`}></script>
```

#### 5.3 监控和日志
```typescript
// 性能监控
import { reportWebVitals } from './reportWebVitals';

reportWebVitals((metric) => {
  console.log(metric);
  // 发送到分析服务
  analytics.track('web-vitals', metric);
});
```

---

## 📈 预期效果

### 性能提升
- 首屏加载时间: 减少 **60%** (5s → 2s)
- API响应时间: 减少 **50%** (1s → 500ms)
- 面部检测帧率: 稳定在 **30 FPS**
- 3D渲染帧率: 稳定在 **60 FPS**
- AI模型加载: 减少 **40%** (5s → 3s)

### 用户体验
- ✅ 实时心情显示(新功能)
- ✅ 流畅的交互体验
- ✅ 快速的页面响应
- ✅ 稳定的系统运行

---

## 🔧 实施计划

1. **第1天**: 前端性能优化(代码分割、懒加载、缓存)
2. **第2天**: 后端性能优化(API优化、数据库索引、Redis缓存)
3. **第3天**: AI模型优化(模型加载、推理优化)
4. **第4天**: 新增实时心情显示功能
5. **第5天**: 本地测试和调优
6. **第6天**: 生产环境部署
7. **第7天**: 监控和优化调整

---

## ✅ 验收标准

- [ ] 首屏加载时间 < 2秒
- [ ] API响应时间 < 500ms
- [ ] 面部检测稳定在30 FPS
- [ ] 3D渲染稳定在60 FPS
- [ ] 实时心情显示功能正常
- [ ] 所有现有功能保持完整
- [ ] 生产环境稳定运行
- [ ] 用户体验流畅无卡顿

