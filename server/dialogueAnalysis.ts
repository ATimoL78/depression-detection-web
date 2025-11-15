/**
 * 对话语义分析模块
 * 使用LLM分析对话内容,识别抑郁倾向
 */

import { invokeLLM } from "./_core/llm";

export interface DialogueAnalysisResult {
  success: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  keywords: string[];
  emotionalTone: string;
  concerns: string[];
  recommendations: string[];
  error?: string;
}

/**
 * 分析对话内容
 * @param content 对话文本内容
 * @returns 分析结果
 */
export async function analyzeDialogue(content: string): Promise<DialogueAnalysisResult> {
  try {
    const systemPrompt = `你是一个专业的心理健康评估助手,擅长通过对话内容分析用户的情绪状态和抑郁倾向。

请分析用户的对话内容,从以下维度进行评估:
1. 情感倾向(positive/neutral/negative)
2. 抑郁风险等级(low/medium/high)
3. 抑郁风险评分(0-100分)
4. 关键词识别(负面情绪词汇、自我否定表述等)
5. 情绪基调描述
6. 主要关注点
7. 建议

评估标准:
- 负面情绪词汇频率(绝望、无助、麻木、痛苦等)
- 自我否定表述(我不行、我很差、没有意义等)
- 消极思维模式(总是、永远、从不等绝对化表述)
- 社交退缩倾向
- 兴趣丧失表现
- 睡眠和精力问题

请以JSON格式返回结果,不要包含任何其他文字。`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请分析以下对话内容:\n\n${content}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "dialogue_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              sentiment: {
                type: "string",
                enum: ["positive", "neutral", "negative"],
                description: "情感倾向"
              },
              riskLevel: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "抑郁风险等级"
              },
              riskScore: {
                type: "integer",
                description: "抑郁风险评分(0-100)"
              },
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "关键负面词汇"
              },
              emotionalTone: {
                type: "string",
                description: "情绪基调描述"
              },
              concerns: {
                type: "array",
                items: { type: "string" },
                description: "主要关注点"
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
                description: "建议"
              }
            },
            required: ["sentiment", "riskLevel", "riskScore", "keywords", "emotionalTone", "concerns", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const contentStr = typeof messageContent === 'string' ? messageContent : '{}';
    const result = JSON.parse(contentStr);

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('Dialogue analysis error:', error);
    return {
      success: false,
      sentiment: 'neutral',
      riskLevel: 'low',
      riskScore: 0,
      keywords: [],
      emotionalTone: '',
      concerns: [],
      recommendations: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 综合评估(面部识别 + 对话分析)
 * @param faceRiskScore 面部识别风险评分(0-100)
 * @param dialogueRiskScore 对话分析风险评分(0-100)
 * @returns 综合风险评估
 */
export function combineAssessment(
  faceRiskScore: number,
  dialogueRiskScore: number
): {
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  confidence: number;
} {
  // 加权融合: 面部40% + 对话60%
  const combinedScore = faceRiskScore * 0.4 + dialogueRiskScore * 0.6;
  
  // 计算置信度(两个评分越接近,置信度越高)
  const scoreDiff = Math.abs(faceRiskScore - dialogueRiskScore);
  const confidence = Math.max(60, 100 - scoreDiff);

  const riskLevel: 'low' | 'medium' | 'high' = 
    combinedScore < 33 ? 'low' : combinedScore < 66 ? 'medium' : 'high';

  return {
    riskLevel,
    riskScore: Math.round(combinedScore),
    confidence: Math.round(confidence),
  };
}

/**
 * 生成评估建议
 */
export async function generateRecommendations(
  riskLevel: 'low' | 'medium' | 'high',
  faceAnalysis: any,
  dialogueAnalysis: any
): Promise<string[]> {
  try {
    const systemPrompt = `你是一个专业的心理健康顾问,根据评估结果提供温和、专业、有同理心的建议。

建议要求:
1. 语气温和、不生硬
2. 避免使用"你可能患有抑郁症"等医疗诊断表述
3. 使用"你的情绪状态可能需要关注"等柔和表述
4. 提供具体可行的建议
5. 鼓励寻求专业帮助
6. 每条建议简洁明了

请返回3-5条建议的JSON数组。`;

    const userPrompt = `风险等级: ${riskLevel}
面部分析: ${JSON.stringify(faceAnalysis)}
对话分析: ${JSON.stringify(dialogueAnalysis)}

请生成评估建议。`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recommendations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: { type: "string" },
                description: "建议列表"
              }
            },
            required: ["recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const contentStr = typeof messageContent === 'string' ? messageContent : '{"recommendations":[]}';
    const result = JSON.parse(contentStr);
    return result.recommendations;
  } catch (error) {
    console.error('Generate recommendations error:', error);
    // 返回默认建议
    return [
      "建议保持规律的作息时间,充足的睡眠对情绪健康很重要。",
      "尝试进行适度的运动,如散步、瑜伽等,有助于改善心情。",
      "与信任的朋友或家人分享你的感受,社交支持很重要。",
      "如果情绪持续低落,建议寻求专业心理咨询师的帮助。",
    ];
  }
}
