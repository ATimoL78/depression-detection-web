import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, ArrowLeft, Activity, Zap, Loader2 } from "lucide-react";
import { Link, Redirect } from "wouter";
import Face3DPointCloud468 from "@/components/Face3DPointCloud468";
import AIAssistantEnhanced from "@/components/AIAssistantEnhanced";
import VoiceInterviewEnhanced from "@/components/VoiceInterviewEnhanced";

export default function RealtimeDetection() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const demoMode = true; // 演示模式
  const [detectionData, setDetectionData] = useState<any>(null);

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
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      {/* 顶部导航 */}
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold">实时智能识别</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">实时分析中</span>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧:3D点云可视化 */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  面部表情3D点云分析
                </CardTitle>
                <CardDescription>
                  基于468个面部关键点的实时3D建模和AU动作单元分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Face3DPointCloud468 
                  onDetectionResult={setDetectionData}
                />
              </CardContent>
            </Card>

            {/* 检测数据展示 */}
            {detectionData && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>实时分析数据</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-accent/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {detectionData.confidence?.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">检测置信度</div>
                    </div>
                    <div className="text-center p-4 bg-accent/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {detectionData.depressionRisk?.toFixed(0)}%
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">抑郁风险</div>
                    </div>
                    <div className="text-center p-4 bg-accent/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {detectionData.auCount || 8}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">AU分析</div>
                    </div>
                    <div className="text-center p-4 bg-accent/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {detectionData.pointCount || 468}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">点云数量</div>
                    </div>
                  </div>

                  {/* AU详细数据 */}
                  {detectionData.auValues && (
                    <div className="mt-6">
                      <h4 className="font-semibold mb-3">面部动作单元(AU)分析</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(detectionData.auValues).map(([au, value]: [string, any]) => (
                          <div key={au} className="flex items-center justify-between p-2 bg-accent/30 rounded">
                            <span className="text-sm font-medium">{au}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${Math.min(value * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground w-12 text-right">
                                {(value * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧:AI助手和语音访谈 */}
          <div className="lg:col-span-1 space-y-6">
            <AIAssistantEnhanced detectionData={detectionData} />
            <VoiceInterviewEnhanced />
          </div>
        </div>
      </div>
    </div>
  );
}
