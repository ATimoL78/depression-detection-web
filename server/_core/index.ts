import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { analyzeDiaryEntry } from "../diaryAnalysis";
import OpenAI from "openai";
import * as statisticsDb from "../statisticsDb";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// 语音分析辅助函数
async function analyzeVoiceWithAI(transcript: string, questionIndex: number) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const systemPrompt = `你是一位专业的心理健康评估AI。请分析用户的回答,从以下维度评估:
1. **情感倾向** (sentiment): 积极/中性/消极
2. **语气** (tone): 平稳/低沉/焦虑/激动
3. **情感强度** (emotionalIntensity): 0-100分
4. **抑郁症风险评分** (depressionRisk): 0-100分
5. **关键指标** (keyIndicators): 识别的抑郁症相关特征
请以JSON格式返回分析结果。`;

  const userPrompt = `问题序号: ${questionIndex}\n用户回答: "${transcript}"\n\n请分析这段回答,特别关注负面情绪、兴趣丧失、睡眠问题、疲劳、自杀倾向等。\n\n返回JSON格式:{"transcript":"","sentiment":"","tone":"","speechRate":100,"pauseFrequency":0,"emotionalIntensity":0,"depressionRisk":0,"keyIndicators":[]}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" } as any,
  });

  return JSON.parse(completion.choices[0]?.message?.content || "{}");
}

function analyzeVoiceLocally(transcript: string, questionIndex: number) {
  let risk = 0;
  const indicators: string[] = [];

  const negativeKeywords: Record<string, number> = {
    '不想': 10, '没有': 8, '失眠': 15, '睡不着': 15, '疲劳': 12, '累': 10,
    '没意义': 20, '没价值': 20, '自责': 15, '痛苦': 15, '难过': 12, '绝望': 25,
    '想死': 30, '自杀': 30, '结束': 20, '放弃': 15, '无聊': 10, '空虚': 12,
    '孤独': 12, '没劲': 10, '不行': 8, '糟糕': 10,
  };

  const positiveKeywords: Record<string, number> = {
    '还好': -5, '正常': -5, '可以': -3, '有': -2, '喜欢': -8,
    '开心': -10, '高兴': -10, '满意': -8, '不错': -5, '挺好': -8,
  };

  Object.entries(negativeKeywords).forEach(([keyword, weight]) => {
    if (transcript.includes(keyword)) {
      risk += weight;
      indicators.push(`负面表达: "${keyword}"`);
    }
  });

  Object.entries(positiveKeywords).forEach(([keyword, weight]) => {
    if (transcript.includes(keyword)) risk += weight;
  });

  if (transcript.length < 5) {
    risk += 20;
    indicators.push('回答过于简短(可能表示兴趣缺失)');
  } else if (transcript.length < 10) {
    risk += 10;
    indicators.push('回答较简短');
  }

  if (questionIndex === 8) {
    if (transcript.includes('有') || transcript.includes('想过') || transcript.includes('考虑')) {
      risk += 40;
      indicators.push('⚠️ 存在自杀倾向,需立即关注');
    }
  }

  const emotionalMarkers = transcript.match(/[!?。,、]/g) || [];
  const emotionalIntensity = Math.min(100, emotionalMarkers.length * 15 + 30);

  let sentiment = '中性';
  if (risk > 50) sentiment = '消极';
  else if (risk > 30) sentiment = '中性偏消极';
  else if (risk < 10) sentiment = '积极';

  let tone = '平稳';
  if (risk > 60) tone = '低沉';
  else if (risk > 40) tone = '平淡';
  else if (emotionalIntensity > 70) tone = '激动';

  return {
    transcript,
    sentiment,
    tone,
    speechRate: 100,
    pauseFrequency: 0,
    emotionalIntensity,
    depressionRisk: Math.max(0, Math.min(100, risk)),
    keyIndicators: indicators,
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // 性能优化中间件 - 2025
  const {
    compressionMiddleware,
    cacheMiddleware,
    rateLimitMiddleware,
    responseTimeMiddleware,
    securityHeadersMiddleware,
  } = await import('../middleware/performance');
  
  // 1. 响应时间记录
  app.use(responseTimeMiddleware());
  
  // 2. 安全头
  app.use(securityHeadersMiddleware());
  
  // 3. 响应压缩
  if (process.env.COMPRESSION_ENABLED !== 'false') {
    app.use(compressionMiddleware());
  }
  
  // 4. 缓存控制
  if (process.env.CACHE_ENABLED !== 'false') {
    app.use(cacheMiddleware());
  }
  
  // 5. API限流
  app.use('/api/', rateLimitMiddleware({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  }));
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // 访问统计中间件
  app.use((req, res, next) => {
    // 记录访问(排除API请求)
    if (!req.path.startsWith('/api/')) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';
      try {
        statisticsDb.recordVisit(ipAddress, userAgent, req.path);
      } catch (error) {
        console.error('Record visit error:', error);
      }
    }
    next();
  });

  // 统计数据API
  app.get("/api/statistics", async (req, res) => {
    try {
      const allStats = await statisticsDb.getAllStatistics();
      const todayStats = await statisticsDb.getTodayStatistics();
      const weeklyStats = await statisticsDb.getWeeklyStatistics();
      const completionStats = await statisticsDb.getTestCompletionRate();

      res.json({
        totalVisitors: allStats.total_visitors?.value || 0,
        totalTests: allStats.total_tests?.value || 0,
        faceDetectionTests: allStats.face_detection_tests?.value || 0,
        phq9Assessments: allStats.phq9_assessments?.value || 0,
        gad7Assessments: allStats.gad7_assessments?.value || 0,
        emotionDiaries: allStats.emotion_diaries?.value || 0,
        voiceInterviews: allStats.voice_interviews?.value || 0,
        todayVisitors: todayStats.todayVisitors,
        todayTests: todayStats.todayTests,
        weeklyVisitors: weeklyStats.weeklyVisitors,
        weeklyTests: weeklyStats.weeklyTests,
        completionRate: completionStats.rate,
      });
    } catch (error) {
      console.error('Statistics API error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });
  
  // AI日记分析API
  app.post("/api/analyze-diary", async (req, res) => {
    try {
      const { thoughts, feelings } = req.body;
      const result = await analyzeDiaryEntry(thoughts || '', feelings || '');
      res.json(result);
    } catch (error) {
      console.error('Diary analysis API error:', error);
      res.status(500).json({ error: 'Analysis failed' });
    }
  });

  // 语音分析API
  app.post("/api/analyze-voice", async (req, res) => {
    try {
      const { transcript, questionIndex } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: "缺少语音转录文本" });
      }

      // 检查API密钥
      if (!process.env.OPENAI_API_KEY) {
        console.warn("OpenAI API key not configured, using local analysis");
        return res.json(analyzeVoiceLocally(transcript, questionIndex));
      }

      // 使用OpenAI进行深度分析
      const analysis = await analyzeVoiceWithAI(transcript, questionIndex);
      res.json(analysis);

    } catch (error: any) {
      console.error("Voice analysis error:", error);
      res.json(analyzeVoiceLocally(req.body.transcript, req.body.questionIndex));
    }
  });

  // AI聊天API
  app.post("/api/ai-chat", async (req, res) => {
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

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // 构建系统提示词
      const systemPrompt = `你是一位专业、温暖、富有同理心的心理健康AI助手。你的职责是:

