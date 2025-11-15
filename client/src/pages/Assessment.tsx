import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ClipboardList, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const PHQ9_QUESTIONS = [
  "做事时提不起劲或没有兴趣",
  "感到心情低落、沮丧或绝望",
  "入睡困难、睡不安稳或睡眠过多",
  "感觉疲倦或没有活力",
  "食欲不振或吃太多",
  "觉得自己很糟糕,或觉得自己很失败,或让自己或家人失望",
  "对事物专注有困难,例如阅读报纸或看电视时",
  "动作或说话速度缓慢到别人已经察觉?或正好相反,烦躁或坐立不安、动来动去的情况更胜于平常",
  "有不如死掉或用某种方式伤害自己的念头"
];

const GAD7_QUESTIONS = [
  "感觉紧张、焦虑或急切",
  "不能够停止或控制担忧",
  "对各种各样的事情担忧过多",
  "很难放松下来",
  "由于不安而无法静坐",
  "变得容易烦恼或急躁",
  "感到似乎将有可怕的事情发生而害怕"
];

const OPTIONS = [
  { value: 0, label: "完全不会" },
  { value: 1, label: "好几天" },
  { value: 2, label: "一半以上的天数" },
  { value: 3, label: "几乎每天" }
];

export default function Assessment() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  // 演示模式:移除登录验证
  const demoMode = true;
  const [phq9Answers, setPhq9Answers] = useState<number[]>(Array(9).fill(-1));
  const [gad7Answers, setGad7Answers] = useState<number[]>(Array(7).fill(-1));
  const [activeTab, setActiveTab] = useState<"phq9" | "gad7">("phq9");

  const savePHQ9Mutation = trpc.assessment.savePHQ9.useMutation({
    onSuccess: () => {
      toast.success("PHQ-9评估结果已保存");
    },
    onError: (error) => {
      toast.error("保存失败: " + error.message);
    }
  });

  const saveGAD7Mutation = trpc.assessment.saveGAD7.useMutation({
    onSuccess: () => {
      toast.success("GAD-7评估结果已保存");
    },
    onError: (error) => {
      toast.error("保存失败: " + error.message);
    }
  });

  const phq9Total = phq9Answers.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0);
  const gad7Total = gad7Answers.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0);

  const getPHQ9Severity = (score: number) => {
    if (score < 5) return { level: "无抑郁", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/20", borderColor: "border-green-200 dark:border-green-800" };
    if (score < 10) return { level: "轻度抑郁", color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-950/20", borderColor: "border-yellow-200 dark:border-yellow-800" };
    if (score < 15) return { level: "中度抑郁", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/20", borderColor: "border-orange-200 dark:border-orange-800" };
    if (score < 20) return { level: "中重度抑郁", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/20", borderColor: "border-red-200 dark:border-red-800" };
    return { level: "重度抑郁", color: "text-red-800", bgColor: "bg-red-100 dark:bg-red-950/40", borderColor: "border-red-300 dark:border-red-700" };
  };

  const getGAD7Severity = (score: number) => {
    if (score < 5) return { level: "轻度焦虑", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/20", borderColor: "border-green-200 dark:border-green-800" };
    if (score < 10) return { level: "中度焦虑", color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-950/20", borderColor: "border-yellow-200 dark:border-yellow-800" };
    if (score < 15) return { level: "中重度焦虑", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/20", borderColor: "border-orange-200 dark:border-orange-800" };
    return { level: "重度焦虑", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/20", borderColor: "border-red-200 dark:border-red-800" };
  };

  const handleSavePHQ9 = () => {
    const severity = getPHQ9Severity(phq9Total);
    savePHQ9Mutation.mutate({
      answers: phq9Answers,
      totalScore: phq9Total,
      severity: severity.level
    });
  };

  const handleSaveGAD7 = () => {
    const severity = getGAD7Severity(gad7Total);
    saveGAD7Mutation.mutate({
      answers: gad7Answers,
      totalScore: gad7Total,
      severity: severity.level
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
            <ClipboardList className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold">标准化量表评估</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 说明卡片 */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              关于标准化量表
            </CardTitle>
            <CardDescription>
              PHQ-9和GAD-7是国际通用的抑郁症和焦虑症筛查工具,被广泛应用于临床诊断和研究。
              请根据过去两周的实际情况如实填写,评估结果仅供参考,不能替代专业诊断。
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 量表标签页 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "phq9" | "gad7")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phq9">PHQ-9 抑郁症筛查</TabsTrigger>
            <TabsTrigger value="gad7">GAD-7 焦虑症筛查</TabsTrigger>
          </TabsList>

          {/* PHQ-9 */}
          <TabsContent value="phq9" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>PHQ-9 患者健康问卷</CardTitle>
                <CardDescription>
                  在过去两周内,您被以下问题困扰的频率如何?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {PHQ9_QUESTIONS.map((question, index) => (
                  <div key={index} className="space-y-3 pb-4 border-b last:border-0">
                    <p className="font-medium">
                      {index + 1}. {question}
                    </p>
                    <RadioGroup
                      value={phq9Answers[index]?.toString()}
                      onValueChange={(val) => {
                        const newAnswers = [...phq9Answers];
                        newAnswers[index] = parseInt(val);
                        setPhq9Answers(newAnswers);
                      }}
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {OPTIONS.map(opt => (
                          <div key={opt.value} className="flex items-center gap-2 p-2 rounded border hover:bg-accent cursor-pointer">
                            <RadioGroupItem value={opt.value.toString()} id={`phq9-${index}-${opt.value}`} />
                            <Label htmlFor={`phq9-${index}-${opt.value}`} className="cursor-pointer flex-1">
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                ))}

                {/* 评估结果 */}
                {phq9Answers.every(a => a >= 0) && (
                  <div className={`mt-6 p-6 rounded-lg border ${getPHQ9Severity(phq9Total).bgColor} ${getPHQ9Severity(phq9Total).borderColor}`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">总分</p>
                        <p className="text-4xl font-bold">{phq9Total}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-sm text-muted-foreground mb-1">评估结果</p>
                        <p className={`text-2xl font-bold ${getPHQ9Severity(phq9Total).color}`}>
                          {getPHQ9Severity(phq9Total).level}
                        </p>
                      </div>
                    </div>

                    {/* 评分说明 */}
                    <div className="text-sm space-y-2 mb-4">
                      <p className="font-medium">评分标准:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>• 0-4分: 无抑郁</div>
                        <div>• 5-9分: 轻度抑郁</div>
                        <div>• 10-14分: 中度抑郁</div>
                        <div>• 15-19分: 中重度抑郁</div>
                        <div className="col-span-2">• 20-27分: 重度抑郁</div>
                      </div>
                    </div>

                    {/* 建议 */}
                    {phq9Total >= 10 && (
                      <div className="flex items-start gap-2 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium mb-1">专业建议:</p>
                          <p>您的评分显示可能存在中度以上抑郁症状,建议尽快咨询专业心理医生或精神科医生,获取专业评估和治疗方案。</p>
                        </div>
                      </div>
                    )}

                    <Button 
                      onClick={handleSavePHQ9} 
                      disabled={savePHQ9Mutation.isPending}
                      className="w-full mt-4"
                      size="lg"
                    >
                      {savePHQ9Mutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        "保存评估结果"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GAD-7 */}
          <TabsContent value="gad7" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>GAD-7 广泛性焦虑问卷</CardTitle>
                <CardDescription>
                  在过去两周内,您被以下问题困扰的频率如何?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {GAD7_QUESTIONS.map((question, index) => (
                  <div key={index} className="space-y-3 pb-4 border-b last:border-0">
                    <p className="font-medium">
                      {index + 1}. {question}
                    </p>
                    <RadioGroup
                      value={gad7Answers[index]?.toString()}
                      onValueChange={(val) => {
                        const newAnswers = [...gad7Answers];
                        newAnswers[index] = parseInt(val);
                        setGad7Answers(newAnswers);
                      }}
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {OPTIONS.map(opt => (
                          <div key={opt.value} className="flex items-center gap-2 p-2 rounded border hover:bg-accent cursor-pointer">
                            <RadioGroupItem value={opt.value.toString()} id={`gad7-${index}-${opt.value}`} />
                            <Label htmlFor={`gad7-${index}-${opt.value}`} className="cursor-pointer flex-1">
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                ))}

                {/* 评估结果 */}
                {gad7Answers.every(a => a >= 0) && (
                  <div className={`mt-6 p-6 rounded-lg border ${getGAD7Severity(gad7Total).bgColor} ${getGAD7Severity(gad7Total).borderColor}`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">总分</p>
                        <p className="text-4xl font-bold">{gad7Total}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-sm text-muted-foreground mb-1">评估结果</p>
                        <p className={`text-2xl font-bold ${getGAD7Severity(gad7Total).color}`}>
                          {getGAD7Severity(gad7Total).level}
                        </p>
                      </div>
                    </div>

                    {/* 评分说明 */}
                    <div className="text-sm space-y-2 mb-4">
                      <p className="font-medium">评分标准:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>• 0-5分: 轻度焦虑</div>
                        <div>• 6-10分: 中度焦虑</div>
                        <div>• 11-15分: 中重度焦虑</div>
                        <div>• 15-21分: 重度焦虑</div>
                      </div>
                    </div>

                    {/* 建议 */}
                    {gad7Total >= 10 && (
                      <div className="flex items-start gap-2 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium mb-1">专业建议:</p>
                          <p>您的评分显示可能存在中度以上焦虑症状,建议咨询专业心理医生,学习焦虑管理技巧,必要时接受专业治疗。</p>
                        </div>
                      </div>
                    )}

                    <Button 
                      onClick={handleSaveGAD7} 
                      disabled={saveGAD7Mutation.isPending}
                      className="w-full mt-4"
                      size="lg"
                    >
                      {saveGAD7Mutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        "保存评估结果"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 免责声明 */}
        <Card className="mt-6 bg-muted/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">免责声明:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>本评估仅用于初步筛查,不能替代专业医学诊断</li>
              <li>如有严重症状或自杀倾向,请立即寻求专业帮助</li>
              <li>24小时心理援助热线: 400-161-9995</li>
              <li>紧急情况请拨打120或前往最近的医院急诊</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
