import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, TrendingUp, CheckCircle, Eye, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Statistics {
  totalVisitors: number;
  totalTests: number;
  faceDetectionTests: number;
  phq9Assessments: number;
  gad7Assessments: number;
  emotionDiaries: number;
  voiceInterviews: number;
  todayVisitors: number;
  todayTests: number;
  weeklyVisitors: number;
  weeklyTests: number;
  completionRate: number;
}

export default function SiteStatistics() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
    
    // 每30秒刷新一次统计数据
    const interval = setInterval(fetchStatistics, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/statistics');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    {
      title: "总访问量",
      value: stats.totalVisitors.toLocaleString(),
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      description: `今日: ${stats.todayVisitors} | 本周: ${stats.weeklyVisitors}`,
    },
    {
      title: "总测试次数",
      value: stats.totalTests.toLocaleString(),
      icon: Activity,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      description: `今日: ${stats.todayTests} | 本周: ${stats.weeklyTests}`,
    },
    {
      title: "面部识别",
      value: stats.faceDetectionTests.toLocaleString(),
      icon: Eye,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      description: "3D点云检测次数",
    },
    {
      title: "量表评估",
      value: (stats.phq9Assessments + stats.gad7Assessments).toLocaleString(),
      icon: CheckCircle,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      description: `PHQ-9: ${stats.phq9Assessments} | GAD-7: ${stats.gad7Assessments}`,
    },
    {
      title: "情绪日记",
      value: stats.emotionDiaries.toLocaleString(),
      icon: Calendar,
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950/20",
      description: "用户记录次数",
    },
    {
      title: "语音访谈",
      value: stats.voiceInterviews.toLocaleString(),
      icon: TrendingUp,
      color: "text-cyan-500",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
      description: "AI语音问答次数",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📊 网站使用统计</h3>
        <div className="text-sm text-muted-foreground">
          实时更新 • 完成率: {stats.completionRate}%
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                <span className="text-muted-foreground">{card.title}</span>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${card.color}`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 使用提示 */}
      <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded">
        💡 统计数据每30秒自动更新 • 数据仅用于展示系统使用情况,不涉及个人隐私
      </div>
    </div>
  );
}
