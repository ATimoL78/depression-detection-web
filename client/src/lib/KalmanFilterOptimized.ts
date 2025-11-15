/**
 * 优化版卡尔曼滤波器 - 2025
 * 用于平滑面部关键点轨迹,减少检测抖动,提升跟踪稳定性
 * 
 * 优化点:
 * 1. 自适应噪声调整
 * 2. 速度预测模型(匀速运动假设)
 * 3. 异常值检测和处理
 * 4. 性能优化(减少内存分配)
 */

export class KalmanFilterOptimized {
  private state: Float32Array; // [x, y, z, vx, vy, vz] - 位置+速度
  private covariance: Float32Array; // 协方差矩阵(6x6)
  private processNoise: number;
  private measurementNoise: number;
  private dimension: number;
  private velocityEnabled: boolean;
  
  // 异常值检测阈值
  private outlierThreshold: number = 50; // 像素
  private lastMeasurement: Float32Array | null = null;

  constructor(
    dimension: number = 3, 
    processNoise: number = 0.01, 
    measurementNoise: number = 0.1,
    velocityEnabled: boolean = true
  ) {
    this.dimension = dimension;
    this.velocityEnabled = velocityEnabled;
    
    // 状态向量: [位置, 速度]
    const stateSize = velocityEnabled ? dimension * 2 : dimension;
    this.state = new Float32Array(stateSize);
    
    // 协方差矩阵(对角矩阵)
    this.covariance = new Float32Array(stateSize);
    for (let i = 0; i < stateSize; i++) {
      this.covariance[i] = 1.0;
    }
    
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  /**
   * 预测下一状态(带速度模型)
   */
  predict(dt: number = 1.0): void {
    if (this.velocityEnabled) {
      // 位置预测: x = x + vx * dt
      for (let i = 0; i < this.dimension; i++) {
        this.state[i] += this.state[i + this.dimension] * dt;
      }
      
      // 速度保持不变(匀速模型)
      // 协方差增加
      for (let i = 0; i < this.dimension * 2; i++) {
        this.covariance[i] += this.processNoise;
      }
    } else {
      // 简单模型:状态保持不变
      for (let i = 0; i < this.dimension; i++) {
        this.covariance[i] += this.processNoise;
      }
    }
  }

  /**
   * 检测异常值
   */
  private isOutlier(measurement: number[]): boolean {
    if (!this.lastMeasurement) return false;
    
    let distance = 0;
    for (let i = 0; i < this.dimension; i++) {
      const diff = measurement[i] - this.lastMeasurement[i];
      distance += diff * diff;
    }
    distance = Math.sqrt(distance);
    
    return distance > this.outlierThreshold;
  }

  /**
   * 更新状态
   * @param measurement 测量值 [x, y, z]
   * @param dt 时间间隔(秒)
   * @returns 滤波后的状态
   */
  update(measurement: number[], dt: number = 1.0): number[] {
    if (measurement.length !== this.dimension) {
      throw new Error(`Measurement dimension mismatch: expected ${this.dimension}, got ${measurement.length}`);
    }

    // 异常值检测
    if (this.isOutlier(measurement)) {
      console.warn('Outlier detected, using prediction only');
      // 仅使用预测值,不更新
      return this.getPosition();
    }

    // 计算卡尔曼增益
    const kalmanGain = new Float32Array(this.dimension);
    for (let i = 0; i < this.dimension; i++) {
      kalmanGain[i] = this.covariance[i] / (this.covariance[i] + this.measurementNoise);
    }

    // 更新位置
    for (let i = 0; i < this.dimension; i++) {
      const innovation = measurement[i] - this.state[i];
      this.state[i] += kalmanGain[i] * innovation;
      
      // 更新速度(如果启用)
      if (this.velocityEnabled && dt > 0) {
        this.state[i + this.dimension] = innovation / dt;
      }
    }

    // 更新协方差
    for (let i = 0; i < this.dimension; i++) {
      this.covariance[i] = (1 - kalmanGain[i]) * this.covariance[i];
    }

    // 保存最后测量值
    if (!this.lastMeasurement) {
      this.lastMeasurement = new Float32Array(this.dimension);
    }
    for (let i = 0; i < this.dimension; i++) {
      this.lastMeasurement[i] = measurement[i];
    }

    return this.getPosition();
  }

  /**
   * 预测并更新
   * @param measurement 测量值
   * @param dt 时间间隔(秒)
   * @returns 滤波后的状态
   */
  filter(measurement: number[], dt: number = 1.0): number[] {
    this.predict(dt);
    return this.update(measurement, dt);
  }

  /**
   * 获取当前位置
   */
  getPosition(): number[] {
    return Array.from(this.state.slice(0, this.dimension));
  }

  /**
   * 获取当前速度
   */
  getVelocity(): number[] {
    if (!this.velocityEnabled) return new Array(this.dimension).fill(0);
    return Array.from(this.state.slice(this.dimension, this.dimension * 2));
  }

  /**
   * 重置滤波器
   */
  reset(): void {
    this.state.fill(0);
    for (let i = 0; i < this.covariance.length; i++) {
      this.covariance[i] = 1.0;
    }
    this.lastMeasurement = null;
  }

  /**
   * 自适应调整噪声参数
   */
  adaptNoise(measurementVariance: number): void {
    // 根据测量方差自适应调整测量噪声
    this.measurementNoise = Math.max(0.01, Math.min(1.0, measurementVariance));
  }
}

/**
 * 多点卡尔曼滤波器管理器(优化版)
 * 为多个关键点管理独立的卡尔曼滤波器
 */
export class MultiPointKalmanFilterOptimized {
  private filters: KalmanFilterOptimized[];
  private numPoints: number;
  private lastTimestamp: number = 0;

