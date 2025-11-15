import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export interface EmotionData {
  emotion: string;
  confidence: number;
  timestamp: number;
  auValues?: Record<string, number>;
  depressionRisk?: number;
  isGenuine?: boolean;
  isDuchenne?: boolean;
}

interface EmotionDisplayProps {
  emotionData: EmotionData | null;
  showDetails?: boolean;
  position?: 'overlay' | 'inline';
}

// 情绪映射
const EMOTION_CONFIG = {
  happy: {
    emoji: '😊',
    label: '快乐',
    color: 'bg-green-500',
    textColor: 'text-green-600',
    description: '积极愉悦的情绪状态'
  },
  sad: {
    emoji: '😢',
    label: '悲伤',
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    description: '消极低落的情绪状态'
  },
  angry: {
    emoji: '😠',
    label: '愤怒',
    color: 'bg-red-500',
    textColor: 'text-red-600',
    description: '激动愤怒的情绪状态'
  },
  fear: {
    emoji: '😨',
    label: '恐惧',
    color: 'bg-purple-500',
    textColor: 'text-purple-600',
    description: '紧张恐惧的情绪状态'
  },
  disgust: {
    emoji: '🤢',
    label: '厌恶',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    description: '反感厌恶的情绪状态'
  },
  surprise: {
    emoji: '😲',
    label: '惊讶',
    color: 'bg-orange-500',
    textColor: 'text-orange-600',
    description: '意外惊讶的情绪状态'
  },
  neutral: {
    emoji: '😐',
    label: '平静',
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    description: '中性平和的情绪状态'
  },
  fake_smile: {
    emoji: '😏',
    label: '假笑',
    color: 'bg-amber-500',
    textColor: 'text-amber-600',
    description: '非真实的笑容'
  }
};

export default function EmotionDisplay({ 
  emotionData, 
  showDetails = true,
  position = 'overlay'
}: EmotionDisplayProps) {
  const [displayEmotion, setDisplayEmotion] = useState<EmotionData | null>(null);
  const [emotionHistory, setEmotionHistory] = useState<EmotionData[]>([]);

  useEffect(() => {
    if (emotionData) {
      setDisplayEmotion(emotionData);
      
      // 更新情绪历史(保留最近10条)
      setEmotionHistory(prev => {
        const newHistory = [...prev, emotionData].slice(-10);
        return newHistory;
      });
    }
  }, [emotionData]);

  if (!displayEmotion) {
    return null;
  }

  const config = EMOTION_CONFIG[displayEmotion.emotion as keyof typeof EMOTION_CONFIG] || EMOTION_CONFIG.neutral;
  
  // 计算情绪稳定性(基于历史)
  const emotionStability = emotionHistory.length >= 3
    ? emotionHistory.slice(-3).every(e => e.emotion === displayEmotion.emotion)
    : false;

  // 叠加样式
  const overlayClasses = position === 'overlay'
    ? 'fixed top-4 right-4 z-50 shadow-2xl'
    : '';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={displayEmotion.timestamp}
        initial={{ opacity: 0, scale: 0.8, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={overlayClasses}
      >
        <Card className="bg-black/80 backdrop-blur-md border-2 border-white/20 text-white overflow-hidden">
          {/* 主要情绪显示 */}
          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* 情绪表情 */}
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="text-6xl"
              >
                {config.emoji}
              </motion.div>

              {/* 情绪信息 */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-2xl font-bold">{config.label}</h3>
                  {emotionStability && (
                    <Badge variant="outline" className="text-xs border-green-400 text-green-400">
                      稳定
                    </Badge>
                  )}
                  {displayEmotion.isDuchenne === false && displayEmotion.emotion === 'happy' && (
                    <Badge variant="outline" className="text-xs border-amber-400 text-amber-400">
                      假笑
                    </Badge>
                  )}
                </div>
                
                {/* 置信度进度条 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>置信度</span>
                    <span>{displayEmotion.confidence.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={displayEmotion.confidence} 
                    className="h-2"
                  />
                </div>

                {/* 抑郁风险(如果有) */}
                {displayEmotion.depressionRisk !== undefined && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-gray-300">
                      <span>抑郁风险</span>
                      <span className={
                        displayEmotion.depressionRisk > 70 ? 'text-red-400' :
                        displayEmotion.depressionRisk > 40 ? 'text-yellow-400' :
                        'text-green-400'
                      }>
                        {displayEmotion.depressionRisk.toFixed(0)}%
                      </span>
                    </div>
                    <Progress 
                      value={displayEmotion.depressionRisk} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 详细信息 */}
            {showDetails && displayEmotion.auValues && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <h4 className="text-sm font-semibold mb-2 text-gray-300">面部动作单元(AU)</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(displayEmotion.auValues)
                    .filter(([_, value]) => value > 0.3) // 只显示激活的AU
                    .slice(0, 6) // 最多显示6个
                    .map(([au, value]) => (
                      <div key={au} className="flex items-center justify-between bg-white/10 rounded px-2 py-1">
                        <span className="font-medium">{au}</span>
                        <span className="text-gray-300">{(value * 100).toFixed(0)}%</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* 情绪描述 */}
            <div className="mt-3 text-xs text-gray-400 italic">
              {config.description}
            </div>

            {/* 时间戳 */}
            <div className="mt-2 text-xs text-gray-500">
              {new Date(displayEmotion.timestamp).toLocaleTimeString('zh-CN')}
            </div>
          </div>

          {/* 情绪历史趋势(迷你图) */}
          {emotionHistory.length > 1 && (
            <div className="px-4 pb-3">
              <div className="flex items-end gap-1 h-8">
                {emotionHistory.map((emotion, index) => {
                  const emotionConfig = EMOTION_CONFIG[emotion.emotion as keyof typeof EMOTION_CONFIG] || EMOTION_CONFIG.neutral;
                  return (
                    <motion.div
                      key={emotion.timestamp}
                      initial={{ height: 0 }}
                      animate={{ height: `${emotion.confidence}%` }}
                      className={`flex-1 ${emotionConfig.color} rounded-t opacity-60 hover:opacity-100 transition-opacity`}
                      title={`${emotionConfig.label} ${emotion.confidence.toFixed(0)}%`}
                    />
                  );
                })}
              </div>
              <div className="text-xs text-gray-500 text-center mt-1">
                情绪变化趋势
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
