"""
YuNet人脸检测器
超高速人脸检测,目标1-2ms/帧
"""

import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
import time
import os
import urllib.request
from pathlib import Path


class YuNetFaceDetector:
    """
    YuNet人脸检测器
    - 速度: 1-2ms/帧 @ 640x480
    - 准确率: >95%
    - 支持人脸跟踪,减少检测频率
    """
    
    def __init__(
        self,
        model_path: str,
        input_size: Tuple[int, int] = (320, 320),
        score_threshold: float = 0.5,  # 降低阈值提高检测率
        nms_threshold: float = 0.3,
        top_k: int = 5000,
        backend_id: int = cv2.dnn.DNN_BACKEND_DEFAULT,
        target_id: int = cv2.dnn.DNN_TARGET_CPU
    ):
        """
        初始化YuNet人脸检测器
        
        Args:
            model_path: ONNX模型路径
            input_size: 输入尺寸(宽, 高)
            score_threshold: 置信度阈值
            nms_threshold: NMS阈值
            top_k: 最大检测数量
            backend_id: 后端ID (CPU/GPU)
            target_id: 目标设备ID
        """
        self.model_path = model_path
        self.input_size = input_size
        self.score_threshold = score_threshold
        self.nms_threshold = nms_threshold
        
        # 确保模型文件存在
        self._ensure_model_exists()
        
        # 创建检测器
        self.detector = cv2.FaceDetectorYN.create(
            model=model_path,
            config="",
            input_size=input_size,
            score_threshold=score_threshold,
            nms_threshold=nms_threshold,
            top_k=top_k,
            backend_id=backend_id,
            target_id=target_id
        )
        
        # 跟踪器配置
        self.use_tracking = True
        self.tracker = None
        self.tracking_active = False
        self.track_fail_count = 0
        self.max_track_fail = 3
        self.detection_interval = 5  # 每5帧检测一次
        self.frame_count = 0
        
        # 性能统计
        self.detection_times = []
    
    def _ensure_model_exists(self):
        """确保模型文件存在,如果不存在则下载"""
        model_path = Path(self.model_path)
        
        if model_path.exists():
            return
        
        # 创建模型目录
        model_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 下载模型
        model_url = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
        
        print(f"    正在下载YuNet模型...")
        print(f"    URL: {model_url}")
        print(f"    目标: {model_path}")
        
        try:
            # 下载文件
            urllib.request.urlretrieve(model_url, str(model_path))
            print(f"    ✓ 模型下载完成")
        except Exception as e:
            print(f"    ✗ 模型下载失败: {e}")
            print(f"    请手动下载模型文件到: {model_path}")
            raise
        
    def detect(self, frame: np.ndarray, force_detect: bool = False) -> List[Dict]:
        """
        检测人脸
        
        Args:
            frame: 输入图像(BGR格式)
            force_detect: 强制执行检测(忽略跟踪)
            
        Returns:
            人脸列表,每个人脸包含:
            - bbox: [x, y, w, h]
            - confidence: 置信度
            - landmarks: 5个关键点 [[x1,y1], [x2,y2], ...]
        """
        self.frame_count += 1
        
        # 智能检测/跟踪切换
        if self.use_tracking and not force_detect:
            # 尝试使用跟踪器
            if self.tracking_active and self.frame_count % self.detection_interval != 0:
                tracked_faces = self._track_faces(frame)
                if tracked_faces is not None:
                    return tracked_faces
                else:
                    # 跟踪失败,执行检测
                    self.tracking_active = False
        
        # 执行检测
        start_time = time.time()
        
        # 设置输入尺寸
        height, width = frame.shape[:2]
        self.detector.setInputSize((width, height))
        
        # 检测
        _, faces = self.detector.detect(frame)
        
        detection_time = (time.time() - start_time) * 1000
        self.detection_times.append(detection_time)
        if len(self.detection_times) > 100:
            self.detection_times.pop(0)
        
        # 解析结果
        face_list = []
        if faces is not None and len(faces) > 0:
            for face in faces:
                face_dict = self._parse_face(face)
                face_list.append(face_dict)
            
            # 初始化跟踪器
            if self.use_tracking and len(face_list) > 0:
                self._init_tracker(frame, face_list[0])
        
        return face_list
    
    def _parse_face(self, face: np.ndarray) -> Dict:
        """
        解析人脸数据
        
        YuNet输出格式:
        [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, conf]
        
        其中:
        - x, y, w, h: 边界框
        - re: 右眼, le: 左眼, nt: 鼻尖, rcm: 右嘴角, lcm: 左嘴角
        - conf: 置信度
        """
        x, y, w, h = face[:4].astype(int)
        confidence = float(face[14])
        
        # 5个关键点
        landmarks = []
        for i in range(5):
            lm_x = float(face[4 + i * 2])
            lm_y = float(face[5 + i * 2])
            landmarks.append([lm_x, lm_y])
        
        return {
            'bbox': [x, y, w, h],
            'confidence': confidence,
            'landmarks': landmarks,
            'landmark_names': ['right_eye', 'left_eye', 'nose_tip', 'right_mouth', 'left_mouth']
        }
    
    def _init_tracker(self, frame: np.ndarray, face: Dict):
        """初始化人脸跟踪器"""
        try:
            # 使用KCF跟踪器(速度快,准确率高)
            self.tracker = cv2.TrackerKCF_create()
            
            bbox = face['bbox']
            bbox_tuple = tuple(bbox)
            
            self.tracker.init(frame, bbox_tuple)
            self.tracking_active = True
            self.track_fail_count = 0
            
        except Exception as e:
            print(f"跟踪器初始化失败: {e}")
            self.tracking_active = False
    
    def _track_faces(self, frame: np.ndarray) -> Optional[List[Dict]]:
        """使用跟踪器跟踪人脸"""
        if self.tracker is None:
            return None
        
        try:
            success, bbox = self.tracker.update(frame)
            
            if success:
                # 跟踪成功
                self.track_fail_count = 0
                
                x, y, w, h = map(int, bbox)
                
                # 返回跟踪结果(无关键点和置信度)
                return [{
                    'bbox': [x, y, w, h],
                    'confidence': 0.9,  # 假设跟踪置信度
                    'landmarks': [],
                    'tracked': True
                }]
            else:
                # 跟踪失败
                self.track_fail_count += 1
                
                if self.track_fail_count >= self.max_track_fail:
                    self.tracking_active = False
                
                return None
                
        except Exception as e:
            print(f"跟踪失败: {e}")
            self.tracking_active = False
            return None
    
    def get_avg_detection_time(self) -> float:
        """获取平均检测时间(ms)"""
        if len(self.detection_times) == 0:
            return 0
        return sum(self.detection_times) / len(self.detection_times)
    
    def set_input_size(self, size: Tuple[int, int]):
        """设置输入尺寸"""
        self.input_size = size
        self.detector.setInputSize(size)
    
    def set_score_threshold(self, threshold: float):
        """设置置信度阈值"""
        self.score_threshold = threshold
        self.detector.setScoreThreshold(threshold)


