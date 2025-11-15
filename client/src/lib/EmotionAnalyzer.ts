/**
 * 情绪分析器 - 基于AU动作单元的情绪识别
 * 支持7种基本情绪 + 假笑检测
 */

export interface AUValues {
  AU1?: number;  // 眉毛内侧上扬
  AU2?: number;  // 眉毛外侧上扬
  AU4?: number;  // 眉毛皱起
  AU5?: number;  // 上眼睑提升
  AU6?: number;  // 脸颊提升(眼轮匝肌)
  AU7?: number;  // 眼睑紧绷
  AU9?: number;  // 鼻子皱起
  AU10?: number; // 上唇上提
  AU12?: number; // 嘴角上扬
  AU15?: number; // 嘴角下压
  AU17?: number; // 下巴上提
  AU20?: number; // 嘴唇拉伸
  AU23?: number; // 嘴唇紧绷
  AU25?: number; // 嘴唇分开
  AU26?: number; // 下颌下降
  AU27?: number; // 嘴巴张开
  [key: string]: number | undefined;
}

export interface EmotionResult {
  emotion: string;
  confidence: number;
  auValues: AUValues;
  isGenuine?: boolean;
  isDuchenne?: boolean;
  description?: string;
}

/**
 * 从468个面部关键点计算AU值
 */
export function calculateAUValues(landmarks: any[]): AUValues {
  if (landmarks.length < 468) {
    return {};
  }

  const auValues: AUValues = {};

  try {
    // AU1: 眉毛内侧上扬 (Inner Brow Raiser)
    const leftInnerBrow = landmarks[70];
    const rightInnerBrow = landmarks[300];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const leftBrowRaise = Math.max(0, (leftEye.y - leftInnerBrow.y) * 20);
    const rightBrowRaise = Math.max(0, (rightEye.y - rightInnerBrow.y) * 20);
    auValues.AU1 = Math.min(1, (leftBrowRaise + rightBrowRaise) / 2);

    // AU2: 眉毛外侧上扬 (Outer Brow Raiser)
    const leftOuterBrow = landmarks[46];
    const rightOuterBrow = landmarks[276];
    const leftOuterRaise = Math.max(0, (leftEye.y - leftOuterBrow.y) * 20);
    const rightOuterRaise = Math.max(0, (rightEye.y - rightOuterBrow.y) * 20);
    auValues.AU2 = Math.min(1, (leftOuterRaise + rightOuterRaise) / 2);

    // AU4: 眉毛皱起 (Brow Lowerer)
    const browDistance = Math.abs(leftInnerBrow.y - rightInnerBrow.y);
    auValues.AU4 = Math.min(1, browDistance * 30);

    // AU5: 上眼睑提升 (Upper Lid Raiser)
    const leftEyeTop = landmarks[159];
    const leftEyeBottom = landmarks[145];
    const rightEyeTop = landmarks[386];
    const rightEyeBottom = landmarks[374];
    const leftEyeOpenness = Math.abs(leftEyeTop.y - leftEyeBottom.y);
    const rightEyeOpenness = Math.abs(rightEyeTop.y - rightEyeBottom.y);
    auValues.AU5 = Math.min(1, (leftEyeOpenness + rightEyeOpenness) * 15);

    // AU6: 脸颊提升 (Cheek Raiser) - Duchenne微笑的关键
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const noseTip = landmarks[1];
    const leftCheekRaise = Math.max(0, (noseTip.y - leftCheek.y) * 10);
    const rightCheekRaise = Math.max(0, (noseTip.y - rightCheek.y) * 10);
    auValues.AU6 = Math.min(1, (leftCheekRaise + rightCheekRaise) / 2);

    // AU7: 眼睑紧绷 (Lid Tightener)
    const eyeTightness = 1 - auValues.AU5;
    auValues.AU7 = Math.min(1, eyeTightness);

    // AU9: 鼻子皱起 (Nose Wrinkler)
    const noseBase = landmarks[168];
    const noseWrinkle = Math.abs(noseBase.y - noseTip.y);
    auValues.AU9 = Math.min(1, noseWrinkle * 25);

    // AU10: 上唇上提 (Upper Lip Raiser)
    const upperLip = landmarks[13];
    const upperLipRaise = Math.max(0, (noseTip.y - upperLip.y) * 20);
    auValues.AU10 = Math.min(1, upperLipRaise);

    // AU12: 嘴角上扬 (Lip Corner Puller) - 微笑的关键
    const leftMouthCorner = landmarks[61];
    const rightMouthCorner = landmarks[291];
    const mouthCenter = landmarks[13];
    const leftSmile = Math.max(0, (mouthCenter.y - leftMouthCorner.y) * 15);
    const rightSmile = Math.max(0, (mouthCenter.y - rightMouthCorner.y) * 15);
    auValues.AU12 = Math.min(1, (leftSmile + rightSmile) / 2);

    // AU15: 嘴角下压 (Lip Corner Depressor) - 悲伤的关键
    const mouthDroop = Math.max(0, ((leftMouthCorner.y + rightMouthCorner.y) / 2 - noseTip.y) * 15);
    auValues.AU15 = Math.min(1, mouthDroop);

    // AU17: 下巴上提 (Chin Raiser)
    const chin = landmarks[152];
    const chinRaise = Math.max(0, (mouthCenter.y - chin.y) * 20);
    auValues.AU17 = Math.min(1, chinRaise);

    // AU20: 嘴唇拉伸 (Lip Stretcher)
    const mouthWidth = Math.abs(leftMouthCorner.x - rightMouthCorner.x);
    auValues.AU20 = Math.min(1, mouthWidth * 3);

    // AU23: 嘴唇紧绷 (Lip Tightener)
    const upperLipTop = landmarks[0];
    const lowerLipBottom = landmarks[17];
    const lipTightness = 1 - Math.abs(upperLipTop.y - lowerLipBottom.y) * 30;
    auValues.AU23 = Math.max(0, Math.min(1, lipTightness));

    // AU25: 嘴唇分开 (Lips Part)
    const lipPart = Math.abs(upperLipTop.y - lowerLipBottom.y);
    auValues.AU25 = Math.min(1, lipPart * 30);

    // AU26: 下颌下降 (Jaw Drop)
    const jawDrop = Math.abs(chin.y - mouthCenter.y);
    auValues.AU26 = Math.min(1, jawDrop * 15);

    // AU27: 嘴巴张开 (Mouth Stretch)
    const mouthStretch = auValues.AU25 * auValues.AU26;
    auValues.AU27 = Math.min(1, mouthStretch);

  } catch (error) {
    console.error('AU calculation error:', error);
  }

  return auValues;
}

