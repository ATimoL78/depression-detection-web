import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, MessageSquare, FileText, BookOpen, Activity, Settings, Zap, ClipboardList, TrendingUp, Heart } from "lucide-react";
import HelpDialog from "@/components/HelpDialog";
import SiteStatistics from "@/components/SiteStatistics";
import { Link, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  
  // 演示模式:使用默认用户
  const demoUser = user || { id: 1, name: '演示用户', email: 'demo@example.com' };
  const { data: statistics } = trpc.history.getStatistics.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // 演示模式:移除登录验证
  // if (!isAuthenticated) {
  //   return <Redirect to="/" />;
  // }

  const quickActions = [
    {
      title: "实时智能识别",
      description: "实时面部识别 + AI心理助手,专业级分析",
      icon: Zap,
      href: "/detection/realtime",
      color: "text-primary",
      bgColor: "bg-gradient-to-br from-primary/10 to-secondary/10",
      featured: true,
    },
    {
      title: "面部识别",
      description: "通过摄像头或上传图片进行面部表情分析",
      icon: Brain,
      href: "/detection/face",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "对话分析",
      description: "输入文字或语音进行情绪语义分析",
      icon: MessageSquare,
      href: "/detection/dialogue",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "评估报告",
      description: "查看历史评估报告和建议",
      icon: FileText,
      href: "/reports",
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "情绪日记",
      description: "记录每日情绪,追踪心理状态",
      icon: BookOpen,
      href: "/emotion-diary",
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
    {
      title: "标准化量表",
      description: "PHQ-9/GAD-7专业评估",
      icon: ClipboardList,
      href: "/assessment",
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
    },
    {
      title: "趋势分析",
      description: "可视化数据分析和洞察",
      icon: TrendingUp,
      href: "/trend-analysis",
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold">控制台</span>
          </div>
          <div className="ml-auto">
            <HelpDialog />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">欢迎, {demoUser.name}</span>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 网站统计 */}
        <div className="mb-8">
          <SiteStatistics />
        </div>
    {/* 统计概览 */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>总识别次数</CardDescription>
              <CardTitle className="text-3xl">{statistics?.totalDetections || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>评估报告</CardDescription>
              <CardTitle className="text-3xl">{statistics?.totalReports || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>情绪日记</CardDescription>
              <CardTitle className="text-3xl">{statistics?.totalDiaries || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>当前状态</CardDescription>
              <CardTitle className="text-xl">
                {statistics?.latestRiskLevel === 'low' && (
                  <span className="text-secondary">良好</span>
                )}
                {statistics?.latestRiskLevel === 'medium' && (
                  <span className="text-chart-4">关注</span>
                )}
                {statistics?.latestRiskLevel === 'high' && (
                  <span className="text-destructive">需要关注</span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* 快速操作 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">快速操作</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action: any) => (
              <Link key={action.href} href={action.href}>
                <Card className={`hover:border-primary/50 transition-all cursor-pointer h-full ${
                  action.featured ? 'border-2 border-primary/30 shadow-lg' : ''
                }`}>
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${action.bgColor} flex items-center justify-center mb-3`}>
                      <action.icon className={`w-6 h-6 ${action.color} ${
                        action.featured ? 'animate-pulse' : ''
                      }`} />
                    </div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {action.title}
                      {action.featured && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          推荐
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* 最近活动 */}
        <div>
          <h2 className="text-2xl font-bold mb-4">其他功能</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/history">
              <Card className="hover:border-primary/50 transition-all cursor-pointer">
                <CardHeader>
                  <Activity className="w-8 h-8 text-primary mb-2" />
                  <CardTitle className="text-lg">识别历史</CardTitle>
                  <CardDescription>查看所有识别记录和情绪趋势</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/medical">
              <Card className="hover:border-primary/50 transition-all cursor-pointer">
                <CardHeader>
                  <FileText className="w-8 h-8 text-secondary mb-2" />
                  <CardTitle className="text-lg">医疗资源</CardTitle>
                  <CardDescription>查找专业心理咨询和医疗机构</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/tools">
              <Card className="hover:border-primary/50 transition-all cursor-pointer">
                <CardHeader>
                  <BookOpen className="w-8 h-8 text-chart-3 mb-2" />
                  <CardTitle className="text-lg">情绪工具</CardTitle>
                  <CardDescription>正念冥想、心理暗示等疏导工具</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
