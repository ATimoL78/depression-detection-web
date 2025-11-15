/**
 * AU(Action Unit)面部动作单元计算器
 * 基于68点面部关键点计算AU强度
 * 
 * 关键点索引参考:
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
  AU1: number;  // 内眉上扬 (Inner Brow Raiser)
  AU2: number;  // 外眉上扬 (Outer Brow Raiser)
  AU4: number;  // 眉头紧锁 (Brow Lowerer) - 抑郁症重要指标
  AU6: number;  // 脸颊上提 (Cheek Raiser)
  AU12: number; // 嘴角上扬 (Lip Corner Puller) - 缺失表明缺乏积极情绪
  AU15: number; // 嘴角下垂 (Lip Corner Depressor) - 抑郁症重要指标
  AU25: number; // 嘴唇分开 (Lips Part)
  AU26: number; // 下颌下垂 (Jaw Drop)
}

export class AUCalculator {
  /**
   * 计算所有AU特征
   */
  calculateAUFeatures(landmarks: Landmark[]): AUFeatures {
    if (landmarks.length < 68) {
      console.warn(`Expected 68 landmarks, got ${landmarks.length}`);
      return this.getDefaultAUFeatures();
    }

    return {
      AU1: this.calculateAU1(landmarks),
      AU2: this.calculateAU2(landmarks),
      AU4: this.calculateAU4(landmarks),
      AU6: this.calculateAU6(landmarks),
      AU12: this.calculateAU12(landmarks),
      AU15: this.calculateAU15(landmarks),
      AU25: this.calculateAU25(landmarks),
      AU26: this.calculateAU26(landmarks)
    };
  }

  /**
   * AU1: 内眉上扬
   * 检测眉毛内侧(点19, 24)相对于眉毛基线的上扬程度
   */
  private calculateAU1(landmarks: Landmark[]): number {
    const leftInnerBrow = landmarks[19];  // 左眉内侧
    const rightInnerBrow = landmarks[24]; // 右眉内侧
    const noseBridge = landmarks[27];     // 鼻梁顶部作为参考

    // 计算眉毛内侧到鼻梁的距离
    const leftDistance = this.euclideanDistance(leftInnerBrow, noseBridge);
    const rightDistance = this.euclideanDistance(rightInnerBrow, noseBridge);
    const avgDistance = (leftDistance + rightDistance) / 2;

    // 归一化到0-5范围
    // 距离越大,AU1强度越高
    return this.normalize(avgDistance, 20, 40, 0, 5);
  }

  /**
   * AU2: 外眉上扬
   * 检测眉毛外侧(点17, 26)的上扬程度
   */
  private calculateAU2(landmarks: Landmark[]): number {
    const leftOuterBrow = landmarks[17];  // 左眉外侧
    const rightOuterBrow = landmarks[26]; // 右眉外侧
    const leftEyeOuter = landmarks[36];   // 左眼外侧
    const rightEyeOuter = landmarks[45];  // 右眼外侧

    // 计算眉毛外侧到眼睛外侧的垂直距离
    const leftDistance = Math.abs(leftOuterBrow.y - leftEyeOuter.y);
    const rightDistance = Math.abs(rightOuterBrow.y - rightEyeOuter.y);
    const avgDistance = (leftDistance + rightDistance) / 2;

    return this.normalize(avgDistance, 10, 30, 0, 5);
  }

  /**
   * AU4: 眉头紧锁
   * 检测眉毛向下压的程度,眉毛间距缩小
   */
  private calculateAU4(landmarks: Landmark[]): number {
    const leftInnerBrow = landmarks[21];  // 左眉内端
    const rightInnerBrow = landmarks[22]; // 右眉内端
    const leftEyeInner = landmarks[39];   // 左眼内侧
    const rightEyeInner = landmarks[42];  // 右眼内侧

    // 计算眉毛到眼睛的距离(距离小表示眉头紧锁)
    const leftDistance = Math.abs(leftInnerBrow.y - leftEyeInner.y);
    const rightDistance = Math.abs(rightInnerBrow.y - rightEyeInner.y);
    const avgDistance = (leftDistance + rightDistance) / 2;

    // 距离越小,AU4强度越高(反向归一化)
    return this.normalize(avgDistance, 20, 5, 0, 5);
  }

  /**
   * AU6: 脸颊上提
   * 检测脸颊肌肉上提,通常伴随微笑
   */
  private calculateAU6(landmarks: Landmark[]): number {
    const leftCheek = landmarks[1];   // 左脸颊
    const rightCheek = landmarks[15]; // 右脸颊
    const leftEyeLower = landmarks[41];  // 左眼下方
    const rightEyeLower = landmarks[46]; // 右眼下方

    // 计算脸颊到眼睛下方的距离
    const leftDistance = this.euclideanDistance(leftCheek, leftEyeLower);
    const rightDistance = this.euclideanDistance(rightCheek, rightEyeLower);
    const avgDistance = (leftDistance + rightDistance) / 2;

    // 距离小表示脸颊上提
    return this.normalize(avgDistance, 80, 50, 0, 5);
  }

  /**
   * AU12: 嘴角上扬
   * 微笑的主要指标,抑郁症患者通常缺失
   */
  private calculateAU12(landmarks: Landmark[]): number {
    const leftMouthCorner = landmarks[48];  // 左嘴角
    const rightMouthCorner = landmarks[54]; // 右嘴角
    const upperLipCenter = landmarks[51];   // 上嘴唇中心

    // 计算嘴角相对于上嘴唇中心的上扬程度
    const leftRaise = upperLipCenter.y - leftMouthCorner.y;
    const rightRaise = upperLipCenter.y - rightMouthCorner.y;
    const avgRaise = (leftRaise + rightRaise) / 2;

    // 正值表示嘴角上扬
    return this.normalize(avgRaise, -5, 10, 0, 5);
  }

  /**
   * AU15: 嘴角下垂
   * 抑郁症的重要指标
   */
  private calculateAU15(landmarks: Landmark[]): number {
    const leftMouthCorner = landmarks[48];  // 左嘴角
    const rightMouthCorner = landmarks[54]; // 右嘴角
    const lowerLipCenter = landmarks[57];   // 下嘴唇中心

    // 计算嘴角相对于下嘴唇中心的下垂程度
    const leftDrop = leftMouthCorner.y - lowerLipCenter.y;
    const rightDrop = rightMouthCorner.y - lowerLipCenter.y;
    const avgDrop = (leftDrop + rightDrop) / 2;

    // 正值表示嘴角下垂
    return this.normalize(avgDrop, -5, 10, 0, 5);
  }

  /**
   * AU25: 嘴唇分开
   */
  private calculateAU25(landmarks: Landmark[]): number {
    const upperLipTop = landmarks[51];    // 上嘴唇顶部
    const lowerLipBottom = landmarks[57]; // 下嘴唇底部

    // 计算上下嘴唇的距离
    const lipDistance = Math.abs(upperLipTop.y - lowerLipBottom.y);

    return this.normalize(lipDistance, 0, 20, 0, 5);
  }

  /**
   * AU26: 下颌下垂
   */
  private calculateAU26(landmarks: Landmark[]): number {
    const chin = landmarks[8];            // 下巴
    const lowerLipBottom = landmarks[57]; // 下嘴唇底部

    // 计算下巴到下嘴唇的距离
    const jawDrop = Math.abs(chin.y - lowerLipBottom.y);

    return this.normalize(jawDrop, 10, 30, 0, 5);
  }

  /**
   * 计算两点间的欧几里得距离
   */
  private euclideanDistance(p1: Landmark, p2: Landmark): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 归一化值到目标范围
   * @param value 原始值
   * @param inMin 输入最小值
   * @param inMax 输入最大值
   * @param outMin 输出最小值
   * @param outMax 输出最大值
   */
  private normalize(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
  ): number {
    // 限制在输入范围内
    const clampedValue = Math.max(inMin, Math.min(inMax, value));
    
    // 线性映射到输出范围
    const normalized = ((clampedValue - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    
    // 限制在输出范围内
    return Math.max(outMin, Math.min(outMax, normalized));
  }

  /**
   * 获取默认AU特征(全0)
   */
  private getDefaultAUFeatures(): AUFeatures {
    return {
      AU1: 0,
      AU2: 0,
      AU4: 0,
      AU6: 0,
      AU12: 0,
      AU15: 0,
      AU25: 0,
      AU26: 0
    };
  }

  /**
   * 检测抑郁症相关AU模式
   * 返回抑郁症风险评分(0-100)
   */
  detectDepressionPattern(auFeatures: AUFeatures): number {
    let riskScore = 0;

    // AU4高(眉头紧锁) - 增加风险
    if (auFeatures.AU4 > 3) {
      riskScore += 20;
    }

    // AU12低(缺乏微笑) - 增加风险
    if (auFeatures.AU12 < 1) {
      riskScore += 25;
    }

    // AU15高(嘴角下垂) - 增加风险
    if (auFeatures.AU15 > 3) {
      riskScore += 25;
    }

    // AU6低(脸颊不上提) - 增加风险
    if (auFeatures.AU6 < 1) {
      riskScore += 15;
    }

    // AU1和AU2都低(眉毛缺乏表情) - 增加风险
    if (auFeatures.AU1 < 1 && auFeatures.AU2 < 1) {
      riskScore += 15;
    }

    return Math.min(100, riskScore);
  }

  /**
   * 获取AU特征的文字描述
   */
  getAUDescription(au: keyof AUFeatures): string {
    const descriptions: Record<keyof AUFeatures, string> = {
      AU1: '内眉上扬',
      AU2: '外眉上扬',
      AU4: '眉头紧锁',
      AU6: '脸颊上提',
      AU12: '嘴角上扬',
      AU15: '嘴角下垂',
      AU25: '嘴唇分开',
      AU26: '下颌下垂'
    };
    return descriptions[au];
  }
}
