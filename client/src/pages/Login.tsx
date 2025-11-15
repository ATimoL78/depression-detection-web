import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();

  const handleDemoLogin = () => {
    // 演示模式:直接跳转到Dashboard
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Brain className="w-10 h-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">抑郁症检测系统</CardTitle>
          <CardDescription>
            关注心理健康,从了解自己开始
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>演示模式 - 无需登录</p>
            <p className="mt-2">点击下方按钮直接体验系统功能</p>
          </div>
          
          <Button 
            onClick={handleDemoLogin}
            className="w-full"
            size="lg"
          >
            进入演示模式
          </Button>

          <div className="text-xs text-center text-muted-foreground mt-4">
            <p>⚠️ 本系统仅用于初步筛查,不能替代专业医学诊断</p>
            <p className="mt-1">如有严重症状请拨打心理援助热线: 400-161-9995</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
