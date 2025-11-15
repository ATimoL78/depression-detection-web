import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Loader2, Activity, Brain, Calendar } from "lucide-react";
import { Link, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar } from "recharts";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function TrendAnalysis() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const demoMode = true; // 演示模式

  const { data: moodTrend, isLoading: moodLoading } = trpc.analytics.getMoodTrend.useQuery({ days: 30 });
  const { data: phq9History, isLoading: phq9Loading } = trpc.analytics.getPHQ9History.useQuery();
  const { data: auPattern, isLoading: auLoading } = trpc.analytics.getAUPattern.useQuery();
  const { data: activityStats, isLoading: activityLoading } = trpc.analytics.getActivityStats.useQuery({ days: 30 });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 演示模式:移除登录验证
  // if (!isAuthenticated) {
  //   return <Redirect to="/" />;
  // }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold">趋势分析</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
          {/* 情绪趋势图 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                30天情绪趋势
              </CardTitle>
              <CardDescription>
                跟踪您的日常心情变化,了解情绪波动模式
              </CardDescription>
            </CardHeader>
            <CardContent>
              {moodLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : moodTrend && moodTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={moodTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), "MM/dd", { locale: zhCN })}
                    />
                    <YAxis domain={[1, 10]} />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), "yyyy年MM月dd日", { locale: zhCN })}
                      formatter={(value: number) => [`${value}/10`, "心情评分"]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="mood" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="心情评分"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无情绪数据</p>
                  <p className="text-sm mt-1">开始记录情绪日记来查看趋势</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PHQ-9评分历史 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                PHQ-9评分变化
              </CardTitle>
              <CardDescription>
                抑郁症筛查评分历史记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              {phq9Loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : phq9History && phq9History.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={phq9History}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), "MM/dd", { locale: zhCN })}
                    />
                    <YAxis domain={[0, 27]} />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), "yyyy年MM月dd日", { locale: zhCN })}
                      formatter={(value: number, name: string, props: any) => {
                        const severity = props.payload.severity;
                        return [`${value}/27 (${severity})`, "PHQ-9评分"];
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="PHQ-9评分"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无PHQ-9评估数据</p>
                  <p className="text-sm mt-1">完成PHQ-9评估来查看趋势</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AU面部动作单元模式 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  面部表情模式
                </CardTitle>
                <CardDescription>
                  基于AU动作单元的平均表情分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : auPattern && auPattern.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={auPattern}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="au" />
                      <PolarRadiusAxis domain={[0, 5]} />
                      <Radar 
                        name="平均强度" 
                        dataKey="value" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.6} 
                      />
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无面部表情数据</p>
                    <p className="text-sm mt-1">进行面部检测来查看模式</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 活动统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  活动统计
                </CardTitle>
                <CardDescription>
                  30天内各类活动的频率
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : activityStats && activityStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={activityStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="activity" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" name="次数" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无活动数据</p>
                    <p className="text-sm mt-1">在情绪日记中记录活动</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 洞察和建议 */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle>AI洞察和建议</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-card rounded-lg border">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    积极趋势
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• 近7天情绪评分稳定在6分以上</li>
                    <li>• 运动锻炼频率有所增加</li>
                    <li>• 社交活动参与度提升</li>
                  </ul>
                </div>

                <div className="p-4 bg-card rounded-lg border">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-orange-600" />
                    需要关注
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• 睡眠质量波动较大</li>
                    <li>• 工作压力相关情绪低落</li>
                    <li>• 建议增加放松活动</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>个性化建议:</strong> 根据您的数据分析,建议保持规律的运动习惯,
                  每周至少3次有氧运动;同时增加正念冥想练习,帮助改善睡眠质量和情绪稳定性。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
