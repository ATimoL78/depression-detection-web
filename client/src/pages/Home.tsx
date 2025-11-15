import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Brain, MessageSquare, FileText, Heart, Shield, TrendingUp, Sparkles, Zap } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute top-0 left-0 w-full h-full opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}} />
        </div>
      </div>

      {/* 顶部导航 */}
      <nav className="border-b bg-card/60 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">{APP_TITLE}</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground">欢迎, {user?.name}</span>
                <Link href="/dashboard">
                  <Button variant="outline">控制台</Button>
                </Link>
              </>
            ) : (
              <Link href="/login">
                <Button>登录</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="relative py-32 px-4 overflow-hidden">
        {/* Hero背景 */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
          <img 
            src="/hero-bg.jpg" 
            alt="background" 
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        
        <div className="container mx-auto text-center space-y-8 relative">
          <h1 className="text-5xl md:text-7xl font-bold animate-fade-in">
            <span className="text-foreground drop-shadow-sm">关注心理健康</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              从了解自己开始
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.2s'}}>
            结合面部表情识别与对话语义分析,为您提供专业的抑郁倾向筛查服务。
            <br />
            <span className="text-primary font-medium">我们致力于用科技守护每一颗心灵。</span>
          </p>
          <div className="flex gap-4 justify-center pt-8 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
            {isAuthenticated ? (
              <>
                <Link href="/detection/realtime">
                  <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all shadow-lg hover:shadow-xl">
                    <Zap className="w-5 h-5 mr-2 animate-pulse" />
                    实时智能识别
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="lg" variant="outline" className="text-lg px-8 shadow-lg hover:shadow-xl">
                    查看控制台
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/login">
                <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all shadow-lg hover:shadow-xl">
                  <Sparkles className="w-5 h-5 mr-2" />
                  立即体验
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 核心功能 */}
      <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">核心功能</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 hover:border-primary/50 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center mb-4">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">面部表情识别</CardTitle>
                <CardDescription className="text-base">
                  通过先进的计算机视觉技术,精准识别面部关键肌肉群的收缩频率、幅度、对称性,
                  结合抑郁症患者常见面部特征建立识别模型
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ 实时摄像头捕捉或图片上传</li>
                  <li>✓ 识别眉头紧锁、口角下垂等特征</li>
                  <li>✓ 分析面部肌肉运动(AU)</li>
                  <li>✓ 生成可视化分析报告</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 border-2 hover:border-secondary/50 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/20 flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-secondary" />
                </div>
                <CardTitle className="text-2xl">对话语义分析</CardTitle>
                <CardDescription className="text-base">
                  运用自然语言处理技术,深度分析对话中的负面情绪词汇、语义倾向、句式特征,
                  评估心理语言学特征
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ 支持文字输入和语音录入</li>
                  <li>✓ 识别负面情绪倾向</li>
                  <li>✓ 分析语义倾向和句式特征</li>
                  <li>✓ 评估心理健康状态</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 特色服务 */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">特色服务</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-xl transition-all duration-300 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
              <CardHeader>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-blue-500" />
                </div>
                <CardTitle className="text-xl">专业评估报告</CardTitle>
                <CardDescription>
                  综合面部识别和对话分析结果,生成详细的心理健康评估报告,提供专业建议
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-xl transition-all duration-300 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              <CardHeader>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-10 h-10 text-green-500" />
                </div>
                <CardTitle className="text-xl">情绪疏导工具</CardTitle>
                <CardDescription>
                  提供正念冥想指导、情绪日记记录、积极心理训练等工具,帮助改善情绪状态
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-xl transition-all duration-300 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
              <CardHeader>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-10 h-10 text-purple-500" />
                </div>
                <CardTitle className="text-xl">数据趋势分析</CardTitle>
                <CardDescription>
                  记录并追踪您的情绪变化趋势,通过可视化图表更好地了解自己的心理状态
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* 隐私与安全 */}
      <section className="py-20 px-4 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-3xl p-12 border-2 border-primary/10">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                <Shield className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4">隐私与安全保护</h2>
              <p className="text-muted-foreground text-lg">
                我们深知心理健康数据的敏感性,采用多重措施保护您的隐私
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div>
                <h3 className="font-semibold mb-3 text-lg">数据安全</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 所有数据加密存储</li>
                  <li>• HTTPS安全传输</li>
                  <li>• 面部图像不保存原图</li>
                  <li>• 对话记录脱敏处理</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 text-lg">用户权利</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 随时查看个人数据</li>
                  <li>• 一键删除所有记录</li>
                  <li>• 数据仅本人可见</li>
                  <li>• 符合隐私保护法规</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 重要提示 */}
      <section className="py-12 px-4 bg-yellow-500/5 border-y border-yellow-500/20">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">重要提示:</strong> 
            本系统提供的识别结果仅供参考,不能作为医疗诊断依据。如您或您的亲友出现持续的情绪低落、兴趣丧失等症状,
            请及时寻求专业心理医生或精神科医生的帮助。心理健康问题需要专业人士的诊断和治疗。
          </p>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              © 2025 {APP_TITLE}. 关爱心理健康,从了解开始。
            </p>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">系统作者:</span>
              <span className="font-semibold text-primary">王周好</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">网站所属人:</span>
              <span className="font-semibold text-primary">王周好</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Developed with ❤️ by Wang Zhouhao
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