class FaceTracker:
    """
    人脸跟踪器(备用方案)
    使用光流法跟踪人脸关键点
    """
    
    def __init__(self):
        # 光流参数
        self.lk_params = dict(
            winSize=(15, 15),
            maxLevel=2,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03)
        )
        
        self.prev_gray = None
        self.prev_points = None
        
    def init(self, frame: np.ndarray, landmarks: List[List[float]]):
        """初始化跟踪"""
        self.prev_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        self.prev_points = np.array(landmarks, dtype=np.float32).reshape(-1, 1, 2)
    
    def track(self, frame: np.ndarray) -> Optional[List[List[float]]]:
        """跟踪关键点"""
        if self.prev_gray is None or self.prev_points is None:
            return None
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 计算光流
        next_points, status, error = cv2.calcOpticalFlowPyrLK(
            self.prev_gray,
            gray,
            self.prev_points,
            None,
            **self.lk_params
        )
        
        # 检查跟踪质量
        if next_points is None or status is None:
            return None
        
        # 筛选有效点
        good_points = next_points[status == 1]
        
        if len(good_points) < len(self.prev_points) * 0.8:
            # 跟踪质量差
            return None
        
        # 更新
        self.prev_gray = gray
        self.prev_points = next_points
        
        return good_points.reshape(-1, 2).tolist()


# 为了兼容性,添加别名
FaceDetector = YuNetFaceDetector


def draw_faces(frame: np.ndarray, faces: List[Dict], show_landmarks: bool = True) -> np.ndarray:
    """
    在图像上绘制人脸检测结果
    
    Args:
        frame: 输入图像
        faces: 人脸列表
        show_landmarks: 是否显示关键点
        
    Returns:
        绘制后的图像
    """
    output = frame.copy()
    
    for face in faces:
        bbox = face['bbox']
        confidence = face['confidence']
        landmarks = face.get('landmarks', [])
        
        x, y, w, h = bbox
        
        # 绘制边界框
        color = (0, 255, 0) if not face.get('tracked', False) else (255, 255, 0)
        cv2.rectangle(output, (x, y), (x + w, y + h), color, 2)
        
        # 绘制置信度
        text = f"{confidence:.2f}"
        cv2.putText(output, text, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # 绘制关键点
        if show_landmarks and len(landmarks) > 0:
            for lm in landmarks:
                lm_x, lm_y = int(lm[0]), int(lm[1])
                cv2.circle(output, (lm_x, lm_y), 2, (0, 0, 255), -1)
    
    return output


if __name__ == '__main__':
    """测试YuNet人脸检测器"""
    import os
    
    # 模型路径
    model_path = os.path.join(
        os.path.dirname(__file__),
        '../models/face_detection_yunet_2023mar.onnx'
    )
    
    if not os.path.exists(model_path):
        print(f"模型文件不存在: {model_path}")
        exit(1)
    
    # 创建检测器
    detector = YuNetFaceDetector(model_path)
    
    # 打开摄像头
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    print("按 'q' 退出")
    print("按 't' 切换跟踪模式")
    
    fps_list = []
    
    while True:
        start_time = time.time()
        
        ret, frame = cap.read()
        if not ret:
            break
        
        # 检测人脸
        faces = detector.detect(frame)
        
        # 绘制结果
        output = draw_faces(frame, faces)
        
        # 计算FPS
        fps = 1.0 / (time.time() - start_time)
        fps_list.append(fps)
        if len(fps_list) > 30:
            fps_list.pop(0)
        avg_fps = sum(fps_list) / len(fps_list)
        
        # 显示信息
        info_text = f"FPS: {avg_fps:.1f} | Faces: {len(faces)} | Tracking: {detector.tracking_active}"
        cv2.putText(output, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # 显示平均检测时间
        avg_det_time = detector.get_avg_detection_time()
        time_text = f"Detect Time: {avg_det_time:.1f}ms"
        cv2.putText(output, time_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow('YuNet Face Detection', output)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('t'):
            detector.use_tracking = not detector.use_tracking
            print(f"跟踪模式: {detector.use_tracking}")
    
    cap.release()
    cv2.destroyAllWindows()
    
    print(f"\n平均FPS: {sum(fps_list) / len(fps_list):.1f}")
    print(f"平均检测时间: {detector.get_avg_detection_time():.1f}ms")
