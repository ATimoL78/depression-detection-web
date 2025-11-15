import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, BookOpen, Loader2, Sparkles, TrendingUp, Calendar } from "lucide-react";
import { Link, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const MOOD_EMOJIS = ["😢", "😔", "😐", "🙂", "😊", "😄", "🤗", "😁", "🥳", "🤩"];
const MOOD_LABELS = ["很糟糕", "糟糕", "不太好", "一般", "还可以", "不错", "很好", "非常好", "极好", "完美"];

const ACTIVITY_OPTIONS = [
  "工作/学习", "运动锻炼", "社交活动", "休闲娱乐",
  "阅读", "看电影/剧", "听音乐", "冥想/瑜伽",
  "户外活动", "创作/艺术", "烹饪", "睡眠休息"
];

export default function EmotionDiary() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const demoMode = true; // 演示模式
  const [mood, setMood] = useState(5);
  const [activities, setActivities] = useState<string[]>([]);
  const [thoughts, setThoughts] = useState("");
  const [feelings, setFeelings] = useState("");
  const [behaviors, setBehaviors] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{
    negativePatterns: string[];
    suggestions: string[];
  } | undefined>(undefined);

  const saveDiaryMutation = trpc.diary.save.useMutation({
    onSuccess: () => {
      toast.success("日记已保存");
      // 重置表单
      setMood(5);
      setActivities([]);
      setThoughts("");
      setFeelings("");
      setBehaviors("");
      setAiAnalysis(undefined);
    },
    onError: (error) => {
      toast.error("保存失败: " + error.message);
    }
  });

  const { data: recentEntries, isLoading: entriesLoading } = trpc.diary.getRecent.useQuery({ limit: 5 });

  const toggleActivity = (activity: string) => {
    setActivities(prev =>
      prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    );
  };

  const handleAnalyze = async () => {
    if (!thoughts && !feelings) {
      toast.error("请至少填写思维或感受内容");
      return;
    }

    setAiAnalyzing(true);
    try {
      // 调用AI分析API
      const response = await fetch("/api/analyze-diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thoughts, feelings })
      });

      if (!response.ok) throw new Error("分析失败");

      const result = await response.json();
      setAiAnalysis(result);
      toast.success("AI分析完成");
    } catch (error) {
      toast.error("AI分析失败,请稍后重试");
      console.error(error);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (!thoughts && !feelings && !behaviors) {
      toast.error("请至少填写一项内容");
      return;
    }

    saveDiaryMutation.mutate({
      date: new Date(),
      mood,
      activities,
      thoughts,
      feelings,
      behaviors,
      aiAnalysis
    });
  };

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
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold">情绪日记</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧: 日记编写 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 日期和心情 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {format(new Date(), "yyyy年MM月dd日 EEEE", { locale: zhCN })}
                </CardTitle>
                <CardDescription>记录今天的心情和想法</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 心情评分 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-medium">今天的心情如何?</label>
                    <div className="text-right">
                      <div className="text-3xl">{MOOD_EMOJIS[mood - 1]}</div>
                      <div className="text-sm text-muted-foreground">{MOOD_LABELS[mood - 1]}</div>
                    </div>
                  </div>
                  <Slider
                    value={[mood]}
                    onValueChange={([val]) => setMood(val)}
                    min={1}
                    max={10}
                    step={1}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>很糟糕</span>
                    <span>一般</span>
                    <span>完美</span>
                  </div>
                </div>

                {/* 活动选择 */}
                <div>
                  <label className="font-medium mb-3 block">今天做了什么?</label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {ACTIVITY_OPTIONS.map(activity => (
                      <Button
                        key={activity}
                        variant={activities.includes(activity) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleActivity(activity)}
                        className="text-xs"
                      >
                        {activity}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CBT思维记录 */}
            <Card>
              <CardHeader>
                <CardTitle>CBT思维记录</CardTitle>
                <CardDescription>
                  认知行为疗法(CBT)核心工具 - 记录事件、想法、感受和行为
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="font-medium mb-2 block">
                    1. 发生了什么事? <span className="text-sm text-muted-foreground">(情境)</span>
                  </label>
                  <Textarea
                    value={thoughts}
                    onChange={(e) => setThoughts(e.target.value)}
                    placeholder="描述今天发生的具体事情,尽可能客观详细..."
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div>
                  <label className="font-medium mb-2 block">
                    2. 你的感受是什么? <span className="text-sm text-muted-foreground">(情绪)</span>
                  </label>
                  <Textarea
                    value={feelings}
                    onChange={(e) => setFeelings(e.target.value)}
                    placeholder="描述你的情绪和感受,例如:焦虑、悲伤、愤怒、失望..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div>
                  <label className="font-medium mb-2 block">
                    3. 你做了什么? <span className="text-sm text-muted-foreground">(行为)</span>
                  </label>
                  <Textarea
                    value={behaviors}
                    onChange={(e) => setBehaviors(e.target.value)}
                    placeholder="描述你的行为反应,例如:回避、发脾气、倾诉、运动..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <Button
                  onClick={handleAnalyze}
                  disabled={aiAnalyzing || (!thoughts && !feelings)}
                  variant="outline"
                  className="w-full"
                >
                  {aiAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AI分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI思维模式分析
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* AI分析结果 */}
            {aiAnalysis && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    AI思维模式分析
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {aiAnalysis.negativePatterns.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-500 rounded-full" />
                        识别到的负面思维模式:
                      </h4>
                      <ul className="space-y-1">
                        {aiAnalysis.negativePatterns.map((pattern, i) => (
                          <li key={i} className="text-sm pl-4 border-l-2 border-orange-300 py-1">
                            {pattern}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiAnalysis.suggestions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        认知重构建议:
                      </h4>
                      <ul className="space-y-1">
                        {aiAnalysis.suggestions.map((suggestion, i) => (
                          <li key={i} className="text-sm pl-4 border-l-2 border-green-300 py-1 text-green-700 dark:text-green-300">
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 保存按钮 */}
            <Button
              onClick={handleSave}
              disabled={saveDiaryMutation.isPending}
              size="lg"
              className="w-full"
            >
              {saveDiaryMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存日记"
              )}
            </Button>
          </div>

          {/* 右侧: 最近日记 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  最近日记
                </CardTitle>
              </CardHeader>
              <CardContent>
                {entriesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : recentEntries && recentEntries.length > 0 ? (
                  <div className="space-y-3">
                    {recentEntries.map((entry: any) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(entry.date), "MM月dd日", { locale: zhCN })}
                          </span>
                          <span className="text-xl">{MOOD_EMOJIS[entry.mood - 1]}</span>
                        </div>
                        {entry.thoughts && (
                          <p className="text-sm line-clamp-2 text-muted-foreground">
                            {entry.thoughts}
                          </p>
                        )}
                        {entry.activities && entry.activities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {entry.activities.slice(0, 3).map((activity: string, i: number) => (
                              <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {activity}
                              </span>
                            ))}
                            {entry.activities.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{entry.activities.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">还没有日记记录</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 提示卡片 */}
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-2">💡 写日记的好处:</p>
                <ul className="space-y-1 text-xs">
                  <li>• 帮助识别负面思维模式</li>
                  <li>• 提高情绪觉察能力</li>
                  <li>• 跟踪心理健康变化趋势</li>
                  <li>• 为专业咨询提供参考</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
