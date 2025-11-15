import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Camera, Upload, ArrowLeft, Loader2 } from "lucide-react";
import { Link, Redirect, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function FaceDetection() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'camera' | 'upload' | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const analyzeMutation = trpc.faceDetection.analyze.useMutation({
    onSuccess: (data) => {
      if (data.success && 'detectionId' in data) {
        toast.success("识别完成!");
        // 跳转到结果页面
        setLocation(`/detection/result?type=face&id=${data.detectionId}`);
      } else {
        toast.error(data.error || "识别失败");
      }
      setAnalyzing(false);
    },
    onError: (error) => {
      toast.error("识别失败: " + error.message);
      setAnalyzing(false);
    },
  });

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setMode('camera');
    } catch (error) {
      toast.error("无法访问摄像头,请检查权限设置");
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
  }, [stream]);

  // 拍照
  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImageData(dataUrl);
        stopCamera();
      }
    }
  }, [stopCamera]);

  // 上传图片
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("请上传图片文件");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageData(event.target?.result as string);
        setMode('upload');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 开始分析
  const handleAnalyze = useCallback(() => {
    if (!imageData) return;
    setAnalyzing(true);
    // 移除 data:image/jpeg;base64, 前缀
    const base64Data = imageData.split(',')[1];
    analyzeMutation.mutate({ imageData: base64Data });
  }, [imageData, analyzeMutation]);

  // 重置
  const handleReset = useCallback(() => {
    setImageData(null);
    setMode(null);
    stopCamera();
  }, [stopCamera]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold">面部表情识别</span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 选择模式 */}
        {!mode && !imageData && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">选择识别方式</CardTitle>
                <CardDescription>
                  请选择使用摄像头拍照或上传已有照片进行面部表情分析
                </CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-32 flex-col gap-3"
                  onClick={startCamera}
                >
                  <Camera className="w-12 h-12 text-primary" />
                  <span className="text-lg">使用摄像头</span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-32 flex-col gap-3"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload className="w-12 h-12 text-secondary" />
                  <span className="text-lg">上传照片</span>
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </CardContent>
            </Card>

            {/* 使用提示 */}
            <Card className="bg-accent/20 border-accent">
              <CardHeader>
                <CardTitle className="text-lg">使用提示</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                <p>• 确保光线充足,避免背光</p>
                <p>• 面部正对摄像头,距离50-100cm</p>
                <p>• 保持自然表情,避免遮挡面部</p>
                <p>• 识别过程约需3-5秒</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 摄像头模式 */}
        {mode === 'camera' && !imageData && (
          <Card>
            <CardHeader>
              <CardTitle>摄像头拍照</CardTitle>
              <CardDescription>调整好角度后点击拍照按钮</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  拍照
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 预览和分析 */}
        {imageData && (
          <Card>
            <CardHeader>
              <CardTitle>确认照片</CardTitle>
              <CardDescription>请确认照片清晰后开始分析</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative bg-muted rounded-lg overflow-hidden">
                <img src={imageData} alt="Preview" className="w-full h-auto" />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex-1"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      开始分析
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={analyzing}>
                  重新拍摄
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
