import { Router } from "express";
import OpenAI from "openai";

const router = Router();

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// 语音分析端点
router.post("/analyze-voice", async (req, res) => {
  try {
    const { transcript, questionIndex } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: "缺少语音转录文本" });
    }

    // 检查API密钥
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured, using local analysis");
      return res.json(analyzeLocally(transcript, questionIndex));
    }

    // 使用OpenAI进行深度分析
    const analysis = await analyzeWithAI(transcript, questionIndex);
    res.json(analysis);

  } catch (error: any) {
    console.error("Voice analysis error:", error);
    
    // 降级到本地分析
    res.json(analyzeLocally(req.body.transcript, req.body.questionIndex));
  }
});

// 使用AI进行深度分析
async function analyzeWithAI(transcript: string, questionIndex: number) {
  const systemPrompt = `你是一位专业的心理健康评估AI。请分析用户的回答,从以下维度评估:

1. **情感倾向** (sentiment): 积极/中性/消极
2. **语气** (tone): 平稳/低沉/焦虑/激动
3. **情感强度** (emotionalIntensity): 0-100分
4. **抑郁症风险评分** (depressionRisk): 0-100分
5. **关键指标** (keyIndicators): 识别的抑郁症相关特征

请以JSON格式返回分析结果。`;

  const userPrompt = `问题序号: ${questionIndex}
用户回答: "${transcript}"

请分析这段回答,特别关注:
- 负面情绪表达(悲伤、绝望、无价值感等)
- 兴趣丧失和快感缺失
- 睡眠和食欲问题
- 疲劳和精力不足
- 注意力和决策困难
- 自杀或自伤倾向

返回JSON格式:
{
  "transcript": "原文",
  "sentiment": "情感倾向",
  "tone": "语气",
  "speechRate": 100,
  "pauseFrequency": 0,
  "emotionalIntensity": 数字,
  "depressionRisk": 数字,
  "keyIndicators": ["指标1", "指标2"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return result;

  } catch (error) {
    console.error("AI analysis error:", error);
    return analyzeLocally(transcript, questionIndex);
  }
}

// 本地简单分析(降级方案)
function analyzeLocally(transcript: string, questionIndex: number) {
  let risk = 0;
  const indicators: string[] = [];

  // 负面关键词权重表
  const negativeKeywords = {
    '不想': 10,
    '没有': 8,
    '失眠': 15,
    '睡不着': 15,
    '疲劳': 12,
    '累': 10,
    '没意义': 20,
    '没价值': 20,
    '自责': 15,
    '痛苦': 15,
    '难过': 12,
    '绝望': 25,
    '想死': 30,
    '自杀': 30,
    '结束': 20,
    '放弃': 15,
    '无聊': 10,
    '空虚': 12,
    '孤独': 12,
    '没劲': 10,
    '不行': 8,
    '糟糕': 10,
  };

  // 积极关键词(降低风险)
  const positiveKeywords = {
    '还好': -5,
    '正常': -5,
    '可以': -3,
    '有': -2,
    '喜欢': -8,
    '开心': -10,
    '高兴': -10,
    '满意': -8,
    '不错': -5,
    '挺好': -8,
  };

  // 分析负面关键词
  Object.entries(negativeKeywords).forEach(([keyword, weight]) => {
    if (transcript.includes(keyword)) {
      risk += weight;
      indicators.push(`负面表达: "${keyword}"`);
    }
  });

  // 分析积极关键词
  Object.entries(positiveKeywords).forEach(([keyword, weight]) => {
    if (transcript.includes(keyword)) {
      risk += weight; // weight是负数,所以是减少风险
    }
  });

  // 回答长度分析
  if (transcript.length < 5) {
    risk += 20;
    indicators.push('回答过于简短(可能表示兴趣缺失)');
  } else if (transcript.length < 10) {
    risk += 10;
    indicators.push('回答较简短');
  }

  // 特定问题的额外分析
  if (questionIndex === 8) { // 自杀倾向问题
    if (transcript.includes('有') || transcript.includes('想过') || transcript.includes('考虑')) {
      risk += 40;
      indicators.push('⚠️ 存在自杀倾向,需立即关注');
    }
  }

  // 情感强度(根据标点和语气词)
  const emotionalMarkers = transcript.match(/[!?。,、]/g) || [];
  const emotionalIntensity = Math.min(100, emotionalMarkers.length * 15 + 30);

  // 判断情感倾向
  let sentiment = '中性';
  if (risk > 50) {
    sentiment = '消极';
  } else if (risk > 30) {
    sentiment = '中性偏消极';
  } else if (risk < 10) {
    sentiment = '积极';
  }

  // 判断语气
  let tone = '平稳';
  if (risk > 60) {
    tone = '低沉';
  } else if (risk > 40) {
    tone = '平淡';
  } else if (emotionalIntensity > 70) {
    tone = '激动';
  }

  return {
    transcript,
    sentiment,
    tone,
    speechRate: 100, // 无法从文本分析
    pauseFrequency: 0, // 无法从文本分析
    emotionalIntensity,
    depressionRisk: Math.max(0, Math.min(100, risk)),
    keyIndicators: indicators,
  };
}

export default router;
