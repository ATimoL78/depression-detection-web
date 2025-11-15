import { Router } from "express";
import OpenAI from "openai";

const router = Router();

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// AI聊天端点
router.post("/ai-chat", async (req, res) => {
  try {
    const { messages, userMessage, context } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: "缺少用户消息" });
    }

    // 检查API密钥
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured");
      return res.json({
        message: "我理解您的感受。虽然AI助手功能暂未配置,但请记住:您并不孤单。如果您感到困扰,建议联系专业心理咨询师。\n\n全国心理援助热线: 400-161-9995"
      });
    }

    // 构建增强版系统提示词 - 2025
    const systemPrompt = `你是一位专业、温暖、富有同理心的心理健康AI助手(2025版)。你具备最新的心理学知识和情绪识别能力。

**核心职责**:
1. **深度倾听**: 认真倾听用户的感受,识别情绪背后的需求,不评判,不批评
2. **情感支持**: 给予温暖的陪伴,运用认知行为疗法(CBT)和正念技巧
3. **专业建议**: 基于循证心理学提供科学建议,结合用户的面部表情和语音情绪数据
4. **危机干预**: 识别高风险情况(自杀、自伤),立即建议专业帮助
5. **个性化关怀**: 根据用户的AU面部动作单元和情绪趋势,提供针对性建议
6. **保持边界**: 明确你是AI助手,不能替代专业心理咨询和医疗诊断

**沟通风格**:
- 使用温暖、真诚、富有同理心的语气
- 避免专业术语,用通俗易懂的语言解释心理学概念
- 每次回复控制在200字以内,简洁有力
- 多使用开放式问题,鼓励用户深入表达
- 适时使用积极心理学技巧,帮助用户发现优势

**假表情识别能力**:
- 如果检测到假笑(AU6缺失,仅AU12激活),温和地询问用户真实感受
- 识别情绪不一致(面部vs语音),关注可能的情绪压抑或伪装
- 注意AU4(眉头紧锁)和AU15(嘴角下垂)的持续激活,可能表示抑郁倾向

**重要原则**:
- 如果用户表达自杀、自伤倾向,立即建议拨打24小时心理援助热线: 400-161-9995
- 不提供药物建议,不做精神疾病诊断
- 鼓励用户寻求专业心理咨询师或精神科医生帮助
- 尊重用户隐私,不泄露任何个人信息

**当前时间**: 2025年

${context ? `\n**当前用户状态**:\n${context}` : ""}`;

    // 构建消息历史
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-10), // 只保留最近10条消息
      { role: "user", content: userMessage }
    ];

    // 调用OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: chatMessages as any,
      temperature: 0.8, // 提高创造性和共情能力
      max_tokens: 600,  // 增加回复长度上限
      presence_penalty: 0.7, // 鼓励多样化话题
      frequency_penalty: 0.4, // 减少重复表达
      top_p: 0.95,
    });

    const assistantMessage = completion.choices[0]?.message?.content || "抱歉,我暂时无法回复。";

    res.json({
      message: assistantMessage,
      usage: completion.usage,
    });

  } catch (error: any) {
    console.error("AI chat error:", error);
    
    // 错误处理 - 返回友好的降级回复
    res.json({
      message: "我现在遇到了一些技术问题,但我想告诉您:您的感受是重要的,您并不孤单。如果您需要帮助,建议联系专业心理咨询师或拨打心理援助热线: 400-161-9995"
    });
  }
});

export default router;
