import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface AIAssistantEnhancedProps {
  detectionData?: any;
}

export default function AIAssistantEnhanced({ detectionData }: AIAssistantEnhancedProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "你好!我是您的AI心理助手。我会倾听您的感受,提供温暖的陪伴和专业的建议。请随时和我分享您的想法和感受。",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 发送消息到AI助手
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // 构建上下文(包含检测数据)
      const context = detectionData ? `
当前用户检测数据:
- 抑郁症风险评分: ${detectionData.depressionRisk || 0}/100
- 面部表情置信度: ${detectionData.confidence || 0}%
- 检测到的关键点数: ${detectionData.landmarkCount || 0}
- 当前情绪: ${detectionData.emotion || "未检测"}
` : "";

      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          userMessage: userMessage.content,
          context: context,
        }),
      });

      if (!response.ok) {
        throw new Error("AI助手响应失败");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI chat error:", error);
      toast.error("AI助手暂时无法响应,请稍后再试");
      
      // 降级到本地回复
      const fallbackMessage: Message = {
        role: "assistant",
        content: "我理解您的感受。虽然我现在无法提供完整的AI分析,但请记住:您并不孤单,寻求帮助是勇敢的第一步。如果您感到困扰,建议联系专业心理咨询师。",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          AI心理助手
          <Sparkles className="h-4 w-4 text-yellow-500" />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          温暖陪伴,专业倾听
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-4 pt-0 space-y-4">
        {/* 消息列表 */}
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 输入框 */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的想法和感受... (Shift+Enter换行)"
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 提示信息 */}
        <div className="text-xs text-muted-foreground text-center">
          AI助手会根据您的情绪状态和对话内容提供个性化的建议和陪伴
        </div>
      </CardContent>
    </Card>
  );
}
