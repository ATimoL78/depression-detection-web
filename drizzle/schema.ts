import { integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

// 定义枚举类型
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const detectionTypeEnum = pgEnum("detection_type", ["face", "dialogue", "combined"]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);
export const sentimentEnum = pgEnum("sentiment", ["positive", "neutral", "negative"]);
export const resourceTypeEnum = pgEnum("resource_type", ["hospital", "clinic", "counselor", "hotline"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 识别记录表
export const detectionRecords = pgTable("detectionRecords", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  type: detectionTypeEnum("type").notNull(),
  resultData: text("resultData").notNull(), // JSON格式存储识别结果
  riskLevel: riskLevelEnum("riskLevel"),
  confidence: integer("confidence"), // 0-100的置信度
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 情绪历史表
export const emotionHistory = pgTable("emotionHistory", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  detectionId: integer("detectionId"),
  emotion: varchar("emotion", { length: 50 }).notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// 评估报告表
export const assessmentReports = pgTable("assessmentReports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  detectionId: integer("detectionId"),
  riskLevel: riskLevelEnum("riskLevel").notNull(),
  score: integer("score").notNull(), // 0-100的抑郁倾向评分
  recommendations: text("recommendations"), // JSON格式存储建议
  reportData: text("reportData").notNull(), // JSON格式存储完整报告数据
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 对话记录表
export const dialogueRecords = pgTable("dialogueRecords", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  detectionId: integer("detectionId"),
  content: text("content").notNull(),
  analysisResult: text("analysisResult"), // JSON格式存储分析结果
  sentiment: sentimentEnum("sentiment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 情绪日记表
export const emotionDiary = pgTable("emotionDiary", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 200 }),
  content: text("content").notNull(),
  mood: varchar("mood", { length: 50 }),
  tags: text("tags"), // JSON数组格式
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// 医疗资源表
export const medicalResources = pgTable("medicalResources", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 200 }).notNull(),
  type: resourceTypeEnum("type").notNull(),
  description: text("description"),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 500 }),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  rating: integer("rating"), // 1-5星评分
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DetectionRecord = typeof detectionRecords.$inferSelect;
export type InsertDetectionRecord = typeof detectionRecords.$inferInsert;
export type EmotionHistory = typeof emotionHistory.$inferSelect;
export type InsertEmotionHistory = typeof emotionHistory.$inferInsert;
export type AssessmentReport = typeof assessmentReports.$inferSelect;
export type InsertAssessmentReport = typeof assessmentReports.$inferInsert;
export type DialogueRecord = typeof dialogueRecords.$inferSelect;
export type InsertDialogueRecord = typeof dialogueRecords.$inferInsert;
export type EmotionDiary = typeof emotionDiary.$inferSelect;
export type InsertEmotionDiary = typeof emotionDiary.$inferInsert;
export type MedicalResource = typeof medicalResources.$inferSelect;
export type InsertMedicalResource = typeof medicalResources.$inferInsert;
