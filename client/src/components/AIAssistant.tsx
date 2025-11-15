import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  detectionData?: any;
}

export default function AIAssistant({ detectionData }: AIAssistantProps = {}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好!我是您的AI心理助手。我会倾听您的感受,提供温暖的陪伴和专业的建议。请随时和我分享您的想法和感受。',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.aiAssistant.chat.useMutation({
    onSuccess: (data) => {
      if (data.success && data.response) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response!,
          timestamp: new Date(),
        }]);
      } else {
        toast.error('AI助手暂时无法响应');
      }
      setIsTyping(false);
    },
    onError: (error) => {
      toast.error('发送失败: ' + error.message);
      setIsTyping(false);
    },
  });

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    chatMutation.mutate({
      message: input.trim(),
      history: messages.slice(-5), // 只发送最近5条消息作为上下文
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 自动滚动到底部
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              AI心理助手
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </CardTitle>
            <p className="text-sm text-muted-foreground">温暖陪伴,专业倾听</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1">
                      <Bot className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-primary">AI助手</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                  <p className="text-xs opacity-60 mt-1">
                    {message.timestamp.toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">AI助手正在思考...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入您的想法和感受... (Shift+Enter换行)"
              className="min-h-[60px] resize-none"
              disabled={isTyping}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              size="lg"
              className="px-6"
            >
              {isTyping ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            AI助手会根据您的情绪状态提供个性化的心理支持和建议
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
