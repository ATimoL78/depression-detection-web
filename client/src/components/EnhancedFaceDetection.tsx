import { useRef, useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Square, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as faceapi from "face-api.js";

interface DetectionResult {
  emotion: string;
  confidence: number;
  landmarks: Array<{ x: number; y: number }>;
  expressions: Record<string, number>;
  detectionScore: number;
  auFeatures?: Record<string, number>;
}

interface EnhancedFaceDetectionProps {
  onDetectionResult?: (result: DetectionResult) => void;
}

export default function EnhancedFaceDetection({ onDetectionResult }: EnhancedFaceDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [landmarkCount, setLandmarkCount] = useState<number>(0);
  const [allExpressions, setAllExpressions] = useState<Record<string, number>>({});
  
  const animationRef = useRef<number | null>(null);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: Date.now() });
  const lastFrameTimeRef = useRef<number>(0);

  // 加载face-api.js模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('🔧 开始加载face-api.js模型...');
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        
        console.log('✅ face-api.js模型加载成功');
        setModelLoaded(true);
        toast.success("AI情绪识别模型加载成功", {
          description: "现在可以开始面部检测了"
        });
      } catch (error) {
        console.error("❌ Model loading error:", error);
        toast.error("模型加载失败", {
          description: "请刷新页面重试"
        });
      }
    };

    loadModels();
  }, []);

  // 启动摄像头
  const startCamera = useCallback(async () => {
    if (!modelLoaded) {
      toast.error("请等待模型加载完成");
      return;
    }

    console.log('📷 正在启动摄像头...');
    toast.info("正在访问摄像头,请允许权限...");

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
      });
      
      console.log('✅ 摄像头访问成功');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // 等待视频元数据加载
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              console.log(`🎥 视频已加载: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
              resolve();
            };
          }
        });
        
        await videoRef.current.play();
        console.log('▶️ 视频已开始播放');
      }
      
      setStream(mediaStream);
      setIsDetecting(true);
      toast.success("摄像头已启动", {
        description: "精准情绪识别中"
      });
    } catch (error: any) {
      console.error("摄像头错误:", error);
      
      if (error.name === 'NotAllowedError') {
        toast.error("摄像头权限被拒绝", {
          description: "请允许浏览器访问摄像头"
        });
      } else if (error.name === 'NotFoundError') {
        toast.error("未找到摄像头设备", {
          description: "请检查摄像头是否连接"
        });
      } else if (error.name === 'NotReadableError') {
        toast.error("摄像头正被其他应用使用", {
          description: "请关闭其他应用"
        });
      } else {
        toast.error(`摄像头错误: ${error.message || '未知错误'}`);
      }
    }
  }, [modelLoaded]);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    console.log('⏹️ 停止检测...');
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 摄像头轨道已停止');
      });
      setStream(null);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // 清空画布
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    
    setIsDetecting(false);
    setCurrentEmotion("");
    setConfidence(0);
    setLandmarkCount(0);
    setFps(0);
    setAllExpressions({});
    
    toast.info("检测已停止");
  }, [stream]);

  // 绘制68个关键点
  const drawLandmarks = useCallback((
    landmarks: faceapi.FaceLandmarks68,
    canvas: HTMLCanvasElement
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = landmarks.positions;
    
    // 绘制所有关键点
    ctx.fillStyle = '#00ff00';
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    // 绘制连接线
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;

    // 面部轮廓 (0-16)
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // 左眉毛 (17-21)
    ctx.beginPath();
    for (let i = 17; i <= 21; i++) {
      if (i === 17) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // 右眉毛 (22-26)
    ctx.beginPath();
    for (let i = 22; i <= 26; i++) {
      if (i === 22) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // 鼻梁 (27-30)
    ctx.beginPath();
    for (let i = 27; i <= 30; i++) {
      if (i === 27) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // 鼻底 (31-35)
    ctx.beginPath();
    for (let i = 31; i <= 35; i++) {
      if (i === 31) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // 左眼 (36-41)
    ctx.beginPath();
    for (let i = 36; i <= 41; i++) {
      if (i === 36) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // 右眼 (42-47)
    ctx.beginPath();
    for (let i = 42; i <= 47; i++) {
      if (i === 42) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // 外嘴唇 (48-59)
    ctx.beginPath();
    for (let i = 48; i <= 59; i++) {
      if (i === 48) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // 内嘴唇 (60-67)
    ctx.beginPath();
    for (let i = 60; i <= 67; i++) {
      if (i === 60) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }, []);

  // 生成AU特征(基于face-api.js的landmarks)
  const generateAUFeatures = useCallback((landmarks: faceapi.FaceLandmarks68): Record<string, number> => {
    const points = landmarks.positions;
    
    // AU1: 眉毛内侧上扬
    const leftBrowInner = points[21];
    const rightBrowInner = points[22];
    const noseBridge = points[27];
    const browRaise = ((noseBridge.y - leftBrowInner.y) + (noseBridge.y - rightBrowInner.y)) / 2;
    const AU1 = Math.max(0, Math.min(5, browRaise / 5));

    // AU4: 眉毛下压
    const leftBrowOuter = points[17];
    const rightBrowOuter = points[26];
    const leftEyeTop = points[37];
    const rightEyeTop = points[44];
    const browFurrow = ((leftBrowOuter.y - leftEyeTop.y) + (rightBrowOuter.y - rightEyeTop.y)) / 2;
    const AU4 = Math.max(0, Math.min(5, (30 - browFurrow) / 6));

    // AU6: 脸颊上提
    const leftCheek = points[3];
    const rightCheek = points[13];
    const leftMouth = points[48];
    const rightMouth = points[54];
    const cheekRaise = ((leftMouth.y - leftCheek.y) + (rightMouth.y - rightCheek.y)) / 2;
    const AU6 = Math.max(0, Math.min(5, cheekRaise / 20));

    // AU12: 嘴角上扬
    const leftMouthCorner = points[48];
    const rightMouthCorner = points[54];
    const mouthCenter = points[51];
    const mouthSmile = ((mouthCenter.y - leftMouthCorner.y) + (mouthCenter.y - rightMouthCorner.y)) / 2;
    const AU12 = Math.max(0, Math.min(5, mouthSmile / 3));

    // AU15: 嘴角下压
    const mouthFrown = ((leftMouthCorner.y - mouthCenter.y) + (rightMouthCorner.y - mouthCenter.y)) / 2;
    const AU15 = Math.max(0, Math.min(5, mouthFrown / 3));

    return {
      AU1: parseFloat(AU1.toFixed(2)),
      AU4: parseFloat(AU4.toFixed(2)),
      AU6: parseFloat(AU6.toFixed(2)),
      AU12: parseFloat(AU12.toFixed(2)),
      AU15: parseFloat(AU15.toFixed(2)),
    };
  }, []);

  // 实时检测循环(优化版本)
  useEffect(() => {
    if (!isDetecting || !videoRef.current || !canvasRef.current || !modelLoaded) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const detectFrame = async () => {
      // 帧率控制(最多30fps)
      const currentTime = Date.now();
      const timeSinceLastFrame = currentTime - lastFrameTimeRef.current;
      
      if (timeSinceLastFrame < 33) {
        animationRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      lastFrameTimeRef.current = currentTime;

      if (!video.videoWidth || !video.videoHeight) {
        animationRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      // 设置canvas尺寸
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      try {
        // 使用face-api.js进行检测
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detections && detections.length > 0) {
          const detection = detections[0];
          
          // 清空画布
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }

          // 绘制检测框
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          faceapi.matchDimensions(canvas, displaySize);
          const resizedDetection = faceapi.resizeResults(detection, displaySize);
          
          // 绘制边界框
          faceapi.draw.drawDetections(canvas, resizedDetection);
          
          // 绘制68个关键点
          drawLandmarks(detection.landmarks, canvas);

          // 获取情绪
          const expressions = detection.expressions;
          const sortedExpressions = Object.entries(expressions)
            .sort(([, a], [, b]) => b - a);
          
          const topEmotion = sortedExpressions[0][0];
          const topConfidence = sortedExpressions[0][1];

          setCurrentEmotion(topEmotion);
          setConfidence(Math.round(topConfidence * 100));
          setLandmarkCount(68);
          setAllExpressions(
            Object.fromEntries(
              Object.entries(expressions).map(([key, value]) => [key, Math.round(value * 100)])
            )
          );

          // 生成AU特征
          const auFeatures = generateAUFeatures(detection.landmarks);

          // 更新FPS
          fpsCounterRef.current.frames++;
          const now = Date.now();
          const elapsed = now - fpsCounterRef.current.lastTime;
          if (elapsed >= 1000) {
            const currentFps = Math.round((fpsCounterRef.current.frames * 1000) / elapsed);
            setFps(currentFps);
            fpsCounterRef.current.frames = 0;
            fpsCounterRef.current.lastTime = now;
          }

          // 回调检测结果
          if (onDetectionResult) {
            onDetectionResult({
              emotion: topEmotion,
              confidence: topConfidence,
              landmarks: detection.landmarks.positions.map(p => ({ x: p.x, y: p.y })),
              expressions: expressions,
              detectionScore: detection.detection.score,
              auFeatures,
            });
          }
        } else {
          // 未检测到面部,清空画布
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      } catch (error) {
        console.error('检测错误:', error);
      }

      animationRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDetecting, modelLoaded, drawLandmarks, generateAUFeatures, onDetectionResult]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          {/* 视频流 */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          
          {/* Canvas覆盖层 */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* 状态指示器 */}
          <div className="absolute top-4 left-4 space-y-2">
            <div className="flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full text-sm">
              {isDetecting ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-white">实时检测中</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-500 rounded-full" />
                  <span className="text-white">等待启动</span>
                </>
              )}
            </div>

            {isDetecting && currentEmotion && (
              <div className="bg-black/70 px-3 py-2 rounded-lg text-white text-xs space-y-1">
                <div className="font-semibold">情绪: {currentEmotion}</div>
                <div>置信度: {confidence}%</div>
                <div>关键点: {landmarkCount}</div>
                <div>FPS: {fps}</div>
              </div>
            )}
          </div>

          {/* 情绪分布 */}
          {isDetecting && Object.keys(allExpressions).length > 0 && (
            <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-2 rounded-lg text-white text-xs space-y-1 max-w-xs">
              <div className="font-semibold mb-1">情绪分布</div>
              {Object.entries(allExpressions)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([emotion, value]) => (
                  <div key={emotion} className="flex justify-between gap-4">
                    <span>{emotion}</span>
                    <span>{value}%</span>
                  </div>
                ))}
            </div>
          )}

          {/* 加载状态 */}
          {!modelLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>正在加载AI模型...</p>
              </div>
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        <div className="mt-4 flex gap-3">
          {!isDetecting ? (
            <Button
              onClick={startCamera}
              disabled={!modelLoaded}
              className="flex-1"
            >
              {modelLoaded ? (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  启动摄像头
                </>
              ) : (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  加载模型中...
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={stopCamera}
              variant="destructive"
              className="flex-1"
            >
              <Square className="mr-2 h-4 w-4" />
              停止检测
            </Button>
          )}
        </div>

        {/* 技术说明 */}
        <div className="mt-4 bg-muted/50 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            {modelLoaded ? (
              <>
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                <span>✓ 系统就绪 - 使用Face-API.js深度学习技术,支持68个面部关键点+7种精准情绪识别</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" />
                <span>正在加载AI模型,请稍候...</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