  constructor(
    numPoints: number, 
    processNoise: number = 0.01, 
    measurementNoise: number = 0.1,
    velocityEnabled: boolean = true
  ) {
    this.numPoints = numPoints;
    this.filters = Array(numPoints).fill(null).map(() => 
      new KalmanFilterOptimized(3, processNoise, measurementNoise, velocityEnabled)
    );
  }

  /**
   * 平滑所有关键点
   * @param landmarks 原始关键点数组 [{x, y, z}, ...]
   * @param timestamp 当前时间戳(毫秒)
   * @returns 平滑后的关键点数组
   */
  smoothLandmarks<T extends { x: number; y: number; z?: number }>(
    landmarks: T[], 
    timestamp?: number
  ): T[] {
    // 计算时间间隔
    let dt = 1.0;
    if (timestamp && this.lastTimestamp > 0) {
      dt = (timestamp - this.lastTimestamp) / 1000.0; // 转换为秒
      dt = Math.max(0.001, Math.min(1.0, dt)); // 限制范围
    }
    if (timestamp) {
      this.lastTimestamp = timestamp;
    }

    // 如果点数不匹配,重新初始化滤波器
    if (landmarks.length !== this.numPoints) {
      console.warn(`Landmark count mismatch: expected ${this.numPoints}, got ${landmarks.length}`);
      this.numPoints = landmarks.length;
      this.filters = Array(landmarks.length).fill(null).map(() => 
        new KalmanFilterOptimized(3, 0.01, 0.1, true)
      );
    }

    // 并行处理所有关键点(使用map)
    return landmarks.map((landmark, i) => {
      const z = landmark.z !== undefined ? landmark.z : 0;
      const smoothed = this.filters[i].filter([landmark.x, landmark.y, z], dt);
      
      return {
        ...landmark,
        x: smoothed[0],
        y: smoothed[1],
        z: smoothed[2]
      } as T;
    });
  }

  /**
   * 重置所有滤波器
   */
  reset(): void {
    this.filters.forEach(filter => filter.reset());
    this.lastTimestamp = 0;
  }

  /**
   * 获取所有关键点的速度
   */
  getVelocities(): number[][] {
    return this.filters.map(filter => filter.getVelocity());
  }
}
