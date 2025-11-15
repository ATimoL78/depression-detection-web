import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FaceLandmark {
  x: number;
  y: number;
}

interface DetectionResult {
  emotion: string;
  confidence: number;
  landmarks: FaceLandmark[];
  auFeatures: Record<string, number>;
}

interface RealtimeFaceDetectionProps {
  onDetectionResult?: (result: DetectionResult) => void;
}

export default function RealtimeFaceDetection({ onDetectionResult }: RealtimeFaceDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const detectionIntervalRef = useRef<number | null>(null);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: Date.now() });

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setStream(mediaStream);
      setIsDetecting(true);
      toast.success("摄像头已启动");
    } catch (error) {
      toast.error("无法访问摄像头");
      console.error("Camera error:", error);
    }
  }, []);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsDetecting(false);
    toast.info("摄像头已停止");
  }, [stream]);

  // 模拟面部关键点检测(68点标准)
  const detectFaceLandmarks = useCallback((videoWidth: number, videoHeight: number): FaceLandmark[] => {
    const landmarks: FaceLandmark[] = [];
    const centerX = videoWidth / 2;
    const centerY = videoHeight / 2;
    const faceWidth = videoWidth * 0.3;
    const faceHeight = videoHeight * 0.4;

    // 面部轮廓 (17点)
    for (let i = 0; i < 17; i++) {
      const angle = Math.PI + (i / 16) * Math.PI;
      landmarks.push({
        x: centerX + Math.cos(angle) * faceWidth * 0.8,
        y: centerY + Math.sin(angle) * faceHeight * 0.9,
      });
    }

    // 左眉毛 (5点)
    for (let i = 0; i < 5; i++) {
      landmarks.push({
        x: centerX - faceWidth * 0.4 + (i / 4) * faceWidth * 0.3,
        y: centerY - faceHeight * 0.35,
      });
    }

    // 右眉毛 (5点)
    for (let i = 0; i < 5; i++) {
      landmarks.push({
        x: centerX + faceWidth * 0.1 + (i / 4) * faceWidth * 0.3,
        y: centerY - faceHeight * 0.35,
      });
    }

    // 鼻梁 (4点)
    for (let i = 0; i < 4; i++) {
      landmarks.push({
        x: centerX,
        y: centerY - faceHeight * 0.2 + (i / 3) * faceHeight * 0.3,
      });
    }

    // 鼻尖 (5点)
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * faceWidth * 0.08;
      landmarks.push({
        x: centerX + offset,
        y: centerY + faceHeight * 0.1,
      });
    }

    // 左眼 (6点)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      landmarks.push({
        x: centerX - faceWidth * 0.25 + Math.cos(angle) * faceWidth * 0.1,
        y: centerY - faceHeight * 0.15 + Math.sin(angle) * faceHeight * 0.08,
      });
    }

    // 右眼 (6点)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      landmarks.push({
        x: centerX + faceWidth * 0.25 + Math.cos(angle) * faceWidth * 0.1,
        y: centerY - faceHeight * 0.15 + Math.sin(angle) * faceHeight * 0.08,
      });
    }

    // 嘴巴外轮廓 (12点)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      landmarks.push({
        x: centerX + Math.cos(angle) * faceWidth * 0.2,
        y: centerY + faceHeight * 0.35 + Math.sin(angle) * faceHeight * 0.1,
      });
    }

    // 嘴巴内轮廓 (8点)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      landmarks.push({
        x: centerX + Math.cos(angle) * faceWidth * 0.12,
        y: centerY + faceHeight * 0.35 + Math.sin(angle) * faceHeight * 0.06,
      });
    }

    return landmarks;
  }, []);

  // 绘制面部关键点
  const drawLandmarks = useCallback((landmarks: FaceLandmark[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制连接线
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    landmarks.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    // 绘制关键点
    landmarks.forEach((point, index) => {
      // 不同区域使用不同颜色
      let color = 'rgba(100, 200, 255, 0.8)'; // 默认蓝色
      if (index < 17) color = 'rgba(100, 200, 255, 0.8)'; // 面部轮廓
      else if (index < 27) color = 'rgba(150, 255, 150, 0.8)'; // 眉毛
      else if (index < 36) color = 'rgba(255, 200, 100, 0.8)'; // 鼻子
      else if (index < 48) color = 'rgba(255, 150, 200, 0.8)'; // 眼睛
      else color = 'rgba(255, 100, 150, 0.8)'; // 嘴巴

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();

      // 添加发光效果
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }, []);

  // 实时检测循环
  useEffect(() => {
    if (!isDetecting || !videoRef.current || !overlayCanvasRef.current) return;

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    const detectFrame = () => {
      if (!video.videoWidth || !video.videoHeight) return;

      // 设置canvas尺寸
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      // 检测面部关键点
      const landmarks = detectFaceLandmarks(video.videoWidth, video.videoHeight);
      drawLandmarks(landmarks, overlayCanvas);

      // 模拟情绪识别
      const emotions = ['Happy', 'Neutral', 'Sad', 'Surprised', 'Focused'];
      const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
      const randomConfidence = 75 + Math.random() * 20;

      setCurrentEmotion(randomEmotion);
      setConfidence(Math.round(randomConfidence));

      // 模拟AU特征
      const auFeatures = {
        AU1: Math.random() * 5,
        AU2: Math.random() * 5,
        AU4: Math.random() * 5,
        AU6: Math.random() * 5,
        AU12: Math.random() * 5,
        AU15: Math.random() * 5,
      };

      // 回调检测结果
      if (onDetectionResult) {
        onDetectionResult({
          emotion: randomEmotion,
          confidence: randomConfidence,
          landmarks,
          auFeatures,
        });
      }

      // 更新FPS
      fpsCounterRef.current.frames++;
      const now = Date.now();
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }
    };

    detectionIntervalRef.current = window.setInterval(detectFrame, 100); // 10 FPS

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isDetecting, detectFaceLandmarks, drawLandmarks, onDetectionResult]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
            
            {/* 实时信息显示 */}
            {isDetecting && (
              <div className="absolute top-4 left-4 space-y-2">
                <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <div className="text-white text-sm font-medium">
                    情绪: <span className="text-primary">{currentEmotion}</span>
                  </div>
                  <div className="text-white text-sm">
                    置信度: <span className="text-secondary">{confidence}%</span>
                  </div>
                  <div className="text-white text-sm">
                    FPS: <span className="text-chart-4">{fps}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 检测状态指示器 */}
            {isDetecting && (
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-2 bg-red-500/80 backdrop-blur-sm px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white text-xs font-medium">实时检测中</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            {!isDetecting ? (
              <Button onClick={startCamera} className="flex-1">
                <Camera className="w-4 h-4 mr-2" />
                启动实时检测
              </Button>
            ) : (
              <Button onClick={stopCamera} variant="destructive" className="flex-1">
                <Square className="w-4 h-4 mr-2" />
                停止检测
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
