/**
 * AI模型预加载和优化工具
 * 用于提升MediaPipe FaceMesh和其他AI模型的加载速度
 */

export class ModelPreloader {
  private static instance: ModelPreloader;
  private loadedModels: Map<string, any> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();

  private constructor() {}

  static getInstance(): ModelPreloader {
    if (!ModelPreloader.instance) {
      ModelPreloader.instance = new ModelPreloader();
    }
    return ModelPreloader.instance;
  }

  /**
   * 预加载MediaPipe FaceMesh模型文件
   */
  async preloadFaceMeshModel(): Promise<void> {
    const modelKey = 'facemesh';
    
    if (this.loadedModels.has(modelKey)) {
      console.log('✅ FaceMesh model already loaded');
      return;
    }

    if (this.loadingPromises.has(modelKey)) {
      console.log('⏳ FaceMesh model loading in progress...');
      return this.loadingPromises.get(modelKey);
    }

    console.log('🚀 Preloading FaceMesh model files...');
    
    const loadPromise = this.loadModelFiles();
    this.loadingPromises.set(modelKey, loadPromise);

    try {
      await loadPromise;
      this.loadedModels.set(modelKey, true);
      console.log('✅ FaceMesh model preloaded successfully');
    } catch (error) {
      console.error('❌ Failed to preload FaceMesh model:', error);
      this.loadingPromises.delete(modelKey);
      throw error;
    }
  }

  /**
   * 加载模型文件到缓存
   */
  private async loadModelFiles(): Promise<void> {
    const modelFiles = [
      '/mediapipe/face_mesh_solution_simd_wasm_bin.wasm',
      '/mediapipe/face_mesh_solution_packed_assets.data',
      '/mediapipe/face_mesh.binarypb'
    ];

    const loadPromises = modelFiles.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load ${url}: ${response.statusText}`);
        }
        const blob = await response.blob();
        console.log(`✅ Loaded: ${url} (${(blob.size / 1024).toFixed(2)} KB)`);
        return blob;
      } catch (error) {
        console.error(`❌ Error loading ${url}:`, error);
        throw error;
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * 检查模型是否已加载
   */
  isModelLoaded(modelKey: string): boolean {
    return this.loadedModels.has(modelKey);
  }

  /**
   * 清除所有已加载的模型
   */
  clearModels(): void {
    this.loadedModels.clear();
    this.loadingPromises.clear();
    console.log('🗑️ All models cleared from cache');
  }
}

/**
 * 优化MediaPipe FaceMesh配置
 */
export const OPTIMIZED_FACEMESH_CONFIG = {
  maxNumFaces: 1, // 只检测一张脸,提升性能
  refineLandmarks: true, // 启用精细化关键点(468点)
  minDetectionConfidence: 0.5, // 降低检测阈值,提升速度
  minTrackingConfidence: 0.5, // 降低跟踪阈值,提升速度
  selfieMode: true, // 自拍模式(镜像)
};

/**
 * 帧率控制器 - 限制AI推理频率
 */
export class FrameRateController {
  private lastProcessTime: number = 0;
  private targetFPS: number;
  private frameInterval: number;

  constructor(targetFPS: number = 30) {
    this.targetFPS = targetFPS;
    this.frameInterval = 1000 / targetFPS;
  }

  /**
   * 检查是否应该处理当前帧
   */
  shouldProcess(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastProcessTime;

    if (elapsed >= this.frameInterval) {
      this.lastProcessTime = now;
      return true;
    }

    return false;
  }

  /**
   * 设置目标帧率
   */
  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.frameInterval = 1000 / fps;
  }

  /**
   * 获取当前目标帧率
   */
  getTargetFPS(): number {
    return this.targetFPS;
  }

  /**
   * 重置计时器
   */
  reset(): void {
    this.lastProcessTime = 0;
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics: {
    frameProcessTime: number[];
    modelInferenceTime: number[];
    renderTime: number[];
  } = {
    frameProcessTime: [],
    modelInferenceTime: [],
    renderTime: []
  };

  private maxSamples: number = 60; // 保留最近60个样本

  /**
   * 记录帧处理时间
   */
  recordFrameProcessTime(time: number): void {
    this.metrics.frameProcessTime.push(time);
    if (this.metrics.frameProcessTime.length > this.maxSamples) {
      this.metrics.frameProcessTime.shift();
    }
  }

  /**
   * 记录模型推理时间
   */
  recordModelInferenceTime(time: number): void {
    this.metrics.modelInferenceTime.push(time);
    if (this.metrics.modelInferenceTime.length > this.maxSamples) {
      this.metrics.modelInferenceTime.shift();
    }
  }

  /**
   * 记录渲染时间
   */
  recordRenderTime(time: number): void {
    this.metrics.renderTime.push(time);
    if (this.metrics.renderTime.length > this.maxSamples) {
      this.metrics.renderTime.shift();
    }
  }

  /**
   * 获取平均帧处理时间
   */
  getAverageFrameProcessTime(): number {
    if (this.metrics.frameProcessTime.length === 0) return 0;
    const sum = this.metrics.frameProcessTime.reduce((a, b) => a + b, 0);
    return sum / this.metrics.frameProcessTime.length;
  }

  /**
   * 获取平均模型推理时间
   */
  getAverageModelInferenceTime(): number {
    if (this.metrics.modelInferenceTime.length === 0) return 0;
    const sum = this.metrics.modelInferenceTime.reduce((a, b) => a + b, 0);
    return sum / this.metrics.modelInferenceTime.length;
  }

  /**
   * 获取平均渲染时间
   */
  getAverageRenderTime(): number {
    if (this.metrics.renderTime.length === 0) return 0;
    const sum = this.metrics.renderTime.reduce((a, b) => a + b, 0);
    return sum / this.metrics.renderTime.length;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    avgFrameProcessTime: number;
    avgModelInferenceTime: number;
    avgRenderTime: number;
    estimatedFPS: number;
  } {
    const avgFrameTime = this.getAverageFrameProcessTime();
    const estimatedFPS = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;

    return {
      avgFrameProcessTime: avgFrameTime,
      avgModelInferenceTime: this.getAverageModelInferenceTime(),
      avgRenderTime: this.getAverageRenderTime(),
      estimatedFPS: Math.round(estimatedFPS)
    };
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics.frameProcessTime = [];
    this.metrics.modelInferenceTime = [];
    this.metrics.renderTime = [];
  }
}

/**
 * 全局单例实例
 */
export const modelPreloader = ModelPreloader.getInstance();
export const frameRateController = new FrameRateController(30); // 默认30fps
export const performanceMonitor = new PerformanceMonitor();

/**
 * 初始化优化工具
 */
export async function initializeOptimizations(): Promise<void> {
  console.log('🎯 Initializing AI model optimizations...');
  
  try {
    // 预加载FaceMesh模型
    await modelPreloader.preloadFaceMeshModel();
    
    console.log('✅ AI model optimizations initialized');
  } catch (error) {
    console.error('❌ Failed to initialize optimizations:', error);
  }
}
