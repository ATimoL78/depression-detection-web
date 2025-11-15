-- 数据库索引优化 - 2025性能升级
-- 这些索引将显著提升查询性能

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_openId ON users(openId);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_createdAt ON users(createdAt);
CREATE INDEX IF NOT EXISTS idx_users_lastSignedIn ON users(lastSignedIn);

-- 识别记录表索引
CREATE INDEX IF NOT EXISTS idx_detectionRecords_userId ON detectionRecords(userId);
CREATE INDEX IF NOT EXISTS idx_detectionRecords_type ON detectionRecords(type);
CREATE INDEX IF NOT EXISTS idx_detectionRecords_createdAt ON detectionRecords(createdAt);
CREATE INDEX IF NOT EXISTS idx_detectionRecords_riskLevel ON detectionRecords(riskLevel);
-- 复合索引:用户ID + 创建时间(用于用户历史查询)
CREATE INDEX IF NOT EXISTS idx_detectionRecords_userId_createdAt ON detectionRecords(userId, createdAt DESC);
-- 复合索引:类型 + 创建时间(用于统计分析)
CREATE INDEX IF NOT EXISTS idx_detectionRecords_type_createdAt ON detectionRecords(type, createdAt DESC);

-- 情绪历史表索引
CREATE INDEX IF NOT EXISTS idx_emotionHistory_userId ON emotionHistory(userId);
CREATE INDEX IF NOT EXISTS idx_emotionHistory_detectionId ON emotionHistory(detectionId);
CREATE INDEX IF NOT EXISTS idx_emotionHistory_emotion ON emotionHistory(emotion);
CREATE INDEX IF NOT EXISTS idx_emotionHistory_timestamp ON emotionHistory(timestamp);
-- 复合索引:用户ID + 时间戳(用于用户情绪趋势查询)
CREATE INDEX IF NOT EXISTS idx_emotionHistory_userId_timestamp ON emotionHistory(userId, timestamp DESC);

-- 评估报告表索引
CREATE INDEX IF NOT EXISTS idx_assessmentReports_userId ON assessmentReports(userId);
CREATE INDEX IF NOT EXISTS idx_assessmentReports_detectionId ON assessmentReports(detectionId);
CREATE INDEX IF NOT EXISTS idx_assessmentReports_riskLevel ON assessmentReports(riskLevel);
CREATE INDEX IF NOT EXISTS idx_assessmentReports_createdAt ON assessmentReports(createdAt);
-- 复合索引:用户ID + 创建时间(用于用户报告历史)
CREATE INDEX IF NOT EXISTS idx_assessmentReports_userId_createdAt ON assessmentReports(userId, createdAt DESC);

-- 对话记录表索引
CREATE INDEX IF NOT EXISTS idx_dialogueRecords_userId ON dialogueRecords(userId);
CREATE INDEX IF NOT EXISTS idx_dialogueRecords_detectionId ON dialogueRecords(detectionId);
CREATE INDEX IF NOT EXISTS idx_dialogueRecords_sentiment ON dialogueRecords(sentiment);
CREATE INDEX IF NOT EXISTS idx_dialogueRecords_createdAt ON dialogueRecords(createdAt);
-- 复合索引:用户ID + 创建时间(用于用户对话历史)
CREATE INDEX IF NOT EXISTS idx_dialogueRecords_userId_createdAt ON dialogueRecords(userId, createdAt DESC);

-- 情绪日记表索引
CREATE INDEX IF NOT EXISTS idx_emotionDiary_userId ON emotionDiary(userId);
CREATE INDEX IF NOT EXISTS idx_emotionDiary_mood ON emotionDiary(mood);
CREATE INDEX IF NOT EXISTS idx_emotionDiary_createdAt ON emotionDiary(createdAt);
CREATE INDEX IF NOT EXISTS idx_emotionDiary_updatedAt ON emotionDiary(updatedAt);
-- 复合索引:用户ID + 创建时间(用于用户日记列表)
CREATE INDEX IF NOT EXISTS idx_emotionDiary_userId_createdAt ON emotionDiary(userId, createdAt DESC);

-- 医疗资源表索引
CREATE INDEX IF NOT EXISTS idx_medicalResources_type ON medicalResources(type);
CREATE INDEX IF NOT EXISTS idx_medicalResources_city ON medicalResources(city);
CREATE INDEX IF NOT EXISTS idx_medicalResources_province ON medicalResources(province);
CREATE INDEX IF NOT EXISTS idx_medicalResources_rating ON medicalResources(rating);
-- 复合索引:城市 + 类型(用于地区医疗资源查询)
CREATE INDEX IF NOT EXISTS idx_medicalResources_city_type ON medicalResources(city, type);
-- 复合索引:省份 + 评分(用于推荐优质资源)
CREATE INDEX IF NOT EXISTS idx_medicalResources_province_rating ON medicalResources(province, rating DESC);

-- 查看所有索引
-- SHOW INDEX FROM users;
-- SHOW INDEX FROM detectionRecords;
-- SHOW INDEX FROM emotionHistory;
-- SHOW INDEX FROM assessmentReports;
-- SHOW INDEX FROM dialogueRecords;
-- SHOW INDEX FROM emotionDiary;
-- SHOW INDEX FROM medicalResources;

-- 分析表以优化查询计划
ANALYZE TABLE users;
ANALYZE TABLE detectionRecords;
ANALYZE TABLE emotionHistory;
ANALYZE TABLE assessmentReports;
ANALYZE TABLE dialogueRecords;
ANALYZE TABLE emotionDiary;
ANALYZE TABLE medicalResources;
