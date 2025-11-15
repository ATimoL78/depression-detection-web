import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { mockFaceDetection } from "./faceDetection";
import { analyzeDialogue, combineAssessment, generateRecommendations } from "./dialogueAnalysis";
import * as detectionDb from "./detectionDb";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 面部识别相关路由
  faceDetection: router({
    analyze: protectedProcedure
      .input(z.object({
        imageData: z.string(), // base64编码的图片数据
      }))
      .mutation(async ({ ctx, input }) => {
        const imageBuffer = Buffer.from(input.imageData, 'base64');
        const result = await mockFaceDetection(imageBuffer);
        
        if (result.success) {
          // 保存识别记录
          const detectionId = await detectionDb.createDetectionRecord({
            userId: ctx.user.id,
            type: 'face',
            resultData: JSON.stringify(result),
            riskLevel: result.riskLevel,
            confidence: result.confidence,
          });
          
          // 保存情绪历史
          if (result.emotion) {
            await detectionDb.createEmotionHistory({
              userId: ctx.user.id,
              detectionId,
              emotion: result.emotion,
              confidence: result.confidence || 0,
            });
          }
          
          return { ...result, detectionId };
        }
        
        return result;
      }),
  }),
  
  // 对话分析相关路由
  dialogueAnalysis: router({
    analyze: protectedProcedure
      .input(z.object({
        content: z.string().min(10),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await analyzeDialogue(input.content);
        
        if (result.success) {
          // 保存对话记录
          const detectionId = await detectionDb.createDialogueRecord({
            userId: ctx.user.id,
            content: input.content,
            analysisResult: JSON.stringify(result),
            sentiment: result.sentiment,
          });
          
          // 保存识别记录
          await detectionDb.createDetectionRecord({
            userId: ctx.user.id,
            type: 'dialogue',
            resultData: JSON.stringify(result),
            riskLevel: result.riskLevel,
            confidence: result.riskScore,
          });
          
          return { ...result, detectionId };
        }
        
        return result;
      }),
  }),
  
  // 标准化量表评估相关路由
  assessment: router({
    // PHQ-9评估
    savePHQ9: protectedProcedure
      .input(z.object({
        answers: z.array(z.number()),
        totalScore: z.number(),
        severity: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const assessmentId = await detectionDb.createPHQ9Assessment({
          userId: ctx.user.id,
          answers: JSON.stringify(input.answers),
          totalScore: input.totalScore,
          severity: input.severity,
        });
        return { assessmentId };
      }),
    
    // GAD-7评估
    saveGAD7: protectedProcedure
      .input(z.object({
        answers: z.array(z.number()),
        totalScore: z.number(),
        severity: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const assessmentId = await detectionDb.createGAD7Assessment({
          userId: ctx.user.id,
          answers: JSON.stringify(input.answers),
          totalScore: input.totalScore,
          severity: input.severity,
        });
        return { assessmentId };
      }),
    
    // 综合评估
    combined: protectedProcedure
      .input(z.object({
        faceDetectionId: z.number().optional(),
        dialogueDetectionId: z.number().optional(),
        faceRiskScore: z.number().min(0).max(100),
        dialogueRiskScore: z.number().min(0).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        const combined = combineAssessment(
          input.faceRiskScore,
          input.dialogueRiskScore
        );
        
        // 获取详细分析结果
        let faceAnalysis = null;
        let dialogueAnalysis = null;
        
        if (input.faceDetectionId) {
          const record = await detectionDb.getDetectionRecordById(input.faceDetectionId);
          if (record) faceAnalysis = JSON.parse(record.resultData);
        }
        
        if (input.dialogueDetectionId) {
          const record = await detectionDb.getDetectionRecordById(input.dialogueDetectionId);
          if (record) dialogueAnalysis = JSON.parse(record.resultData);
        }
        
        // 生成建议
        const recommendations = await generateRecommendations(
          combined.riskLevel,
          faceAnalysis,
          dialogueAnalysis
        );
        
        // 保存评估报告
        const reportId = await detectionDb.createAssessmentReport({
          userId: ctx.user.id,
          detectionId: input.faceDetectionId || input.dialogueDetectionId,
          riskLevel: combined.riskLevel,
          score: combined.riskScore,
          recommendations: JSON.stringify(recommendations),
          reportData: JSON.stringify({
            combined,
            faceAnalysis,
            dialogueAnalysis,
            recommendations,
          }),
        });
        
        return {
          reportId,
          ...combined,
          recommendations,
          faceAnalysis,
          dialogueAnalysis,
        };
      }),
    
    getReports: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return detectionDb.getAssessmentReportsByUserId(
          ctx.user.id,
          input.limit || 10
        );
      }),
    
    getReportById: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const report = await detectionDb.getAssessmentReportById(input.id);
        if (!report || report.userId !== ctx.user.id) {
          throw new Error('报告不存在或无权访问');
        }
        return report;
      }),
  }),
  
  // 识别历史相关路由
  history: router({
    getDetections: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return detectionDb.getDetectionRecordsByUserId(
          ctx.user.id,
          input.limit || 20
        );
      }),
    
    getEmotions: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return detectionDb.getEmotionHistoryByUserId(
          ctx.user.id,
          input.limit || 100
        );
      }),
    
    getStatistics: protectedProcedure
      .query(async ({ ctx }) => {
        return detectionDb.getUserStatistics(ctx.user.id);
      }),
  }),
  
  // 情绪日记相关路由
  diary: router({
    // 保存日记
    save: protectedProcedure
      .input(z.object({
        date: z.date(),
        mood: z.number().min(1).max(10),
        activities: z.array(z.string()),
        thoughts: z.string().optional(),
        feelings: z.string().optional(),
        behaviors: z.string().optional(),
        aiAnalysis: z.object({
          negativePatterns: z.array(z.string()),
          suggestions: z.array(z.string()),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const diaryId = await detectionDb.createEmotionDiaryEnhanced({
          userId: ctx.user.id,
          date: input.date,
          mood: input.mood,
          activities: JSON.stringify(input.activities),
          thoughts: input.thoughts,
          feelings: input.feelings,
          behaviors: input.behaviors,
          aiAnalysis: input.aiAnalysis ? JSON.stringify(input.aiAnalysis) : undefined,
        });
        return { diaryId };
      }),
    
    // 获取最近日记
    getRecent: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return detectionDb.getRecentEmotionDiaries(
          ctx.user.id,
          input.limit || 5
        );
      }),
    
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return detectionDb.getEmotionDiariesByUserId(
          ctx.user.id,
          input.limit || 20
        );
      }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string().optional(),
        content: z.string().min(1),
        mood: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const diaryId = await detectionDb.createEmotionDiary({
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
          mood: input.mood,
          tags: input.tags ? JSON.stringify(input.tags) : undefined,
        });
        return { diaryId };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        mood: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await detectionDb.updateEmotionDiary(id, ctx.user.id, {
          ...data,
          tags: data.tags ? JSON.stringify(data.tags) : undefined,
        });
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await detectionDb.deleteEmotionDiary(input.id, ctx.user.id);
        return { success: true };
      }),
  }),
  
  // AI心理助手相关路由
  aiAssistant: router({
    chat: protectedProcedure
      .input(z.object({
        message: z.string().min(1),
        history: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const { invokeLLM } = await import("./_core/llm");
          
          const messages: any[] = [
            {
              role: "system",
              content: `你是一位温暖、专业的心理健康助手。你的职责是:
1. 倾听用户的感受和困扰
2. 提供情感支持和理解
3. 给出温和、实用的建议
4. 鼓励用户寻求专业帮助(如果需要)

注意事项:
- 使用温暖、同理心的语气
- 避免医疗诊断性表述
- 不要使用"你患有抑郁症"等表述
- 使用"你的情绪状态可能需要关注"等柔和表述
- 回复简洁明了,每次200字以内
- 适当使用emoji增加亲和力`
            },
          ];
          
          // 添加历史对话
          if (input.history && input.history.length > 0) {
            messages.push(...input.history.map(msg => ({
              role: msg.role,
              content: msg.content,
            })));
          }
          
          // 添加当前消息
          messages.push({
            role: "user",
            content: input.message,
          });
          
          const response = await invokeLLM({ messages });
          const messageContent = response.choices[0].message.content;
          const contentStr = typeof messageContent === 'string' ? messageContent : '';
          
          return {
            success: true,
            response: contentStr,
          };
        } catch (error) {
          console.error('AI Assistant error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
  }),
  
  // 趋势分析相关路由
  analytics: router({
    // 获取情绪趋势
    getMoodTrend: protectedProcedure
      .input(z.object({
        days: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return detectionDb.getMoodTrend(
          ctx.user.id,
          input.days || 30
        );
      }),
    
    // 获取PHQ-9历史
    getPHQ9History: protectedProcedure
      .query(async ({ ctx }) => {
        return detectionDb.getPHQ9History(ctx.user.id);
      }),
    
    // 获取AU模式
    getAUPattern: protectedProcedure
      .query(async ({ ctx }) => {
        return detectionDb.getAUPattern(ctx.user.id);
      }),
    
    // 获取活动统计
    getActivityStats: protectedProcedure
      .input(z.object({
        days: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return detectionDb.getActivityStats(
          ctx.user.id,
          input.days || 30
        );
      }),
  }),
  
  // 医疗资源相关路由
  medical: router({
    getResources: publicProcedure
      .input(z.object({
        type: z.enum(['hospital', 'clinic', 'counselor', 'hotline']).optional(),
        city: z.string().optional(),
        province: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return detectionDb.getMedicalResources(input);
      }),
    
    getResourceById: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input }) => {
        return detectionDb.getMedicalResourceById(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
