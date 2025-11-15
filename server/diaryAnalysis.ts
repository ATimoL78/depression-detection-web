/**
 * AI日记分析功能
 * 使用OpenAI API分析情绪日记,识别负面思维模式并提供认知重构建议
 */

import { invokeLLM } from "./_core/llm";

export interface DiaryAnalysisResult {
  negativePatterns: string[];
  suggestions: string[];
}

/**
 * 分析情绪日记内容
 */
export async function analyzeDiaryEntry(
  thoughts: string,
  feelings: string
): Promise<DiaryAnalysisResult> {
  try {
    const prompt = `作为一位专业的认知行为疗法(CBT)心理咨询师,请分析以下情绪日记内容:

**发生的事情:**
${thoughts || '(未填写)'}

**情绪和感受:**
${feelings || '(未填写)'}

请完成以下任务:
1. 识别文本中的负面思维模式(如灾难化思维、黑白思维、过度概括、情绪化推理等)
2. 针对每个负面思维模式,提供认知重构建议

请以JSON格式返回结果:
{
  "negativePatterns": ["模式1描述", "模式2描述", ...],
  "suggestions": ["建议1", "建议2", ...]
}

要求:
- 负面思维模式要具体指出问题所在
- 建议要实用、温和、鼓励性
- 每条建议不超过50字
- 如果没有明显负面模式,返回空数组
- 使用温暖、同理心的语气`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一位专业的CBT心理咨询师,擅长识别负面思维模式并提供认知重构建议。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const result = typeof content === 'string' ? JSON.parse(content) : content;

    return {
      negativePatterns: result.negativePatterns || [],
      suggestions: result.suggestions || []
    };
  } catch (error) {
    console.error('Diary analysis error:', error);
    // 返回默认建议
    return {
      negativePatterns: [],
      suggestions: [
        "记录情绪是很好的自我觉察练习,继续保持!",
        "尝试从不同角度看待这件事,可能会有新的发现。",
        "记得善待自己,每个人都会有情绪起伏。"
      ]
    };
  }
}

/**
 * 分析文本情感
 */
export async function analyzeTextEmotion(text: string) {
  try {
    const prompt = `分析以下文本的情感特征,识别抑郁症相关语言模式:

文本内容:
${text}

请分析:
1. 情感倾向(positive/neutral/negative)
2. 抑郁症指标(如负面情绪词汇、绝对化表达、第一人称代词频率等)
3. 风险评分(0-100)
4. 关键短语

返回JSON格式:
{
  "sentiment": "positive/neutral/negative",
  "depressionIndicators": ["指标1", "指标2"],
  "riskScore": 0-100,
  "keyPhrases": ["短语1", "短语2"]
}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一个专业的心理健康文本分析助手。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    return typeof content === 'string' ? JSON.parse(content) : content;
  } catch (error) {
    console.error('Text emotion analysis error:', error);
    return {
      sentiment: "neutral",
      depressionIndicators: [],
      riskScore: 0,
      keyPhrases: []
    };
  }
}
