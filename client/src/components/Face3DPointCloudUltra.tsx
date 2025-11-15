/**
 * 超级增强版3D面部点云组件 - 2025
 * 
 * 新增功能:
 * 1. 假表情检测(Duchenne Smile)
 * 2. 微表情识别
 * 3. 语音情绪识别
 * 4. 多模态情绪融合
 * 5. 优化的卡尔曼滤波
 * 6. 更多AU支持(14个AU)
 * 7. 实时性能优化
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Square, Loader2, AlertCircle, CheckCircle2, Mic, MicOff, Activity, Smile, Frown } from "lucide-react";
import { toast } from "sonner";
import * as faceapi from "face-api.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MultiPointKalmanFilterOptimized } from "@/lib/KalmanFilterOptimized";
import { AUCalculatorEnhanced, type AUFeatures, type FakeSmileAnalysis } from "@/lib/AUCalculatorEnhanced";
import { SpeechEmotionRecognizer, MultimodalEmotionFusion, type EmotionPrediction } from "@/lib/SpeechEmotionRecognizer";

interface Face3DPointCloudUltraProps {
  onDetectionResult?: (result: any) => void;
}

export default function Face3DPointCloudUltra({ onDetectionResult }: Face3DPointCloudUltraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const canvas3DRef = useRef<HTMLCanvasElement>(null);
  
  const [isDetecting, setIsDetecting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [landmarkCount, setLandmarkCount] = useState<number>(0);
  const [auFeatures, setAuFeatures] = useState<AUFeatures | null>(null);
  const [fakeSmileAnalysis, setFakeSmileAnalysis] = useState<FakeSmileAnalysis | null>(null);
  const [voiceEmotion, setVoiceEmotion] = useState<EmotionPrediction | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [fusedEmotion, setFusedEmotion] = useState<string>("");
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const linesRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: Date.now() });
  
  // 优化版卡尔曼滤波器
  const kalmanFilterRef = useRef<MultiPointKalmanFilterOptimized>(
    new MultiPointKalmanFilterOptimized(68, 0.005, 0.08, true)
  );
  const auCalculatorRef = useRef<AUCalculatorEnhanced>(new AUCalculatorEnhanced());
  const speechRecognizerRef = useRef<SpeechEmotionRecognizer>(new SpeechEmotionRecognizer());

  // 加载face-api.js模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
        
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        
        setModelLoaded(true);
        toast.success("🚀 超级AI模型加载成功 - 2025版");
      } catch (error) {
        console.error("Model loading error:", error);
        toast.error("模型加载失败");
      }
    };

    loadModels();
  }, []);

  // 初始化Three.js 3D场景
  useEffect(() => {
    if (!canvas3DRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      canvas3DRef.current.clientWidth / canvas3DRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 300;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvas3DRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(canvas3DRef.current.clientWidth, canvas3DRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 0, 100);
    scene.add(directionalLight);

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // 启动摄像头
  const startCamera = useCallback(async () => {
    if (!modelLoaded) {
      toast.error("请等待模型加载完成");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setStream(mediaStream);
      setIsDetecting(true);
      kalmanFilterRef.current.reset();
      auCalculatorRef.current.reset();
      toast.success("🎯 超级3D面部扫描已启动");
      
      // 开始检测循环
      detectFace();
    } catch (error) {
      toast.error("无法访问摄像头");
      console.error("Camera error:", error);
    }
  }, [modelLoaded]);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsDetecting(false);
    setCurrentEmotion("");
    setConfidence(0);
    setLandmarkCount(0);
    setFps(0);
    setAuFeatures(null);
    setFakeSmileAnalysis(null);
    
    // 清除3D场景
    if (pointsRef.current && sceneRef.current) {
      sceneRef.current.remove(pointsRef.current);
      pointsRef.current = null;
    }
    if (linesRef.current && sceneRef.current) {
      sceneRef.current.remove(linesRef.current);
      linesRef.current = null;
    }
    
    toast.info("扫描已停止");
  }, [stream]);

  // 切换语音识别
  const toggleVoice = useCallback(async () => {
    if (!isVoiceEnabled) {
      try {
        await speechRecognizerRef.current.initialize();
        await speechRecognizerRef.current.startRecording();
        setIsVoiceEnabled(true);
        toast.success("🎤 语音情绪识别已启动");
        
        // 开始语音识别循环
        startVoiceRecognition();
      } catch (error) {
        toast.error("无法启动语音识别");
        console.error("Voice error:", error);
      }
    } else {
      speechRecognizerRef.current.stopRecording();
      setIsVoiceEnabled(false);
      setVoiceEmotion(null);
      toast.info("语音识别已停止");
    }
  }, [isVoiceEnabled]);

  // 语音识别循环
  const startVoiceRecognition = useCallback(() => {
    const recognizeVoice = () => {
      if (!speechRecognizerRef.current.getRecordingStatus()) return;
      
      const emotion = speechRecognizerRef.current.recognizeEmotion();
      if (emotion) {
        setVoiceEmotion(emotion);
      }
      
      setTimeout(recognizeVoice, 500); // 每500ms识别一次
    };
    
    recognizeVoice();
  }, []);

  // 面部检测主循环
  const detectFace = useCallback(async () => {
    if (!videoRef.current || !canvas2DRef.current || !isDetecting) return;

    const video = videoRef.current;
    const canvas = canvas2DRef.current;
    
    // 计算FPS
    fpsCounterRef.current.frames++;
    const now = Date.now();
    if (now - fpsCounterRef.current.lastTime >= 1000) {
      setFps(fpsCounterRef.current.frames);
      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastTime = now;
    }

    try {
      // 检测面部
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detection) {
        const landmarks = detection.landmarks.positions;
        const expressions = detection.expressions;
        
        // 应用卡尔曼滤波平滑
        const smoothedLandmarks = kalmanFilterRef.current.smoothLandmarks(
          landmarks.map(p => ({ x: p.x, y: p.y, z: 0 })),
          now
        );
        
        // 计算AU特征
        const auFeaturesResult = auCalculatorRef.current.calculateAUFeatures(smoothedLandmarks, now);
        setAuFeatures(auFeaturesResult);
        
        // 假笑检测
        const fakeSmile = auCalculatorRef.current.detectFakeSmile(smoothedLandmarks);
        setFakeSmileAnalysis(fakeSmile);
        
        // 获取情绪
        const emotion = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b)[0];
        const emotionConfidence = expressions[emotion as keyof typeof expressions];
        
        setCurrentEmotion(emotion);
        setConfidence(emotionConfidence);
        setLandmarkCount(smoothedLandmarks.length);
        
        // 多模态融合
        if (voiceEmotion) {
          const fused = MultimodalEmotionFusion.fuse(
            emotion,
            emotionConfidence,
            voiceEmotion.emotion,
            voiceEmotion.confidence,
            0.6
          );
          setFusedEmotion(fused.emotion);
        } else {
          setFusedEmotion(emotion);
        }
        
        // 更新3D点云
        update3DPointCloud(smoothedLandmarks);
        
        // 绘制2D
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        const resizedDetection = faceapi.resizeResults(detection, displaySize);
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          faceapi.draw.drawDetections(canvas, resizedDetection);
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);
        }
        
        // 回调
        if (onDetectionResult) {
          onDetectionResult({
            emotion,
            confidence: emotionConfidence,
            auFeatures: auFeaturesResult,
            fakeSmileAnalysis: fakeSmile,
            voiceEmotion: voiceEmotion,
            fusedEmotion: fusedEmotion,
            landmarks: smoothedLandmarks
          });
        }
      }
    } catch (error) {
      console.error("Detection error:", error);
    }

    animationRef.current = requestAnimationFrame(detectFace);
  }, [isDetecting, voiceEmotion, fusedEmotion, onDetectionResult]);

  // 更新3D点云
  const update3DPointCloud = useCallback((landmarks: Array<{ x: number; y: number; z: number }>) => {
    if (!sceneRef.current) return;

    // 移除旧点云
    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current);
    }
    if (linesRef.current) {
      sceneRef.current.remove(linesRef.current);
    }

    // 创建新点云
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];

    landmarks.forEach((landmark, index) => {
      const x = (landmark.x - 320) * 0.5;
      const y = -(landmark.y - 240) * 0.5;
      const z = landmark.z * 0.5;

      positions.push(x, y, z);

      // 根据区域着色
      if (index >= 17 && index < 27) {
        colors.push(0.0, 1.0, 1.0); // 眉毛 - 青色
      } else if (index >= 36 && index < 48) {
        colors.push(1.0, 1.0, 0.0); // 眼睛 - 黄色
      } else if (index >= 48 && index < 68) {
        colors.push(1.0, 0.0, 1.0); // 嘴巴 - 洋红色
      } else {
        colors.push(1.0, 1.0, 1.0); // 轮廓 - 白色
      }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const pointCloud = new THREE.Points(geometry, material);
    sceneRef.current.add(pointCloud);
    pointsRef.current = pointCloud;

    // 添加连线
    const linesGroup = new THREE.Group();
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff88, opacity: 0.3, transparent: true });

    // 面部轮廓
    const contourPoints = positions.slice(0, 17 * 3).reduce((acc, val, i) => {
      if (i % 3 === 0) acc.push(new THREE.Vector3(val, positions[i + 1], positions[i + 2]));
      return acc;
    }, [] as THREE.Vector3[]);
    linesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(contourPoints), lineMaterial));

    sceneRef.current.add(linesGroup);
    linesRef.current = linesGroup;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      stopCamera();
      if (isVoiceEnabled) {
        speechRecognizerRef.current.dispose();
      }
    };
  }, [stopCamera, isVoiceEnabled]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左侧:视频和3D点云 */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>📹 实时视频</span>
              <Badge variant={isDetecting ? "default" : "secondary"}>
                {isDetecting ? "运行中" : "已停止"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-lg"
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={canvas2DRef}
                className="absolute top-0 left-0 w-full h-full"
              />
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                onClick={startCamera}
                disabled={isDetecting || !modelLoaded}
                className="flex-1"
              >
                {!modelLoaded ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...</>
                ) : (
                  <><Camera className="mr-2 h-4 w-4" /> 启动扫描</>
                )}
              </Button>
              
              <Button
                onClick={stopCamera}
                disabled={!isDetecting}
                variant="destructive"
                className="flex-1"
              >
                <Square className="mr-2 h-4 w-4" /> 停止
              </Button>
              
              <Button
                onClick={toggleVoice}
                disabled={!isDetecting}
                variant={isVoiceEnabled ? "default" : "outline"}
              >
                {isVoiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🌐 3D点云可视化</CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvas3DRef}
              className="w-full h-[400px] rounded-lg bg-gray-900"
            />
            <div className="mt-2 text-sm text-gray-500">
              FPS: {fps} | 关键点: {landmarkCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 右侧:分析结果 */}
      <div className="space-y-4">
        {/* 情绪识别 */}
        <Card>
          <CardHeader>
            <CardTitle>😊 情绪识别</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-gray-500 mb-1">面部情绪</div>
              <div className="text-2xl font-bold">{currentEmotion || "未检测"}</div>
              <div className="text-sm text-gray-500">置信度: {(confidence * 100).toFixed(1)}%</div>
            </div>
            
            {voiceEmotion && (
              <div>
                <div className="text-sm text-gray-500 mb-1">语音情绪</div>
                <div className="text-xl font-semibold">{voiceEmotion.emotion}</div>
                <div className="text-sm text-gray-500">置信度: {(voiceEmotion.confidence * 100).toFixed(1)}%</div>
              </div>
            )}
            
            {fusedEmotion && voiceEmotion && (
              <div className="pt-3 border-t">
                <div className="text-sm text-gray-500 mb-1">🔀 多模态融合结果</div>
                <div className="text-2xl font-bold text-blue-600">{fusedEmotion}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 假笑检测 */}
        {fakeSmileAnalysis && currentEmotion === 'happy' && (
          <Card className={fakeSmileAnalysis.isGenuine ? "border-green-500" : "border-red-500"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {fakeSmileAnalysis.isGenuine ? (
                  <><CheckCircle2 className="h-5 w-5 text-green-500" /> 真实笑容</>
                ) : (
                  <><AlertCircle className="h-5 w-5 text-red-500" /> 假笑检测</>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Duchenne微笑</span>
                <Badge variant={fakeSmileAnalysis.isDuchenne ? "default" : "secondary"}>
                  {fakeSmileAnalysis.isDuchenne ? "是" : "否"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">AU6/AU12比值</span>
                <span className="font-mono">{fakeSmileAnalysis.au6_au12_ratio.toFixed(2)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">左右对称性</span>
                <span className="font-mono">{((1 - fakeSmileAnalysis.asymmetry) * 100).toFixed(1)}%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">真实性置信度</span>
                <span className="font-mono">{(fakeSmileAnalysis.confidence * 100).toFixed(1)}%</span>
              </div>
              
              <div className="pt-2 border-t text-sm text-gray-600">
                {fakeSmileAnalysis.reason}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AU特征 */}
        {auFeatures && (
          <Card>
            <CardHeader>
              <CardTitle>💪 面部动作单元(AU)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>AU1: {auFeatures.AU1.toFixed(1)}</div>
                <div>AU2: {auFeatures.AU2.toFixed(1)}</div>
                <div className="font-semibold">AU4: {auFeatures.AU4.toFixed(1)}</div>
                <div className="font-semibold">AU6: {auFeatures.AU6.toFixed(1)}</div>
                <div>AU7: {auFeatures.AU7.toFixed(1)}</div>
                <div>AU10: {auFeatures.AU10.toFixed(1)}</div>
                <div className="font-semibold">AU12: {auFeatures.AU12.toFixed(1)}</div>
                <div>AU14: {auFeatures.AU14.toFixed(1)}</div>
                <div className="font-semibold">AU15: {auFeatures.AU15.toFixed(1)}</div>
                <div>AU17: {auFeatures.AU17.toFixed(1)}</div>
                <div>AU20: {auFeatures.AU20.toFixed(1)}</div>
                <div>AU23: {auFeatures.AU23.toFixed(1)}</div>
                <div>AU25: {auFeatures.AU25.toFixed(1)}</div>
                <div>AU26: {auFeatures.AU26.toFixed(1)}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