1. **倾听和理解**: 认真倾听用户的感受,不评判,不批评
2. **提供支持**: 给予温暖的陪伴和情感支持
3. **专业建议**: 基于心理学知识提供科学的建议
4. **危机干预**: 识别高风险情况,建议寻求专业帮助
5. **保持边界**: 明确你是AI助手,不能替代专业心理咨询

**沟通风格**:
- 使用温暖、友善的语气
- 避免使用专业术语,用通俗易懂的语言
- 每次回复控制在150字以内
- 多使用开放式问题,鼓励用户表达

**重要原则**:
- 如果用户表达自杀、自伤倾向,立即建议拨打心理援助热线
- 不提供药物建议
- 不做诊断,只提供支持和建议
- 鼓励用户寻求专业帮助

${context ? `\n**当前用户状态**:\n${context}` : ""}`;

      // 构建消息历史
      const chatMessages = [
        { role: "system", content: systemPrompt },
        ...(messages || []).slice(-10),
        { role: "user", content: userMessage }
      ];

      // 调用OpenAI API
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: chatMessages as any,
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
      });

      const assistantMessage = completion.choices[0]?.message?.content || "抱歉,我暂时无法回复。";

      res.json({
        message: assistantMessage,
        usage: completion.usage,
      });

    } catch (error: any) {
      console.error("AI chat error:", error);
      res.json({
        message: "我现在遇到了一些技术问题,但我想告诉您:您的感受是重要的,您并不孤单。如果您需要帮助,建议联系专业心理咨询师或拨打心理援助热线: 400-161-9995"
      });
    }
  });
  // 导入新的实时情绪分析路由
  const realtimeEmotionRouter = await import("../routes/realtime-emotion");
  app.use("/api", realtimeEmotionRouter.default);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
