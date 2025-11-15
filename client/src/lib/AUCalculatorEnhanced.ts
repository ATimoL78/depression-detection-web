/**
 * 增强版AU(Action Unit)面部动作单元计算器 - 2025
 * 基于68点面部关键点计算AU强度
 * 
 * 新增功能:
 * 1. 更多AU支持(AU7, AU10, AU14, AU17, AU20, AU23)
 * 2. 假表情检测(Duchenne Smile检测)
 * 3. 微表情检测(快速AU变化)
 * 4. 时序分析(AU起始和消退的自然性)
 * 5. 左右不对称性检测
 * 
 * 关键点索引参考(68点):
 * 0-16: 面部轮廓
 * 17-21: 左眉毛
 * 22-26: 右眉毛
 * 27-35: 鼻子
 * 36-41: 左眼
 * 42-47: 右眼
 * 48-59: 外嘴唇
 * 60-67: 内嘴唇
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface AUFeatures {
  // 基础AU
  AU1: number;  // 内眉上扬 (Inner Brow Raiser)
  AU2: number;  // 外眉上扬 (Outer Brow Raiser)
  AU4: number;  // 眉头紧锁 (Brow Lowerer) - 抑郁症重要指标
  AU6: number;  // 脸颊上提 (Cheek Raiser) - Duchenne Smile关键
  AU12: number; // 嘴角上扬 (Lip Corner Puller) - 微笑关键
  AU15: number; // 嘴角下垂 (Lip Corner Depressor) - 抑郁症重要指标
  AU25: number; // 嘴唇分开 (Lips Part)
  AU26: number; // 下颌下垂 (Jaw Drop)
  
  // 新增AU
  AU7: number;  // 眼睑紧绷 (Lid Tightener)
  AU10: number; // 上唇上提 (Upper Lip Raiser) - 厌恶表情
  AU14: number; // 酒窝 (Dimpler)
  AU17: number; // 下巴上抬 (Chin Raiser)
  AU20: number; // 嘴唇拉伸 (Lip Stretcher) - 恐惧表情
  AU23: number; // 嘴唇紧绷 (Lip Tightener) - 愤怒表情
}

export interface FakeSmileAnalysis {
  isDuchenne: boolean;        // 是否为Duchenne微笑
  au6_au12_ratio: number;     // AU6/AU12比值
  isGenuine: boolean;         // 是否为真实笑容
  confidence: number;         // 置信度
  asymmetry: number;          // 左右不对称度
  reason: string;             // 判断原因
}

export interface MicroExpressionDetection {
  detected: boolean;          // 是否检测到微表情
  au: string;                 // 哪个AU发生快速变化
  changeRate: number;         // 变化率
  duration: number;           // 持续时间(毫秒)
}

export class AUCalculatorEnhanced {
  private auHistory: Map<string, number[]> = new Map();
  private historyLength: number = 30; // 保存30帧历史
  private lastTimestamp: number = 0;

  constructor() {
    // 初始化AU历史记录
    const auNames = ['AU1', 'AU2', 'AU4', 'AU6', 'AU7', 'AU10', 'AU12', 'AU14', 'AU15', 'AU17', 'AU20', 'AU23', 'AU25', 'AU26'];
    auNames.forEach(au => {
      this.auHistory.set(au, []);
    });
  }

  /**
   * 计算所有AU特征
   */
  calculateAUFeatures(landmarks: Landmark[], timestamp?: number): AUFeatures {
    if (landmarks.length < 68) {
      console.warn(`Expected 68 landmarks, got ${landmarks.length}`);
      return this.getDefaultAUFeatures();
    }

    const features: AUFeatures = {
      // 基础AU
      AU1: this.calculateAU1(landmarks),
      AU2: this.calculateAU2(landmarks),
      AU4: this.calculateAU4(landmarks),
      AU6: this.calculateAU6(landmarks),
      AU12: this.calculateAU12(landmarks),
      AU15: this.calculateAU15(landmarks),
      AU25: this.calculateAU25(landmarks),
      AU26: this.calculateAU26(landmarks),
      
      // 新增AU
      AU7: this.calculateAU7(landmarks),
      AU10: this.calculateAU10(landmarks),
      AU14: this.calculateAU14(landmarks),
      AU17: this.calculateAU17(landmarks),
      AU20: this.calculateAU20(landmarks),
      AU23: this.calculateAU23(landmarks),
    };

    // 更新历史记录
    if (timestamp) {
      this.updateHistory(features, timestamp);
    }

    return features;
  }

  /**
   * 检测假笑(Duchenne Smile检测)
   */
  detectFakeSmile(landmarks: Landmark[]): FakeSmileAnalysis {
    const features = this.calculateAUFeatures(landmarks);
    
    const au6 = features.AU6;
    const au12 = features.AU12;
    
    // 计算AU6/AU12比值
    const ratio = au12 > 0.5 ? au6 / (au12 + 0.001) : 0;
    
    // Duchenne Smile判断:AU6和AU12都激活,且比值>0.6
    const isDuchenne = au6 > 2.0 && au12 > 2.0 && ratio > 0.6;
    
    // 计算左右不对称性
    const asymmetry = this.calculateSmileAsymmetry(landmarks);
    
    // 综合判断
    let isGenuine = isDuchenne;
    let confidence = 0.5;
    let reason = '';
    
    if (isDuchenne && asymmetry < 0.3) {
      isGenuine = true;
      confidence = 0.9;
      reason = 'Duchenne smile detected with good symmetry';
    } else if (au12 > 2.0 && au6 < 1.0) {
      isGenuine = false;
      confidence = 0.85;
      reason = 'Fake smile: AU12 active but AU6 missing (no eye involvement)';
    } else if (ratio < 0.3 && au12 > 2.0) {
      isGenuine = false;
      confidence = 0.75;
      reason = 'Fake smile: AU6/AU12 ratio too low';
    } else if (asymmetry > 0.5) {
      isGenuine = false;
      confidence = 0.7;
      reason = 'Fake smile: high asymmetry detected';
    } else {
      reason = 'Neutral or ambiguous smile';
    }
    
    return {
      isDuchenne,
      au6_au12_ratio: ratio,
      isGenuine,
      confidence,
      asymmetry,
      reason
    };
  }

  /**
   * 检测微表情(快速AU变化)
   */
  detectMicroExpression(currentTimestamp: number): MicroExpressionDetection | null {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = currentTimestamp;
      return null;
    }

    const duration = currentTimestamp - this.lastTimestamp;
    this.lastTimestamp = currentTimestamp;

    // 微表情持续时间:40-500ms
    if (duration < 40 || duration > 500) {
      return null;
    }

    // 检查各个AU的快速变化
    for (const [auName, history] of this.auHistory.entries()) {
      if (history.length < 2) continue;

      const current = history[history.length - 1];
      const previous = history[history.length - 2];
      const changeRate = Math.abs(current - previous) / (duration / 1000); // 每秒变化率

      // 快速变化阈值:每秒变化>10个单位
      if (changeRate > 10) {
        return {
          detected: true,
          au: auName,
          changeRate,
          duration
        };
      }
    }

    return null;
  }

  /**
   * 计算笑容的左右不对称性
   */
  private calculateSmileAsymmetry(landmarks: Landmark[]): number {
    const leftMouthCorner = landmarks[48];
    const rightMouthCorner = landmarks[54];
    const upperLipCenter = landmarks[51];

    const leftRaise = upperLipCenter.y - leftMouthCorner.y;
    const rightRaise = upperLipCenter.y - rightMouthCorner.y;

    // 计算不对称度(0-1)
    const asymmetry = Math.abs(leftRaise - rightRaise) / (Math.abs(leftRaise) + Math.abs(rightRaise) + 0.001);
    return Math.min(1.0, asymmetry);
  }

  /**
   * 更新AU历史记录
   */
  private updateHistory(features: AUFeatures, timestamp: number): void {
    for (const [auName, value] of Object.entries(features)) {
      const history = this.auHistory.get(auName);
      if (history) {
        history.push(value);
        if (history.length > this.historyLength) {
          history.shift();
        }
      }
    }
  }

  /**
   * 获取AU历史趋势
   */
  getAUTrend(auName: string): 'increasing' | 'decreasing' | 'stable' {
    const history = this.auHistory.get(auName);
    if (!history || history.length < 5) return 'stable';

    const recent = history.slice(-5);
    const avg1 = recent.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const avg2 = recent.slice(-2).reduce((a, b) => a + b, 0) / 2;

    if (avg2 - avg1 > 0.5) return 'increasing';
    if (avg1 - avg2 > 0.5) return 'decreasing';
    return 'stable';
  }

  // ==================== 基础AU计算 ====================

  private calculateAU1(landmarks: Landmark[]): number {
    const leftInnerBrow = landmarks[19];
    const rightInnerBrow = landmarks[24];
    const noseBridge = landmarks[27];

    const leftDistance = this.euclideanDistance(leftInnerBrow, noseBridge);
    const rightDistance = this.euclideanDistance(rightInnerBrow, noseBridge);
    const avgDistance = (leftDistance + rightDistance) / 2;

    return this.normalize(avgDistance, 20, 40, 0, 5);
  }

  private calculateAU2(landmarks: Landmark[]): number {
    const leftOuterBrow = landmarks[17];
    const rightOuterBrow = landmarks[26];
    const leftEyeOuter = landmarks[36];
    const rightEyeOuter = landmarks[45];

    const leftDistance = Math.abs(leftOuterBrow.y - leftEyeOuter.y);
    const rightDistance = Math.abs(rightOuterBrow.y - rightEyeOuter.y);
    const avgDistance = (leftDistance + rightDistance) / 2;

    return this.normalize(avgDistance, 10, 30, 0, 5);
  }

  private calculateAU4(landmarks: Landmark[]): number {
    const leftInnerBrow = landmarks[21];
    const rightInnerBrow = landmarks[22];
    const leftEyeInner = landmarks[39];
    const rightEyeInner = landmarks[42];

    const leftDistance = Math.abs(leftInnerBrow.y - leftEyeInner.y);
    const rightDistance = Math.abs(rightInnerBrow.y - rightEyeInner.y);
    const avgDistance = (leftDistance + rightDistance) / 2;

    return this.normalize(avgDistance, 20, 5, 0, 5);
  }

  private calculateAU6(landmarks: Landmark[]): number {
    // 脸颊上提 - Duchenne Smile的关键
    const leftCheek = landmarks[1];
    const rightCheek = landmarks[15];
    const leftEyeLower = landmarks[41];
    const rightEyeLower = landmarks[46];

    const leftDistance = this.euclideanDistance(leftCheek, leftEyeLower);
    const rightDistance = this.euclideanDistance(rightCheek, rightEyeLower);
    const avgDistance = (leftDistance + rightDistance) / 2;

    return this.normalize(avgDistance, 80, 50, 0, 5);
  }

  private calculateAU12(landmarks: Landmark[]): number {
    const leftMouthCorner = landmarks[48];
    const rightMouthCorner = landmarks[54];
    const upperLipCenter = landmarks[51];

    const leftRaise = upperLipCenter.y - leftMouthCorner.y;
    const rightRaise = upperLipCenter.y - rightMouthCorner.y;
    const avgRaise = (leftRaise + rightRaise) / 2;

    return this.normalize(avgRaise, -5, 10, 0, 5);
  }

  private calculateAU15(landmarks: Landmark[]): number {
    const leftMouthCorner = landmarks[48];
    const rightMouthCorner = landmarks[54];
    const lowerLipCenter = landmarks[57];

    const leftDepress = leftMouthCorner.y - lowerLipCenter.y;
    const rightDepress = rightMouthCorner.y - lowerLipCenter.y;
    const avgDepress = (leftDepress + rightDepress) / 2;

    return this.normalize(avgDepress, -5, 10, 0, 5);
  }

  private calculateAU25(landmarks: Landmark[]): number {
    const upperLip = landmarks[51];
    const lowerLip = landmarks[57];
    const lipDistance = Math.abs(upperLip.y - lowerLip.y);

    return this.normalize(lipDistance, 0, 20, 0, 5);
  }

  private calculateAU26(landmarks: Landmark[]): number {
    const upperLip = landmarks[51];
    const lowerLip = landmarks[57];
    const chin = landmarks[8];

    const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
    const chinDistance = Math.abs(lowerLip.y - chin.y);
    const ratio = mouthHeight / (chinDistance + 0.001);

    return this.normalize(ratio, 0, 0.5, 0, 5);
  }

  // ==================== 新增AU计算 ====================

  private calculateAU7(landmarks: Landmark[]): number {
    // 眼睑紧绷
    const leftEyeUpper = landmarks[37];
    const leftEyeLower = landmarks[41];
    const rightEyeUpper = landmarks[43];
    const rightEyeLower = landmarks[47];

    const leftEyeHeight = Math.abs(leftEyeUpper.y - leftEyeLower.y);
    const rightEyeHeight = Math.abs(rightEyeUpper.y - rightEyeLower.y);
    const avgHeight = (leftEyeHeight + rightEyeHeight) / 2;

    // 眼睛高度小表示眼睑紧绷
    return this.normalize(avgHeight, 10, 2, 0, 5);
  }

  private calculateAU10(landmarks: Landmark[]): number {
    // 上唇上提(厌恶表情)
    const upperLipCenter = landmarks[51];
    const noseBottom = landmarks[33];
    const distance = Math.abs(upperLipCenter.y - noseBottom.y);

    // 距离小表示上唇上提
    return this.normalize(distance, 20, 5, 0, 5);
  }

  private calculateAU14(landmarks: Landmark[]): number {
    // 酒窝(嘴角内收)
    const leftMouthCorner = landmarks[48];
    const rightMouthCorner = landmarks[54];
    const mouthWidth = Math.abs(leftMouthCorner.x - rightMouthCorner.x);
    
    // 嘴宽度减小表示嘴角内收
    return this.normalize(mouthWidth, 80, 60, 0, 5);
  }

  private calculateAU17(landmarks: Landmark[]): number {
    // 下巴上抬
    const chin = landmarks[8];
    const lowerLip = landmarks[57];
    const distance = Math.abs(chin.y - lowerLip.y);

    // 距离小表示下巴上抬
    return this.normalize(distance, 30, 15, 0, 5);
  }

  private calculateAU20(landmarks: Landmark[]): number {
    // 嘴唇拉伸(恐惧表情)
    const leftMouthCorner = landmarks[48];
    const rightMouthCorner = landmarks[54];
    const mouthWidth = Math.abs(leftMouthCorner.x - rightMouthCorner.x);
    
    // 嘴宽度增加表示嘴唇拉伸
    return this.normalize(mouthWidth, 60, 90, 0, 5);
  }

  private calculateAU23(landmarks: Landmark[]): number {
    // 嘴唇紧绷(愤怒表情)
    const upperLip = landmarks[51];
    const lowerLip = landmarks[57];
    const lipDistance = Math.abs(upperLip.y - lowerLip.y);

    // 嘴唇距离小表示嘴唇紧绷
    return this.normalize(lipDistance, 10, 2, 0, 5);
  }

  // ==================== 工具函数 ====================

  private euclideanDistance(p1: Landmark, p2: Landmark): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private normalize(value: number, min: number, max: number, outMin: number, outMax: number): number {
    const clamped = Math.max(min, Math.min(max, value));
    return outMin + ((clamped - min) / (max - min)) * (outMax - outMin);
  }

  private getDefaultAUFeatures(): AUFeatures {
    return {
      AU1: 0, AU2: 0, AU4: 0, AU6: 0, AU7: 0, AU10: 0,
      AU12: 0, AU14: 0, AU15: 0, AU17: 0, AU20: 0, AU23: 0,
      AU25: 0, AU26: 0
    };
  }

  /**
   * 重置历史记录
   */
  reset(): void {
    this.auHistory.forEach(history => history.length = 0);
    this.lastTimestamp = 0;
  }
}
