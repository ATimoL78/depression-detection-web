import fs from "fs";
import path from "path";

// 数据存储路径
const dataDir = path.join(process.cwd(), 'data');
const statsFile = path.join(dataDir, 'statistics.json');
const visitorsFile = path.join(dataDir, 'visitors.json');
const testsFile = path.join(dataDir, 'tests.json');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 统计数据结构
interface Statistics {
  total_visitors: number;
  total_tests: number;
  face_detection_tests: number;
  phq9_assessments: number;
  gad7_assessments: number;
  emotion_diaries: number;
  voice_interviews: number;
  updated_at: string;
}

interface VisitorLog {
  ip_address: string;
  user_agent: string;
  page_path: string;
  visited_at: string;
}

interface TestLog {
  user_id: number | null;
  test_type: string;
  completed: boolean;
  result_data?: any;
  tested_at: string;
}

// 读取统计数据
function readStats(): Statistics {
  try {
    if (fs.existsSync(statsFile)) {
      const data = fs.readFileSync(statsFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Read stats error:', error);
  }
  
  // 默认统计数据
  return {
    total_visitors: 0,
    total_tests: 0,
    face_detection_tests: 0,
    phq9_assessments: 0,
    gad7_assessments: 0,
    emotion_diaries: 0,
    voice_interviews: 0,
    updated_at: new Date().toISOString(),
  };
}

// 写入统计数据
function writeStats(stats: Statistics) {
  try {
    stats.updated_at = new Date().toISOString();
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf-8');
  } catch (error) {
    console.error('Write stats error:', error);
  }
}

// 读取访问日志
function readVisitors(): VisitorLog[] {
  try {
    if (fs.existsSync(visitorsFile)) {
      const data = fs.readFileSync(visitorsFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Read visitors error:', error);
  }
  return [];
}

// 写入访问日志
function writeVisitors(visitors: VisitorLog[]) {
  try {
    // 只保留最近1000条记录
    const recentVisitors = visitors.slice(-1000);
    fs.writeFileSync(visitorsFile, JSON.stringify(recentVisitors, null, 2), 'utf-8');
  } catch (error) {
    console.error('Write visitors error:', error);
  }
}

// 读取测试日志
function readTests(): TestLog[] {
  try {
    if (fs.existsSync(testsFile)) {
      const data = fs.readFileSync(testsFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Read tests error:', error);
  }
  return [];
}

// 写入测试日志
function writeTests(tests: TestLog[]) {
  try {
    // 只保留最近1000条记录
    const recentTests = tests.slice(-1000);
    fs.writeFileSync(testsFile, JSON.stringify(recentTests, null, 2), 'utf-8');
  } catch (error) {
    console.error('Write tests error:', error);
  }
}

// 初始化统计表
export function initStatisticsTables() {
  try {
    const stats = readStats();
    writeStats(stats);
    console.log('[Statistics] JSON storage initialized successfully');
  } catch (error) {
    console.error('[Statistics] Init error:', error);
  }
}

// 记录访问
export function recordVisit(ipAddress: string, userAgent: string, pagePath: string) {
  try {
    const visitors = readVisitors();
    visitors.push({
      ip_address: ipAddress,
      user_agent: userAgent,
      page_path: pagePath,
      visited_at: new Date().toISOString(),
    });
    writeVisitors(visitors);
    incrementMetric('total_visitors');
  } catch (error) {
    console.error('Record visit error:', error);
  }
}

// 记录测试
export function recordTest(userId: number | null, testType: string, completed: boolean, resultData?: any) {
  try {
    const tests = readTests();
    tests.push({
      user_id: userId,
      test_type: testType,
      completed,
      result_data: resultData,
      tested_at: new Date().toISOString(),
    });
    writeTests(tests);

    incrementMetric('total_tests');
    
    const metricMap: Record<string, keyof Statistics> = {
      'face': 'face_detection_tests',
      'phq9': 'phq9_assessments',
      'gad7': 'gad7_assessments',
      'diary': 'emotion_diaries',
      'voice': 'voice_interviews',
    };

    const metricName = metricMap[testType];
    if (metricName) {
      incrementMetric(metricName);
    }
  } catch (error) {
    console.error('Record test error:', error);
  }
}

// 增加指标计数
export function incrementMetric(metricName: keyof Statistics, amount: number = 1) {
  try {
    if (metricName === 'updated_at') return;
    
    const stats = readStats();
    const currentValue = stats[metricName] as number;
    stats[metricName] = (currentValue || 0) + amount as any;
    writeStats(stats);
  } catch (error) {
    console.error('Increment metric error:', error);
  }
}

// 获取指标值
export function getMetric(metricName: keyof Statistics): number {
  try {
    const stats = readStats();
    return (stats[metricName] as number) || 0;
  } catch (error) {
    console.error('Get metric error:', error);
    return 0;
  }
}

// 获取所有统计数据
export function getAllStatistics() {
  try {
    const stats = readStats();
    const result: Record<string, any> = {};
    
    Object.entries(stats).forEach(([key, value]) => {
      result[key] = {
        value: value,
        updatedAt: stats.updated_at,
      };
    });

    return result;
  } catch (error) {
    console.error('Get all statistics error:', error);
    return {};
  }
}

// 获取今日统计
export function getTodayStatistics() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const visitors = readVisitors();
    const tests = readTests();

    const todayVisitors = visitors.filter(v => v.visited_at.startsWith(today)).length;
    const todayTests = tests.filter(t => t.tested_at.startsWith(today)).length;

    return {
      todayVisitors,
      todayTests,
    };
  } catch (error) {
    console.error('Get today statistics error:', error);
    return { todayVisitors: 0, todayTests: 0 };
  }
}

// 获取最近7天统计
export function getWeeklyStatistics() {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const visitors = readVisitors();
    const tests = readTests();

    const weeklyVisitors = visitors.filter(v => v.visited_at >= weekAgoStr).length;
    const weeklyTests = tests.filter(t => t.tested_at >= weekAgoStr).length;

    return {
      weeklyVisitors,
      weeklyTests,
    };
  } catch (error) {
    console.error('Get weekly statistics error:', error);
    return { weeklyVisitors: 0, weeklyTests: 0 };
  }
}

// 获取测试完成率
export function getTestCompletionRate() {
  try {
    const tests = readTests();
    const totalCount = tests.length;
    const completedCount = tests.filter(t => t.completed).length;

    return {
      total: totalCount,
      completed: completedCount,
      rate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  } catch (error) {
    console.error('Get test completion rate error:', error);
    return { total: 0, completed: 0, rate: 0 };
  }
}

// 获取热门测试类型
export function getPopularTestTypes() {
  try {
    const tests = readTests();
    const typeCount: Record<string, number> = {};

    tests.forEach(t => {
      typeCount[t.test_type] = (typeCount[t.test_type] || 0) + 1;
    });

    const result = Object.entries(typeCount)
      .map(([test_type, count]) => ({ test_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return result;
  } catch (error) {
    console.error('Get popular test types error:', error);
    return [];
  }
}

// 初始化统计
initStatisticsTables();