/**
 * 检测Duchenne微笑(真笑)
 */
export function detectDuchenneSmile(auValues: AUValues): {
  isDuchenne: boolean;
  isGenuine: boolean;
  confidence: number;
  reason: string;
} {
  const au6 = auValues.AU6 || 0;
  const au12 = auValues.AU12 || 0;
  
  // Duchenne微笑需要AU6(眼轮匝肌) + AU12(嘴角上扬)
  const isDuchenne = au6 > 0.5 && au12 > 0.5;
  
  // 计算AU6/AU12比值
  const ratio = au12 > 0 ? au6 / au12 : 0;
  
  // 真笑的AU6/AU12比值通常 > 0.6
  const isGenuine = ratio > 0.6 && isDuchenne;
  
  // 置信度
  const confidence = Math.min(100, (au6 + au12) * 50);
  
  let reason = '';
  if (isDuchenne && isGenuine) {
    reason = '真实的Duchenne微笑,眼部和嘴部肌肉同时激活';
  } else if (au12 > 0.5 && au6 < 0.3) {
    reason = '可能是假笑,只有嘴角上扬,眼部肌肉未激活';
  } else if (!isDuchenne) {
    reason = '未检测到明显的微笑';
  }
  
  return { isDuchenne, isGenuine, confidence, reason };
}

/**
 * 基于AU值识别情绪
 */
export function recognizeEmotion(auValues: AUValues): EmotionResult {
  const au1 = auValues.AU1 || 0;
  const au2 = auValues.AU2 || 0;
  const au4 = auValues.AU4 || 0;
  const au5 = auValues.AU5 || 0;
  const au6 = auValues.AU6 || 0;
  const au7 = auValues.AU7 || 0;
  const au9 = auValues.AU9 || 0;
  const au10 = auValues.AU10 || 0;
  const au12 = auValues.AU12 || 0;
  const au15 = auValues.AU15 || 0;
  const au20 = auValues.AU20 || 0;
  const au23 = auValues.AU23 || 0;
  const au25 = auValues.AU25 || 0;
  const au26 = auValues.AU26 || 0;

  // 情绪得分
  const scores = {
    happy: 0,
    sad: 0,
    angry: 0,
    fear: 0,
    disgust: 0,
    surprise: 0,
    neutral: 0
  };

  // 快乐 (Happy): AU6 + AU12
  if (au6 > 0.4 && au12 > 0.4) {
    scores.happy = (au6 + au12) * 50;
    
    // 检测是否为假笑
    const duchenne = detectDuchenneSmile(auValues);
    if (!duchenne.isGenuine && au12 > 0.5) {
      return {
        emotion: 'fake_smile',
        confidence: Math.min(100, scores.happy * 0.8),
        auValues,
        isGenuine: false,
        isDuchenne: false,
        description: duchenne.reason
      };
    }
  }

  // 悲伤 (Sad): AU1 + AU4 + AU15
  if (au1 > 0.3 && au4 > 0.3 && au15 > 0.3) {
    scores.sad = (au1 + au4 + au15) * 30;
  }

  // 愤怒 (Angry): AU4 + AU7 + AU23
  if (au4 > 0.4 && au7 > 0.3 && au23 > 0.3) {
    scores.angry = (au4 + au7 + au23) * 30;
  }

  // 恐惧 (Fear): AU1 + AU2 + AU5 + AU20 + AU25
  if (au1 > 0.3 && au2 > 0.3 && au5 > 0.4) {
    scores.fear = (au1 + au2 + au5 + au20 + au25) * 20;
  }

  // 厌恶 (Disgust): AU9 + AU10
  if (au9 > 0.4 || au10 > 0.4) {
    scores.disgust = (au9 + au10) * 40;
  }

  // 惊讶 (Surprise): AU1 + AU2 + AU5 + AU26
  if (au1 > 0.4 && au2 > 0.4 && au5 > 0.5 && au26 > 0.4) {
    scores.surprise = (au1 + au2 + au5 + au26) * 25;
  }

  // 中性 (Neutral): 所有AU值都较低
  const totalActivation = Object.values(auValues).reduce((sum, val) => sum + (val || 0), 0);
  if (totalActivation < 2) {
    scores.neutral = 60;
  }

  // 找出得分最高的情绪
  let maxEmotion = 'neutral';
  let maxScore = scores.neutral;
  
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion;
    }
  }

  // 检查Duchenne微笑(如果是快乐情绪)
  const duchenne = maxEmotion === 'happy' ? detectDuchenneSmile(auValues) : null;

  return {
    emotion: maxEmotion,
    confidence: Math.min(100, maxScore),
    auValues,
    isGenuine: duchenne?.isGenuine,
    isDuchenne: duchenne?.isDuchenne,
    description: duchenne?.reason
  };
}
