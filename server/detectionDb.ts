/**
 * 识别相关数据库查询辅助函数
 */

import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  detectionRecords,
  emotionHistory,
  assessmentReports,
  dialogueRecords,
  emotionDiary,
  medicalResources,
  InsertDetectionRecord,
  InsertEmotionHistory,
  InsertAssessmentReport,
  InsertDialogueRecord,
  InsertEmotionDiary,
} from "../drizzle/schema";

// ==================== 识别记录 ====================

export async function createDetectionRecord(data: InsertDetectionRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(detectionRecords).values(data);
  return result[0].insertId;
}

export async function getDetectionRecordsByUserId(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(detectionRecords)
    .where(eq(detectionRecords.userId, userId))
    .orderBy(desc(detectionRecords.createdAt))
    .limit(limit);
}

export async function getDetectionRecordById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(detectionRecords)
    .where(eq(detectionRecords.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// ==================== 情绪历史 ====================

export async function createEmotionHistory(data: InsertEmotionHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(emotionHistory).values(data);
}

export async function getEmotionHistoryByUserId(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(emotionHistory)
    .where(eq(emotionHistory.userId, userId))
    .orderBy(desc(emotionHistory.timestamp))
    .limit(limit);
}

// ==================== 评估报告 ====================

export async function createAssessmentReport(data: InsertAssessmentReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(assessmentReports).values(data);
  return result[0].insertId;
}

export async function getAssessmentReportsByUserId(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(assessmentReports)
    .where(eq(assessmentReports.userId, userId))
    .orderBy(desc(assessmentReports.createdAt))
    .limit(limit);
}

export async function getAssessmentReportById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(assessmentReports)
    .where(eq(assessmentReports.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// ==================== 对话记录 ====================

export async function createDialogueRecord(data: InsertDialogueRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(dialogueRecords).values(data);
  return result[0].insertId;
}

export async function getDialogueRecordsByUserId(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(dialogueRecords)
    .where(eq(dialogueRecords.userId, userId))
    .orderBy(desc(dialogueRecords.createdAt))
    .limit(limit);
}

// ==================== 情绪日记 ====================

export async function createEmotionDiary(data: InsertEmotionDiary) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emotionDiary).values(data);
  return result[0].insertId;
}

export async function getEmotionDiariesByUserId(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(emotionDiary)
    .where(eq(emotionDiary.userId, userId))
    .orderBy(desc(emotionDiary.createdAt))
    .limit(limit);
}

export async function getEmotionDiaryById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(emotionDiary)
    .where(and(eq(emotionDiary.id, id), eq(emotionDiary.userId, userId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateEmotionDiary(
  id: number,
  userId: number,
  data: Partial<InsertEmotionDiary>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(emotionDiary)
    .set(data)
    .where(and(eq(emotionDiary.id, id), eq(emotionDiary.userId, userId)));
}

export async function deleteEmotionDiary(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(emotionDiary)
    .where(and(eq(emotionDiary.id, id), eq(emotionDiary.userId, userId)));
}

// ==================== 医疗资源 ====================

export async function getMedicalResources(filters?: {
  type?: string;
  city?: string;
  province?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(medicalResources);
  
  const conditions = [];
  if (filters?.type) {
    conditions.push(eq(medicalResources.type, filters.type as any));
  }
  if (filters?.city) {
    conditions.push(eq(medicalResources.city, filters.city));
  }
  if (filters?.province) {
    conditions.push(eq(medicalResources.province, filters.province));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.limit(filters?.limit || 50);
}

export async function getMedicalResourceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(medicalResources)
    .where(eq(medicalResources.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// ==================== 统计数据 ====================

export async function getUserStatistics(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [detections, reports, diaries] = await Promise.all([
    db.select().from(detectionRecords).where(eq(detectionRecords.userId, userId)),
    db.select().from(assessmentReports).where(eq(assessmentReports.userId, userId)),
    db.select().from(emotionDiary).where(eq(emotionDiary.userId, userId)),
  ]);
  
  return {
    totalDetections: detections.length,
    totalReports: reports.length,
    totalDiaries: diaries.length,
    latestRiskLevel: reports[0]?.riskLevel || 'low',
  };
}

// ==================== PHQ-9评估 ====================

export async function createPHQ9Assessment(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 注意: 需要先在schema中定义phq9Assessments表
  // 这里使用临时方案,存储到assessmentReports中
  const result = await db.insert(assessmentReports).values({
    userId: data.userId,
    detectionId: null,
    riskLevel: data.severity,
    score: data.totalScore,
    recommendations: null,
    reportData: JSON.stringify({
      type: 'PHQ9',
      answers: data.answers,
      totalScore: data.totalScore,
      severity: data.severity,
    }),
  });
  return result[0].insertId;
}

export async function createGAD7Assessment(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(assessmentReports).values({
    userId: data.userId,
    detectionId: null,
    riskLevel: data.severity,
    score: data.totalScore,
    recommendations: null,
    reportData: JSON.stringify({
      type: 'GAD7',
      answers: data.answers,
      totalScore: data.totalScore,
      severity: data.severity,
    }),
  });
  return result[0].insertId;
}

export async function getPHQ9History(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const reports = await db
    .select()
    .from(assessmentReports)
    .where(eq(assessmentReports.userId, userId))
    .orderBy(desc(assessmentReports.createdAt));
  
  return reports
    .filter(r => {
      try {
        const data = JSON.parse(r.reportData || '{}');
        return data.type === 'PHQ9';
      } catch {
        return false;
      }
    })
    .map(r => {
      const data = JSON.parse(r.reportData || '{}');
      return {
        date: r.createdAt,
        score: data.totalScore,
        severity: data.severity,
      };
    });
}

// ==================== 增强版情绪日记 ====================

export async function createEmotionDiaryEnhanced(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emotionDiary).values({
    userId: data.userId,
    title: `${data.date.toLocaleDateString()} 日记`,
    content: [data.thoughts, data.feelings, data.behaviors].filter(Boolean).join('\n\n'),
    mood: `${data.mood}`,
    tags: data.activities,
  });
  return result[0].insertId;
}

export async function getRecentEmotionDiaries(userId: number, limit = 5) {
  const db = await getDb();
  if (!db) return [];
  
  const diaries = await db
    .select()
    .from(emotionDiary)
    .where(eq(emotionDiary.userId, userId))
    .orderBy(desc(emotionDiary.createdAt))
    .limit(limit);
  
  return diaries.map(d => ({
    id: d.id,
    date: d.createdAt,
    mood: parseInt(d.mood || '5'),
    thoughts: d.content,
    activities: d.tags ? JSON.parse(d.tags) : [],
  }));
}

// ==================== 趋势分析 ====================

export async function getMoodTrend(userId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const diaries = await db
    .select()
    .from(emotionDiary)
    .where(eq(emotionDiary.userId, userId))
    .orderBy(desc(emotionDiary.createdAt))
    .limit(days);
  
  return diaries.map(d => ({
    date: d.createdAt,
    mood: parseInt(d.mood || '5'),
  })).reverse();
}

export async function getAUPattern(userId: number) {
  // 模拟AU数据,实际应该从检测记录中提取
  return [
    { au: 'AU1 内眉上扬', value: 2.5 },
    { au: 'AU2 外眉上扬', value: 2.0 },
    { au: 'AU4 眉头紧锁', value: 1.5 },
    { au: 'AU6 脸颊上提', value: 3.0 },
    { au: 'AU12 嘴角上扬', value: 2.8 },
    { au: 'AU15 嘴角下垂', value: 1.2 },
    { au: 'AU25 嘴唇分开', value: 2.0 },
    { au: 'AU26 下颌下垂', value: 1.8 },
  ];
}

export async function getActivityStats(userId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const diaries = await db
    .select()
    .from(emotionDiary)
    .where(eq(emotionDiary.userId, userId))
    .orderBy(desc(emotionDiary.createdAt))
    .limit(days);
  
  // 统计活动频率
  const activityCount: Record<string, number> = {};
  
  diaries.forEach(d => {
    if (d.tags) {
      try {
        const activities = JSON.parse(d.tags);
        activities.forEach((activity: string) => {
          activityCount[activity] = (activityCount[activity] || 0) + 1;
        });
      } catch {}
    }
  });
  
  return Object.entries(activityCount)
    .map(([activity, count]) => ({ activity, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
