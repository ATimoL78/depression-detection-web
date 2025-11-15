/**
 * 实时情绪分析API - 2025
 * 支持多模态情绪融合(面部+语音)
 */

import { Router } from "express";
import OpenAI from "openai";

const router = Router();

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * 实时多模态情绪分析
 * POST /api/analyze-realtime-emotion
 */
router.post("/analyze-realtime-emotion", async (req, res) => {
  try {
    const { 
      facialEmotion,
      facialConfidence,
      auFeatures,
      fakeSmileAnalysis,
      voiceEmotion,
      voiceConfidence,
      voiceFeatures,
      timestamp 
    } = req.body;

    if (!facialEmotion) {
      return res.status(400).json({ error: "缺少面部情绪数据" });
    }

    // 多模态融合分析
    const fusedAnalysis = performMultimodalFusion({
      facialEmotion,
      facialConfidence,
      auFeatures,
      fakeSmileAnalysis,
      voiceEmotion,
      voiceConfidence,
      voiceFeatures
    });

    // 抑郁症风险评估
    const depressionRisk = calculateDepressionRisk(auFeatures, fusedAnalysis);

    // 假表情检测
    const deceptionAnalysis = analyzeFakeExpression(fakeSmileAnalysis, fusedAnalysis);

    // 生成个性化建议
    const suggestions = generateSuggestions(fusedAnalysis, depressionRisk, deceptionAnalysis);

    res.json({
      timestamp: timestamp || Date.now(),
      fusedEmotion: fusedAnalysis.emotion,
      confidence: fusedAnalysis.confidence,
      source: fusedAnalysis.source,
      depressionRisk,
      deceptionAnalysis,
      suggestions,
      details: {
        facial: {
          emotion: facialEmotion,
          confidence: facialConfidence,
          auFeatures
        },
        voice: voiceEmotion ? {
          emotion: voiceEmotion,
          confidence: voiceConfidence,
          features: voiceFeatures
        } : null,
        fakeSmile: fakeSmileAnalysis
      }
    });

  } catch (error: any) {
    console.error("Realtime emotion analysis error:", error);
    res.status(500).json({ 
      error: "情绪分析失败",
      message: error.message 
    });
  }
});

/**
 * 多模态情绪融合
 */
function performMultimodalFusion(data: any) {
  const { 
    facialEmotion, 
    facialConfidence, 
    voiceEmotion, 
    voiceConfidence 
  } = data;

  // 如果没有语音数据,仅使用面部
  if (!voiceEmotion) {
    return {
      emotion: facialEmotion,
      confidence: facialConfidence,
      source: 'facial-only'
    };
  }

  const facialWeight = 0.6;
  const voiceWeight = 0.4;

  // 如果两个模态一致,提高置信度
  if (facialEmotion === voiceEmotion) {
    return {
      emotion: facialEmotion,
      confidence: Math.min(0.95, facialConfidence * 0.5 + voiceConfidence * 0.5 + 0.2),
      source: 'multimodal-consistent',
      consistency: 'high'
    };
  }

  // 如果不一致,选择置信度更高的
  const facialScore = facialConfidence * facialWeight;
  const voiceScore = voiceConfidence * voiceWeight;

  if (facialScore > voiceScore) {
    return {
      emotion: facialEmotion,
      confidence: facialConfidence * 0.85, // 降低置信度(因为不一致)
      source: 'multimodal-facial-dominant',
      consistency: 'low',
      conflict: {
        facialEmotion,
        voiceEmotion,
        reason: '面部和语音情绪不一致,可能存在情绪压抑或伪装'
      }
    };
  } else {
    return {
      emotion: voiceEmotion,
      confidence: voiceConfidence * 0.85,
      source: 'multimodal-voice-dominant',
      consistency: 'low',
      conflict: {
        facialEmotion,
        voiceEmotion,
        reason: '面部和语音情绪不一致,可能存在情绪压抑或伪装'
      }
    };
  }
}

/**
 * 计算抑郁症风险评分
 */
