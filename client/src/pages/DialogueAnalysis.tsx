import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, ArrowLeft, Loader2, Send } from "lucide-react";
import { Link, Redirect, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function DialogueAnalysis() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [content, setContent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const analyzeMutation = trpc.dialogueAnalysis.analyze.useMutation({
    onSuccess: (data) => {
      if (data.success && 'detectionId' in data) {
        toast.success("分析完成!");
        setLocation(`/detection/result?type=dialogue&id=${data.detectionId}`);
      } else {
        toast.error(data.error || "分析失败");
      }
      setAnalyzing(false);
    },
    onError: (error) => {
      toast.error("分析失败: " + error.message);
      setAnalyzing(false);
    },
  });

  const handleAnalyze = () => {
    if (content.trim().length < 10) {
      toast.error("请输入至少10个字符的内容");
      return;
    }
    setAnalyzing(true);
    analyzeMutation.mutate({ content: content.trim() });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

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
            <MessageSquare className="w-6 h-6 text-secondary" />
            <span className="text-lg font-semibold">对话语义分析</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* 输入区域 */}
          <Card>
            <CardHeader>
              <CardTitle>输入对话内容</CardTitle>
              <CardDescription>
                请真实表达您的感受和想法,我们将通过语义分析帮助您了解情绪状态
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="在这里输入您想说的话...&#10;&#10;例如:&#10;- 最近感觉很累,对什么都提不起兴趣&#10;- 总是失眠,脑子里想很多事情&#10;- 感觉自己做什么都不对..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[300px] resize-none"
                disabled={analyzing}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {content.length} 字符 {content.length < 10 && "(至少10个字符)"}
                </span>
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing || content.trim().length < 10}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      开始分析
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 使用提示 */}
          <Card className="bg-accent/20 border-accent">
            <CardHeader>
              <CardTitle className="text-lg">使用提示</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>• 请真实表达您的感受,不要刻意隐藏情绪</p>
              <p>• 可以描述最近的生活状态、心情变化等</p>
              <p>• 内容越详细,分析结果越准确</p>
              <p>• 您的对话内容将被加密存储,仅您本人可见</p>
            </CardContent>
          </Card>

          {/* 示例对话 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">示例参考</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground italic">
                  "最近总是感觉很疲惫,早上起床就觉得累,对工作也提不起兴趣。
                  以前喜欢的事情现在都不想做了,总觉得自己什么都做不好..."
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground italic">
                  "睡眠质量很差,经常失眠,脑子里总是想很多事情。
                  白天注意力也不集中,感觉和朋友的交流也变少了..."
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
