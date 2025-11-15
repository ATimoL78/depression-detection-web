/**
 * 卡尔曼滤波器 - 用于平滑面部关键点轨迹
 * 减少检测抖动,提升跟踪稳定性
 */

export class KalmanFilter {
  private state: number[];
  private covariance: number[][];
  private processNoise: number;
  private measurementNoise: number;
  private dimension: number;

  constructor(dimension: number = 3, processNoise: number = 0.01, measurementNoise: number = 0.1) {
    this.dimension = dimension;
    this.state = new Array(dimension).fill(0);
    this.covariance = this.createIdentityMatrix(dimension);
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  private createIdentityMatrix(size: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < size; i++) {
      matrix[i] = new Array(size).fill(0);
      matrix[i][i] = 1;
    }
    return matrix;
  }

  /**
   * 预测下一状态
   */
  predict(): void {
    // 状态预测: state = state (匀速模型,假设状态不变)
    // 协方差预测: covariance += processNoise * I
    for (let i = 0; i < this.dimension; i++) {
      this.covariance[i][i] += this.processNoise;
    }
  }

  /**
   * 更新状态
   * @param measurement 测量值 [x, y, z]
   * @returns 滤波后的状态
   */
  update(measurement: number[]): number[] {
    if (measurement.length !== this.dimension) {
      throw new Error(`Measurement dimension mismatch: expected ${this.dimension}, got ${measurement.length}`);
    }

    // 计算卡尔曼增益
    const kalmanGain: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      kalmanGain[i] = this.covariance[i][i] / (this.covariance[i][i] + this.measurementNoise);
    }

    // 更新状态
    for (let i = 0; i < this.dimension; i++) {
      this.state[i] = this.state[i] + kalmanGain[i] * (measurement[i] - this.state[i]);
    }

    // 更新协方差
    for (let i = 0; i < this.dimension; i++) {
      this.covariance[i][i] = (1 - kalmanGain[i]) * this.covariance[i][i];
    }

    return [...this.state];
  }

  /**
   * 预测并更新
   * @param measurement 测量值
   * @returns 滤波后的状态
   */
  filter(measurement: number[]): number[] {
    this.predict();
    return this.update(measurement);
  }

  /**
   * 重置滤波器
   */
  reset(): void {
    this.state = new Array(this.dimension).fill(0);
    this.covariance = this.createIdentityMatrix(this.dimension);
  }

  /**
   * 获取当前状态
   */
  getState(): number[] {
    return [...this.state];
  }
}

/**
 * 多点卡尔曼滤波器管理器
 * 为多个关键点管理独立的卡尔曼滤波器
 */
export class MultiPointKalmanFilter {
  private filters: KalmanFilter[];
  private numPoints: number;

  constructor(numPoints: number, processNoise: number = 0.01, measurementNoise: number = 0.1) {
    this.numPoints = numPoints;
    this.filters = Array(numPoints).fill(null).map(() => 
      new KalmanFilter(3, processNoise, measurementNoise)
    );
  }

  /**
   * 平滑所有关键点
   * @param landmarks 原始关键点数组 [{x, y, z}, ...]
   * @returns 平滑后的关键点数组
   */
  smoothLandmarks<T extends { x: number; y: number; z?: number }>(landmarks: T[]): T[] {
    if (landmarks.length !== this.numPoints) {
      console.warn(`Landmark count mismatch: expected ${this.numPoints}, got ${landmarks.length}`);
      // 如果点数不匹配,重新初始化滤波器
      this.numPoints = landmarks.length;
      this.filters = Array(landmarks.length).fill(null).map(() => 
        new KalmanFilter(3, 0.01, 0.1)
      );
    }

    return landmarks.map((landmark, i) => {
      const z = landmark.z !== undefined ? landmark.z : 0;
      const smoothed = this.filters[i].filter([landmark.x, landmark.y, z]);
      
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
  }
}