function calculateDepressionRisk(auFeatures: any, fusedAnalysis: any): number {
  if (!auFeatures) return 0;

  let risk = 0;

  // AU4(眉头紧锁) - 抑郁症重要指标
  if (auFeatures.AU4 > 3) {
    risk += 20;
  } else if (auFeatures.AU4 > 2) {
    risk += 10;
  }

  // AU12(嘴角上扬)缺失 - 缺乏积极情绪
  if (auFeatures.AU12 < 1) {
    risk += 25;
  } else if (auFeatures.AU12 < 2) {
    risk += 15;
  }

  // AU15(嘴角下垂) - 抑郁症重要指标
  if (auFeatures.AU15 > 3) {
    risk += 25;
  } else if (auFeatures.AU15 > 2) {
    risk += 15;
  }

  // AU6(脸颊上提)缺失 - 缺乏真实微笑
  if (auFeatures.AU6 < 1) {
    risk += 15;
  }

  // AU1和AU2(眉毛表情)缺失 - 面部表情平淡
  if (auFeatures.AU1 < 1 && auFeatures.AU2 < 1) {
    risk += 15;
  }

  // 负面情绪持续
  if (fusedAnalysis.emotion === 'sad') {
    risk += 20;
  } else if (fusedAnalysis.emotion === 'angry') {
    risk += 10;
  } else if (fusedAnalysis.emotion === 'fearful') {
    risk += 15;
  }

  return Math.min(100, risk);
}

/**
 * 分析假表情
 */
function analyzeFakeExpression(fakeSmileAnalysis: any, fusedAnalysis: any) {
  if (!fakeSmileAnalysis) {
    return {
      detected: false,
      type: null,
      confidence: 0,
      reason: '未检测到笑容'
    };
  }

  // 假笑检测
  if (!fakeSmileAnalysis.isGenuine && fusedAnalysis.emotion === 'happy') {
    return {
      detected: true,
      type: 'fake-smile',
      confidence: fakeSmileAnalysis.confidence,
      isDuchenne: fakeSmileAnalysis.isDuchenne,
      au6_au12_ratio: fakeSmileAnalysis.au6_au12_ratio,
      asymmetry: fakeSmileAnalysis.asymmetry,
      reason: fakeSmileAnalysis.reason,
      interpretation: '检测到假笑,可能在隐藏真实情绪或社交礼貌性微笑'
    };
  }

  // 情绪不一致
  if (fusedAnalysis.conflict) {
    return {
      detected: true,
      type: 'emotion-inconsistency',
      confidence: 0.7,
      facialEmotion: fusedAnalysis.conflict.facialEmotion,
      voiceEmotion: fusedAnalysis.conflict.voiceEmotion,
      reason: fusedAnalysis.conflict.reason,
      interpretation: '面部和语音情绪不一致,可能存在情绪压抑、伪装或复杂情绪状态'
    };
  }

  return {
    detected: false,
    type: null,
    confidence: 0,
    reason: '未检测到假表情'
  };
}

/**
 * 生成个性化建议
 */
function generateSuggestions(fusedAnalysis: any, depressionRisk: number, deceptionAnalysis: any): string[] {
  const suggestions: string[] = [];

  // 抑郁症风险建议
  if (depressionRisk > 70) {
    suggestions.push('⚠️ 检测到较高的抑郁症风险,强烈建议咨询专业心理医生');
    suggestions.push('24小时心理援助热线: 400-161-9995');
  } else if (depressionRisk > 50) {
    suggestions.push('检测到一定的情绪困扰,建议与心理咨询师交流');
  } else if (depressionRisk > 30) {
    suggestions.push('注意情绪健康,可以尝试正念冥想、运动等缓解压力');
  }

  // 假表情建议
  if (deceptionAnalysis.detected) {
    if (deceptionAnalysis.type === 'fake-smile') {
      suggestions.push('注意到您可能在隐藏真实情绪,允许自己真实地表达感受很重要');
    } else if (deceptionAnalysis.type === 'emotion-inconsistency') {
      suggestions.push('您的面部和语音表达有所不同,可能需要更多时间理解和表达真实感受');
    }
  }

  // 情绪特定建议
  if (fusedAnalysis.emotion === 'sad') {
    suggestions.push('感到悲伤是正常的,可以尝试与信任的人倾诉或写日记');
  } else if (fusedAnalysis.emotion === 'angry') {
    suggestions.push('愤怒情绪需要健康的出口,可以尝试运动、深呼吸或表达性写作');
  } else if (fusedAnalysis.emotion === 'fearful') {
    suggestions.push('焦虑和恐惧可以通过正念练习、渐进式肌肉放松等方法缓解');
  } else if (fusedAnalysis.emotion === 'happy') {
    suggestions.push('保持积极情绪,继续做让您感到快乐的事情');
  }

  return suggestions;
}

