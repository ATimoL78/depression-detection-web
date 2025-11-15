import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen, Brain, Activity, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle className="w-4 h-4 mr-2" />
          使用帮助
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">系统使用指南</DialogTitle>
          <DialogDescription>
            了解如何使用抑郁症检测系统的各项功能
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">概述</TabsTrigger>
            <TabsTrigger value="detection">检测功能</TabsTrigger>
            <TabsTrigger value="assessment">量表评估</TabsTrigger>
            <TabsTrigger value="analysis">趋势分析</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  系统概述
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">核心功能</h4>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li><strong>实时智能识别</strong>: 通过摄像头实时分析面部表情,识别情绪状态</li>
                    <li><strong>标准化量表</strong>: PHQ-9和GAD-7专业心理评估量表</li>
                    <li><strong>情绪日记</strong>: 记录每日心情,使用CBT思维记录框架</li>
                    <li><strong>趋势分析</strong>: 可视化展示情绪变化趋势和模式</li>
                    <li><strong>AI助手</strong>: 智能对话分析和心理支持</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">技术特点</h4>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li>基于468个面部关键点的3D建模</li>
                    <li>8个AU(面部动作单元)精准分析</li>
                    <li>卡尔曼滤波算法平滑跟踪</li>
                    <li>点云持久化显示技术</li>
                    <li>OpenAI GPT-4驱动的AI分析</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ 重要提示</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    本系统仅用于初步筛查和自我评估,<strong>不能替代专业医学诊断</strong>。
                    如有严重症状或自杀倾向,请立即寻求专业帮助。
                  </p>
                  <div className="mt-2 text-sm">
                    <p className="font-semibold">紧急联系方式:</p>
                    <p>24小时心理援助热线: 400-161-9995</p>
                    <p>紧急情况请拨打: 120</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  实时智能识别
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">使用步骤</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>进入"实时智能识别"页面</li>
                    <li>点击"启动高精度3D面部扫描"按钮</li>
                    <li>允许浏览器访问摄像头权限</li>
                    <li>保持面部在画面中央,光线充足</li>
                    <li>系统将实时显示3D点云和AU分析结果</li>
                    <li>右侧AI助手可进行对话分析</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">AU动作单元说明</h4>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border rounded p-2">
                        <strong>AU1</strong>: 内眉上扬
                      </div>
                      <div className="border rounded p-2">
                        <strong>AU2</strong>: 外眉上扬
                      </div>
                      <div className="border rounded p-2 bg-red-50 dark:bg-red-900/20">
                        <strong>AU4</strong>: 眉头紧锁 ⚠️
                      </div>
                      <div className="border rounded p-2">
                        <strong>AU6</strong>: 脸颊上提
                      </div>
                      <div className="border rounded p-2 bg-red-50 dark:bg-red-900/20">
                        <strong>AU12</strong>: 嘴角上扬 ⚠️
                      </div>
                      <div className="border rounded p-2 bg-red-50 dark:bg-red-900/20">
                        <strong>AU15</strong>: 嘴角下垂 ⚠️
                      </div>
                      <div className="border rounded p-2">
                        <strong>AU25</strong>: 嘴唇分开
                      </div>
                      <div className="border rounded p-2">
                        <strong>AU26</strong>: 下颌下垂
                      </div>
                    </div>
                    <p className="text-muted-foreground mt-2">
                      标记⚠️的AU与抑郁症高度相关:AU4过高、AU12过低、AU15过高都是风险指标
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">最佳实践</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>确保光线充足,避免逆光</li>
                    <li>面部正对摄像头,距离适中</li>
                    <li>保持自然表情,不要刻意做表情</li>
                    <li>建议每次检测持续30秒以上</li>
                    <li>定期检测可获得更准确的趋势分析</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assessment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  标准化量表评估
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">PHQ-9 抑郁症筛查</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    患者健康问卷-9(PHQ-9)是国际通用的抑郁症筛查工具
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>共9个问题,每题0-3分</li>
                    <li>总分0-27分</li>
                    <li>评估过去两周的症状频率</li>
                    <li>严重程度分级:
                      <ul className="ml-6 mt-1 space-y-1">
                        <li>0-4分: 无抑郁症状</li>
                        <li>5-9分: 轻度抑郁</li>
                        <li>10-14分: 中度抑郁</li>
                        <li>15-19分: 中重度抑郁</li>
                        <li>20-27分: 重度抑郁</li>
                      </ul>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">GAD-7 焦虑症筛查</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    广泛性焦虑障碍量表-7(GAD-7)用于评估焦虑症状
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>共7个问题,每题0-3分</li>
                    <li>总分0-21分</li>
                    <li>严重程度分级:
                      <ul className="ml-6 mt-1 space-y-1">
                        <li>0-4分: 轻度焦虑</li>
                        <li>5-9分: 轻度焦虑</li>
                        <li>10-14分: 中度焦虑</li>
                        <li>15-21分: 重度焦虑</li>
                      </ul>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">填写建议</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>根据过去两周的实际情况如实填写</li>
                    <li>不要过度思考,选择第一感觉</li>
                    <li>建议每2-4周评估一次,追踪变化</li>
                    <li>评估结果会自动保存到趋势分析</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  趋势分析
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">可视化图表</h4>
                  <div className="space-y-2 text-sm">
                    <div className="border rounded p-3">
                      <strong className="text-primary">30天情绪趋势</strong>
                      <p className="text-muted-foreground mt-1">
                        折线图展示每日心情评分变化,帮助识别情绪波动模式
                      </p>
                    </div>
                    <div className="border rounded p-3">
                      <strong className="text-primary">PHQ-9评分历史</strong>
                      <p className="text-muted-foreground mt-1">
                        追踪抑郁症筛查评分的长期趋势,评估治疗效果
                      </p>
                    </div>
                    <div className="border rounded p-3">
                      <strong className="text-primary">面部表情模式</strong>
                      <p className="text-muted-foreground mt-1">
                        雷达图展示8个AU的平均激活水平,识别表情特征
                      </p>
                    </div>
                    <div className="border rounded p-3">
                      <strong className="text-primary">活动频率统计</strong>
                      <p className="text-muted-foreground mt-1">
                        柱状图显示各类活动的参与频率,评估行为激活水平
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">AI洞察</h4>
                  <p className="text-sm text-muted-foreground">
                    系统会自动分析您的数据,提供个性化的洞察和建议:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-2">
                    <li>识别积极趋势和进步</li>
                    <li>标记需要关注的问题</li>
                    <li>提供基于数据的行动建议</li>
                    <li>建议专业干预时机</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">数据隐私</h4>
                  <p className="text-sm text-muted-foreground">
                    所有数据仅存储在本地,不会上传到云端。您可以随时导出或删除数据。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-primary/10 rounded-lg">
          <p className="text-sm text-center">
            如需更多帮助,请查看完整文档或联系技术支持
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
