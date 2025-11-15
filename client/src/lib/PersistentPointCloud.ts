/**
 * 持久化点云管理器
 * 即使短暂检测失败,也能保持点云显示
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface PointCloudState {
  landmarks: Landmark[];
  opacity: number;
  isValid: boolean;
}

export class PersistentPointCloud {
  private lastValidLandmarks: Landmark[] | null = null;
  private confidenceDecay: number;
  private currentConfidence: number;
  private minConfidence: number;
  private framesSinceLastDetection: number;
  private maxFramesWithoutDetection: number;

  constructor(
    confidenceDecay: number = 0.95,
    minConfidence: number = 0.3,
    maxFramesWithoutDetection: number = 30 // 约1秒(30fps)
  ) {
    this.confidenceDecay = confidenceDecay;
    this.minConfidence = minConfidence;
    this.currentConfidence = 1.0;
    this.framesSinceLastDetection = 0;
    this.maxFramesWithoutDetection = maxFramesWithoutDetection;
  }

  /**
   * 更新点云状态
   * @param landmarks 当前帧检测到的关键点,null表示检测失败
   * @returns 应该显示的点云状态
   */
  update(landmarks: Landmark[] | null): PointCloudState | null {
    if (landmarks && landmarks.length > 0) {
      // 检测成功,更新点云
      this.lastValidLandmarks = landmarks;
      this.currentConfidence = 1.0;
      this.framesSinceLastDetection = 0;

      return {
        landmarks: this.lastValidLandmarks,
        opacity: 1.0,
        isValid: true
      };
    } else {
      // 检测失败,降低置信度
      this.framesSinceLastDetection++;
      this.currentConfidence *= this.confidenceDecay;

      // 如果超过最大帧数或置信度过低,停止显示
      if (
        this.framesSinceLastDetection > this.maxFramesWithoutDetection ||
        this.currentConfidence < this.minConfidence
      ) {
        return null;
      }

      // 继续显示上次的点云,但透明度降低
      if (this.lastValidLandmarks) {
        return {
          landmarks: this.lastValidLandmarks,
          opacity: this.currentConfidence,
          isValid: false
        };
      }

      return null;
    }
  }

  /**
   * 获取当前置信度
   */
  getConfidence(): number {
    return this.currentConfidence;
  }

  /**
   * 获取距离上次检测的帧数
   */
  getFramesSinceLastDetection(): number {
    return this.framesSinceLastDetection;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.lastValidLandmarks = null;
    this.currentConfidence = 1.0;
    this.framesSinceLastDetection = 0;
  }

  /**
   * 是否有有效的点云
   */
  hasValidPointCloud(): boolean {
    return this.lastValidLandmarks !== null && this.currentConfidence >= this.minConfidence;
  }
}
