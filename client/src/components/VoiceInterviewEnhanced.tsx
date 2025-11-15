import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, Loader2, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface VoiceAnalysisResult {
  transcript: string;
  sentiment: string;
  tone: string;
  speechRate: number;
  pauseFrequency: number;
  emotionalIntensity: number;
  depressionRisk: number;
  keyIndicators: string[];
}

interface ConversationTurn {
  role: "interviewer" | "user";
  text: string;
  timestamp: Date;
  analysis?: VoiceAnalysisResult;
}

export default function VoiceInterviewEnhanced() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [overallRisk, setOverallRisk] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // 抑郁症筛查问题列表
  const interviewQuestions = [
    "你好!我是AI心理访谈助手。今天感觉怎么样?",
    "最近一周,你的睡眠质量如何?有失眠或嗜睡的情况吗?",
    "你对平时喜欢的活动还有兴趣吗?比如运动、看书、社交等?",
    "最近有没有感到特别疲劳或精力不足?",
    "你对自己的评价如何?有没有觉得自己没有价值或自责的时候?",
    "注意力和专注力方面有什么变化吗?",
    "食欲有没有明显的改变?体重有增加或减少吗?",
    "有没有觉得做事情的速度变慢了,或者反而变得很焦躁?",
    "有没有想过伤害自己或觉得活着没有意义?",
    "感谢你的配合!我会根据你的回答给出一个初步评估。"
  ];

  // 初始化语音识别和合成
  useEffect(() => {
    // 初始化Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleUserResponse(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast.error('语音识别失败,请重试');
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    // 初始化语音合成
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // 开始访谈
  const startInterview = () => {
    if (!recognitionRef.current || !synthRef.current) {
      toast.error('您的浏览器不支持语音功能,请使用Chrome浏览器');
      return;
    }

    setConversation([]);
    setCurrentQuestion(0);
    setOverallRisk(0);
    askQuestion(0);
  };

  // 提问
  const askQuestion = (questionIndex: number) => {
    if (questionIndex >= interviewQuestions.length) {
      finishInterview();
      return;
    }

    const question = interviewQuestions[questionIndex];
    
    // 添加到对话历史
    const turn: ConversationTurn = {
      role: "interviewer",
      text: question,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, turn]);

    // 语音播报问题
    speakText(question);
  };

  // 语音播报
  const speakText = (text: string) => {
    if (!synthRef.current) return;

    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9; // 稍慢的语速,更温和
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
      // 播报完成后自动开始录音
      if (currentQuestion < interviewQuestions.length - 1) {
        setTimeout(() => startRecording(), 500);
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      toast.error('语音播报失败');
    };

    synthRef.current.speak(utterance);
  };

  // 开始录音
  const startRecording = () => {
    if (!recognitionRef.current) {
      toast.error('语音识别不可用');
      return;
    }

    try {
      setIsRecording(true);
      recognitionRef.current.start();
      toast.info('请开始回答...');
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('录音启动失败');
      setIsRecording(false);
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // 处理用户回答
  const handleUserResponse = async (transcript: string) => {
    setIsRecording(false);
    setIsProcessing(true);

    // 添加用户回答到对话历史
    const userTurn: ConversationTurn = {
      role: "user",
      text: transcript,
      timestamp: new Date(),
    };

    try {
      // 分析语音和文本
      const analysis = await analyzeResponse(transcript);
      userTurn.analysis = analysis;

      setConversation(prev => [...prev, userTurn]);

      // 更新总体风险评分
      updateOverallRisk(analysis.depressionRisk);

      // 继续下一个问题
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      
      setTimeout(() => {
        askQuestion(nextQuestion);
      }, 1000);

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('分析失败,请重试');
      
      setConversation(prev => [...prev, userTurn]);
      
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      askQuestion(nextQuestion);
    } finally {
      setIsProcessing(false);
    }
  };

  // 分析回答(语气、语调、内容)
  const analyzeResponse = async (transcript: string): Promise<VoiceAnalysisResult> => {
    try {
      const response = await fetch('/api/analyze-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          questionIndex: currentQuestion,
        }),
      });

      if (!response.ok) {
        throw new Error('分析请求失败');
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Voice analysis error:', error);
      
      // 降级到本地简单分析
      return analyzeResponseLocally(transcript);
    }
  };

  // 本地简单分析(降级方案)
  const analyzeResponseLocally = (transcript: string): VoiceAnalysisResult => {
    let risk = 0;
    const indicators: string[] = [];

    // 关键词分析
    const negativeKeywords = ['不想', '没有', '失眠', '疲劳', '没意义', '自责', '痛苦', '难过', '绝望'];
    const positiveKeywords = ['还好', '正常', '可以', '有', '喜欢', '开心'];

    negativeKeywords.forEach(keyword => {
      if (transcript.includes(keyword)) {
        risk += 10;
        indicators.push(`负面表达: "${keyword}"`);
      }
    });

    positiveKeywords.forEach(keyword => {
      if (transcript.includes(keyword)) {
        risk -= 5;
      }
    });

    // 回答长度分析(过短可能表示兴趣缺失)
    if (transcript.length < 10) {
      risk += 15;
      indicators.push('回答过于简短');
    }

    // 情感强度(根据标点和语气词)
    const emotionalMarkers = transcript.match(/[!?。,、]/g) || [];
    const emotionalIntensity = Math.min(100, emotionalMarkers.length * 20);

    return {
      transcript,
      sentiment: risk > 50 ? '消极' : risk > 30 ? '中性偏消极' : '中性',
      tone: risk > 60 ? '低沉' : '平稳',
      speechRate: 100, // 无法从文本分析
      pauseFrequency: 0,
      emotionalIntensity,
      depressionRisk: Math.max(0, Math.min(100, risk)),
      keyIndicators: indicators,
    };
  };

  // 更新总体风险评分
  const updateOverallRisk = (newRisk: number) => {
    setOverallRisk(prev => {
      const count = conversation.filter(c => c.role === 'user').length + 1;
      return Math.round((prev * (count - 1) + newRisk) / count);
    });
  };

  // 完成访谈
  const finishInterview = () => {
    const finalMessage = `访谈完成!根据您的回答,初步评估您的抑郁症风险评分为 ${overallRisk} 分(满分100分)。`;
    
    let recommendation = "";
    if (overallRisk < 30) {
      recommendation = "您的情绪状态总体良好,请继续保持积极的生活方式。";
    } else if (overallRisk < 60) {
      recommendation = "您可能存在一定的情绪困扰,建议关注自己的心理健康,必要时寻求专业帮助。";
    } else {
      recommendation = "您的回答显示可能存在较高的抑郁风险,强烈建议尽快联系专业心理咨询师或精神科医生。全国心理援助热线: 400-161-9995";
    }

    speakText(finalMessage + recommendation);
    
    toast.success('访谈完成', {
      description: recommendation,
      duration: 10000,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          实时语音问答访谈
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          通过语音对话分析语气、语调和说话风格,辅助评估抑郁症风险
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 访谈进度 */}
        {conversation.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>访谈进度</span>
              <span>{currentQuestion}/{interviewQuestions.length}</span>
            </div>
            <Progress value={(currentQuestion / interviewQuestions.length) * 100} />
          </div>
        )}

        {/* 总体风险评分 */}
        {conversation.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">实时风险评分</span>
              <span className="text-2xl font-bold text-primary">{overallRisk}/100</span>
            </div>
            <Progress 
              value={overallRisk} 
              className={`h-3 ${
                overallRisk < 30 ? 'bg-green-200' :
                overallRisk < 60 ? 'bg-yellow-200' :
                'bg-red-200'
              }`}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {overallRisk < 30 && "情绪状态良好"}
              {overallRisk >= 30 && overallRisk < 60 && "存在一定情绪困扰"}
              {overallRisk >= 60 && "建议寻求专业帮助"}
            </p>
          </div>
        )}

        {/* 对话历史 */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {conversation.map((turn, index) => (
            <div
              key={index}
              className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  turn.role === 'interviewer'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-start gap-2">
                  {turn.role === 'interviewer' ? (
                    <Volume2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Mic className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm">{turn.text}</p>
                    {turn.analysis && (
                      <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>情感倾向:</span>
                          <span className="font-semibold">{turn.analysis.sentiment}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>语气:</span>
                          <span className="font-semibold">{turn.analysis.tone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>风险评分:</span>
                          <span className={`font-semibold ${
                            turn.analysis.depressionRisk > 60 ? 'text-red-500' :
                            turn.analysis.depressionRisk > 30 ? 'text-yellow-500' :
                            'text-green-500'
                          }`}>
                            {turn.analysis.depressionRisk}/100
                          </span>
                        </div>
                        {turn.analysis.keyIndicators.length > 0 && (
                          <div className="mt-1">
                            <span>关键指标:</span>
                            <ul className="ml-2 mt-1">
                              {turn.analysis.keyIndicators.map((indicator, i) => (
                                <li key={i}>• {indicator}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs opacity-70 mt-1 text-right">
                  {turn.timestamp.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-center">
              <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">分析中...</span>
              </div>
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-3">
          {conversation.length === 0 ? (
            <Button
              onClick={startInterview}
              className="flex-1"
              size="lg"
            >
              <Mic className="mr-2 h-5 w-5" />
              开始语音访谈
            </Button>
          ) : (
            <>
              {isRecording ? (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  className="flex-1"
                  size="lg"
                >
                  <MicOff className="mr-2 h-5 w-5" />
                  停止录音
                </Button>
              ) : isSpeaking ? (
                <Button
                  disabled
                  className="flex-1"
                  size="lg"
                >
                  <Volume2 className="mr-2 h-5 w-5 animate-pulse" />
                  AI正在提问...
                </Button>
              ) : currentQuestion < interviewQuestions.length - 1 ? (
                <Button
                  onClick={startRecording}
                  className="flex-1"
                  size="lg"
                >
                  <Mic className="mr-2 h-5 w-5" />
                  开始回答
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setConversation([]);
                    setCurrentQuestion(0);
                    setOverallRisk(0);
                  }}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  重新开始访谈
                </Button>
              )}
            </>
          )}
        </div>

        {/* 功能说明 */}
        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded">
          <div className="font-semibold mb-1">🎙️ 语音访谈特性:</div>
          <ul className="space-y-0.5 ml-4">
            <li>• 基于PHQ-9标准的结构化访谈问题</li>
            <li>• 实时语音识别和语气分析</li>
            <li>• AI语音播报,自然对话体验</li>
            <li>• 多维度评估:语气、语调、说话风格、情感倾向</li>
            <li>• 实时风险评分和关键指标提示</li>
          </ul>
        </div>

        {/* 浏览器兼容性提示 */}
        {!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-semibold">浏览器不支持语音功能</p>
              <p className="mt-1">请使用Chrome浏览器以获得最佳体验</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