/**
 * 批量情绪分析(用于趋势分析)
 * POST /api/analyze-emotion-trend
 */
router.post("/analyze-emotion-trend", async (req, res) => {
  try {
    const { emotionHistory, timeRange } = req.body;

    if (!emotionHistory || !Array.isArray(emotionHistory)) {
      return res.status(400).json({ error: "缺少情绪历史数据" });
    }

    // 计算情绪趋势
    const trend = analyzeEmotionTrend(emotionHistory, timeRange);

    res.json(trend);

  } catch (error: any) {
    console.error("Emotion trend analysis error:", error);
    res.status(500).json({ 
      error: "趋势分析失败",
      message: error.message 
    });
  }
});

/**
 * 分析情绪趋势
 */
function analyzeEmotionTrend(history: any[], timeRange: string) {
  // 统计各种情绪的频率
  const emotionCounts: Record<string, number> = {};
  let totalDepressionRisk = 0;
  let fakeSmileCount = 0;

  history.forEach(record => {
    const emotion = record.fusedEmotion || record.emotion;
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    totalDepressionRisk += record.depressionRisk || 0;
    if (record.deceptionAnalysis?.detected) {
      fakeSmileCount++;
    }
  });

  const avgDepressionRisk = history.length > 0 ? totalDepressionRisk / history.length : 0;
  const fakeSmileRate = history.length > 0 ? fakeSmileCount / history.length : 0;

  // 判断趋势
  let trend = 'stable';
  if (history.length >= 5) {
    const recent = history.slice(-5);
    const earlier = history.slice(0, 5);
    
    const recentRisk = recent.reduce((sum, r) => sum + (r.depressionRisk || 0), 0) / recent.length;
    const earlierRisk = earlier.reduce((sum, r) => sum + (r.depressionRisk || 0), 0) / earlier.length;
    
    if (recentRisk - earlierRisk > 15) {
      trend = 'worsening';
    } else if (earlierRisk - recentRisk > 15) {
      trend = 'improving';
    }
  }

  return {
    timeRange,
    recordCount: history.length,
    emotionDistribution: emotionCounts,
    avgDepressionRisk,
    fakeSmileRate,
    trend,
    insights: generateTrendInsights(emotionCounts, avgDepressionRisk, fakeSmileRate, trend)
  };
}

/**
 * 生成趋势洞察
 */
function generateTrendInsights(
  emotionCounts: Record<string, number>,
  avgRisk: number,
  fakeSmileRate: number,
  trend: string
): string[] {
  const insights: string[] = [];

  // 趋势洞察
  if (trend === 'worsening') {
    insights.push('⚠️ 情绪状态呈下降趋势,建议尽快寻求专业帮助');
  } else if (trend === 'improving') {
    insights.push('✅ 情绪状态呈改善趋势,继续保持积极的生活方式');
  }

  // 风险洞察
  if (avgRisk > 60) {
    insights.push('平均抑郁症风险较高,强烈建议咨询心理医生');
  } else if (avgRisk > 40) {
    insights.push('存在一定的情绪困扰,建议关注心理健康');
  }

  // 假笑洞察
  if (fakeSmileRate > 0.5) {
    insights.push('频繁检测到假笑,可能在压抑真实情绪,建议找到安全的情绪表达方式');
  }

  // 情绪分布洞察
  const dominantEmotion = Object.entries(emotionCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  if (dominantEmotion === 'sad') {
    insights.push('悲伤情绪占主导,建议增加社交活动和愉快体验');
  } else if (dominantEmotion === 'angry') {
    insights.push('愤怒情绪较多,建议学习情绪管理技巧');
  }

  return insights;
}

export default router;
