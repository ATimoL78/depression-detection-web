import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Square, Loader2, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import * as faceapi from "face-api.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Face3DPointCloudProps {
  onDetectionResult?: (result: any) => void;
}

export default function Face3DPointCloud({ onDetectionResult }: Face3DPointCloudProps) {
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
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const animationRef = useRef<number | null>(null);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: Date.now() });

  // 加载face-api.js模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        
        setModelLoaded(true);
        toast.success("3D AI模型加载成功");
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

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(
      75,
      canvas3DRef.current.clientWidth / canvas3DRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 300;
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvas3DRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(canvas3DRef.current.clientWidth, canvas3DRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // 添加轨道控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 100;
    controls.maxDistance = 500;
    controlsRef.current = controls;

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 添加点光源
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(0, 0, 300);
    scene.add(pointLight);

    // 添加网格辅助线
    const gridHelper = new THREE.GridHelper(400, 20, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // 渲染循环
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 清理函数
    return () => {
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // 创建3D点云
  const create3DPointCloud = useCallback((landmarks: faceapi.FaceLandmarks68) => {
    if (!sceneRef.current) return;

    // 移除旧的点云
    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current);
    }

    const points = landmarks.positions;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];

    // 将2D关键点转换为3D(添加模拟深度)
    points.forEach((point, index) => {
      // 归一化坐标到[-100, 100]范围
      const x = (point.x - 320) / 3.2;
      const y = -(point.y - 240) / 2.4;
      
      // 根据面部区域添加不同的深度
      let z = 0;
      if (index >= 36 && index < 48) {
        // 眼睛区域 - 稍微凹陷
        z = -10;
      } else if (index >= 48 && index < 68) {
        // 嘴巴区域 - 稍微凹陷
        z = -5;
      } else if (index >= 17 && index < 27) {
        // 鼻子区域 - 突出
        z = 15;
      }

      positions.push(x, y, z);

      // 根据区域设置不同颜色
      if (index >= 36 && index < 48) {
        // 眼睛 - 蓝色
        colors.push(0.2, 0.6, 1.0);
      } else if (index >= 48 && index < 68) {
        // 嘴巴 - 青色
        colors.push(0.0, 1.0, 1.0);
      } else if (index >= 17 && index < 27) {
        // 鼻子 - 绿色
        colors.push(0.0, 1.0, 0.5);
      } else {
        // 轮廓 - 白色
        colors.push(1.0, 1.0, 1.0);
      }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 5,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const pointCloud = new THREE.Points(geometry, material);
    sceneRef.current.add(pointCloud);
    pointsRef.current = pointCloud;

    // 添加连线
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff88,
      opacity: 0.3,
      transparent: true,
    });

    // 面部轮廓线
    const contourPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 17; i++) {
      contourPoints.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
    }
    const contourGeometry = new THREE.BufferGeometry().setFromPoints(contourPoints);
    const contourLine = new THREE.Line(contourGeometry, lineMaterial);
    sceneRef.current.add(contourLine);

    // 左眼轮廓
    const leftEyePoints: THREE.Vector3[] = [];
    for (let i = 36; i < 42; i++) {
      leftEyePoints.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
    }
    leftEyePoints.push(leftEyePoints[0]); // 闭合
    const leftEyeGeometry = new THREE.BufferGeometry().setFromPoints(leftEyePoints);
    const leftEyeLine = new THREE.Line(leftEyeGeometry, lineMaterial);
    sceneRef.current.add(leftEyeLine);

    // 右眼轮廓
    const rightEyePoints: THREE.Vector3[] = [];
    for (let i = 42; i < 48; i++) {
      rightEyePoints.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
    }
    rightEyePoints.push(rightEyePoints[0]); // 闭合
    const rightEyeGeometry = new THREE.BufferGeometry().setFromPoints(rightEyePoints);
    const rightEyeLine = new THREE.Line(rightEyeGeometry, lineMaterial);
    sceneRef.current.add(rightEyeLine);

    // 嘴巴外轮廓
    const mouthPoints: THREE.Vector3[] = [];
    for (let i = 48; i < 60; i++) {
      mouthPoints.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
    }
    mouthPoints.push(mouthPoints[0]); // 闭合
    const mouthGeometry = new THREE.BufferGeometry().setFromPoints(mouthPoints);
    const mouthLine = new THREE.Line(mouthGeometry, lineMaterial);
    sceneRef.current.add(mouthLine);
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
      toast.success("3D面部扫描已启动");
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
    
    // 清除3D场景中的点云
    if (sceneRef.current && pointsRef.current) {
      sceneRef.current.remove(pointsRef.current);
      pointsRef.current = null;
    }
    
    toast.info("检测已停止");
  }, [stream]);

  // 重置3D视图
  const reset3DView = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0, 300);
      controlsRef.current.reset();
      toast.success("3D视图已重置");
    }
  }, []);

  // 实时检测循环
  useEffect(() => {
    if (!isDetecting || !videoRef.current || !canvas2DRef.current || !modelLoaded) return;

    const video = videoRef.current;
    const canvas = canvas2DRef.current;

    const detectFrame = async () => {
      if (!video.videoWidth || !video.videoHeight) {
        animationRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detections && detections.length > 0) {
          const detection = detections[0];
          const landmarks = detection.landmarks;
          const expressions = detection.expressions;

          // 绘制2D关键点
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const points = landmarks.positions;
            
            points.forEach((point, index) => {
              if (index >= 36 && index < 48) {
                ctx.fillStyle = "rgba(0, 150, 255, 0.9)";
              } else if (index >= 48 && index < 68) {
                ctx.fillStyle = "rgba(0, 255, 255, 0.9)";
              } else {
                ctx.fillStyle = "rgba(0, 255, 150, 0.7)";
              }
              ctx.beginPath();
              ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
              ctx.fill();
            });
          }

          // 创建3D点云
          create3DPointCloud(landmarks);

          // 获取情绪
          const emotionMap: Record<string, string> = {
            "neutral": "平静",
            "happy": "开心",
            "sad": "悲伤",
            "angry": "愤怒",
            "fearful": "恐惧",
            "disgusted": "厌恶",
            "surprised": "惊讶",
          };

          const expressionsArray = Object.entries(expressions).map(([emotion, value]) => ({
            emotion,
            value,
          }));
          expressionsArray.sort((a, b) => b.value - a.value);
          
          const topEmotion = expressionsArray[0];
          const emotionChinese = emotionMap[topEmotion.emotion] || topEmotion.emotion;
          const emotionConfidence = Math.round(topEmotion.value * 100);

          setCurrentEmotion(emotionChinese);
          setConfidence(emotionConfidence);
          setLandmarkCount(68);
        } else {
          setCurrentEmotion("未检测到人脸");
          setConfidence(0);
          setLandmarkCount(0);
        }
      } catch (error) {
        console.error("Detection error:", error);
      }

      // 更新FPS
      fpsCounterRef.current.frames++;
      const now = Date.now();
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }

      animationRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDetecting, modelLoaded, create3DPointCloud]);

  return (
    <div className="space-y-4">
      {/* 2D视频和3D点云并排显示 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 2D视频视图 */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              2D实时视频
            </h3>
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas
                ref={canvas2DRef}
                className="absolute top-0 left-0 w-full h-full"
              />
              
              {/* 状态信息 */}
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg text-white text-sm space-y-1">
                <div>情绪: {currentEmotion || "-"}</div>
                <div>置信度: {confidence}%</div>
                <div>关键点: {landmarkCount}</div>
                <div>FPS: {fps}</div>
              </div>

              {isDetecting && (
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <div className="bg-red-500 w-3 h-3 rounded-full animate-pulse" />
                  <span className="text-white text-sm bg-red-500/80 px-2 py-1 rounded">
                    实时检测中
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3D点云视图 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded" />
                3D面部点云
              </h3>
              <Button
                onClick={reset3DView}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <RotateCcw className="w-4 h-4" />
                重置视图
              </Button>
            </div>
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg overflow-hidden aspect-video">
              <canvas
                ref={canvas3DRef}
                className="w-full h-full"
              />
              
              {/* 3D提示 */}
              <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span>可拖拽旋转 | 滚轮缩放</span>
                </div>
                <div className="text-white/70">
                  蓝色=眼睛 | 青色=嘴巴 | 绿色=鼻子
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 控制按钮 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            {!isDetecting ? (
              <Button
                onClick={startCamera}
                disabled={!modelLoaded}
                className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                size="lg"
              >
                {modelLoaded ? (
                  <>
                    <Camera className="w-5 h-5 mr-2" />
                    启动3D面部扫描
                  </>
                ) : (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    模型加载中...
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={stopCamera}
                variant="destructive"
                className="flex-1"
                size="lg"
              >
                <Square className="w-5 h-5 mr-2" />
                停止扫描
              </Button>
            )}
          </div>

          {/* 系统提示 */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
              {modelLoaded ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>✓ 3D系统就绪 - 68个面部关键点 + 3D点云可视化 + 7种精准情绪识别</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>正在加载3D AI模型...</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
