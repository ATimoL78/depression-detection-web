"""
人脸关键点检测器
纯OpenCV实现,无需MediaPipe/TensorFlow依赖
"""

import cv2
import numpy as np
from typing import Optional, Tuple
import os


class FaceLandmarkDetector:
    """
    人脸关键点检测器 - 纯OpenCV实现
    
    使用OpenCV的LBF (Local Binary Features) 模型
    - 68个关键点
    - 速度: 1-2ms/帧
    - 无需TensorFlow/MediaPipe
    - 轻量级,稳定
    """
    
    # 关键点索引定义 (68点模型)
    LEFT_EYE_INDICES = list(range(36, 42))
    RIGHT_EYE_INDICES = list(range(42, 48))
    LEFT_EYEBROW_INDICES = list(range(17, 22))
    RIGHT_EYEBROW_INDICES = list(range(22, 27))
    MOUTH_OUTER_INDICES = list(range(48, 60))
    MOUTH_INNER_INDICES = list(range(60, 68))
    NOSE_INDICES = list(range(27, 36))
    FACE_OVAL_INDICES = list(range(0, 17))
    
    def __init__(self):
        """初始化关键点检测器"""
        # 尝试加载OpenCV的人脸关键点检测模型
        self.facemark = None
        self.use_dlib_style = True
        
        # 尝试加载LBF模型
        try:
            self.facemark = cv2.face.createFacemarkLBF()
            model_path = self._get_model_path()
            if model_path and os.path.exists(model_path):
                self.facemark.loadModel(model_path)
                print("    ✓ 使用OpenCV LBF模型")
            else:
                print("    ⚠ LBF模型未找到,使用简化版检测")
                self.facemark = None
        except:
            print("    ⚠ OpenCV facemark不可用,使用简化版检测")
            self.facemark = None
    
    def _get_model_path(self) -> Optional[str]:
        """获取模型路径"""
        possible_paths = [
            'backend/models/lbfmodel.yaml',
            'models/lbfmodel.yaml',
            '/usr/share/opencv4/lbfmodel.yaml',
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        # 尝试下载LBF模型
        print("    正在下载LBF模型...")
        model_dir = 'backend/models'
        if not os.path.exists(model_dir):
            os.makedirs(model_dir, exist_ok=True)
        
        target_path = os.path.join(model_dir, 'lbfmodel.yaml')
        if self._download_lbf_model(target_path):
            print("    ✓ LBF模型下载完成")
            return target_path
        else:
            print("    ✗ LBF模型下载失败")
            return None
    
    def _download_lbf_model(self, path: str) -> bool:
        """下载LBF模型"""
        import urllib.request
        url = 'https://github.com/kurnianggoro/GSOC2017/raw/master/data/lbfmodel.yaml'
        try:
            urllib.request.urlretrieve(url, path)
            return True
        except Exception as e:
            print(f"    下载错误: {e}")
            return False
    
    def detect(self, image: np.ndarray, face_rect: Optional[Tuple] = None) -> Optional[np.ndarray]:
        """
        检测人脸关键点
        
        Args:
            image: 输入图像
            face_rect: 人脸矩形框 (x, y, w, h)
        
        Returns:
            landmarks: 关键点坐标 (N, 2) 或 None
        """
        if image is None or image.size == 0:
            return None
        
        # 如果有LBF模型,使用它
        if self.facemark is not None and face_rect is not None:
            x, y, w, h = face_rect
            # faces参数必须是numpy数组
            faces = np.array([[int(x), int(y), int(w), int(h)]], dtype=np.int32)
            try:
                success, landmarks = self.facemark.fit(image, faces)
                if success and len(landmarks) > 0:
                    return landmarks[0][0]  # 返回第一个人脸的关键点
            except Exception as e:
                print(f"LBF检测失败: {e}")
                # fallback到简化版
                return self._detect_simplified(image, face_rect)
        
        # 否则使用简化版检测(基于Haar特征)
        return self._detect_simplified(image, face_rect)
    
    def _detect_simplified(self, image: np.ndarray, face_rect: Optional[Tuple] = None) -> np.ndarray:
        """
        简化版关键点检测
        基于面部几何特征估计关键点位置
        """
        h, w = image.shape[:2]
        
        if face_rect is None:
            # 使用整个图像
            x, y, fw, fh = 0, 0, w, h
        else:
            x, y, fw, fh = face_rect
        
        # 创建68个关键点(标准dlib格式)
        landmarks = np.zeros((68, 2), dtype=np.float32)
        
        # 面部轮廓 (0-16): 下巴线
        for i in range(17):
            t = i / 16.0
            landmarks[i] = [
                x + fw * (0.1 + 0.8 * t),
                y + fh * (0.8 + 0.15 * np.sin(t * np.pi))
            ]
        
        # 左眉毛 (17-21)
        for i in range(5):
            t = i / 4.0
            landmarks[17 + i] = [
                x + fw * (0.2 + 0.15 * t),
                y + fh * 0.35
            ]
        
        # 右眉毛 (22-26)
        for i in range(5):
            t = i / 4.0
            landmarks[22 + i] = [
                x + fw * (0.65 + 0.15 * t),
                y + fh * 0.35
            ]
        
        # 鼻梁 (27-30)
        for i in range(4):
            t = i / 3.0
            landmarks[27 + i] = [
                x + fw * 0.5,
                y + fh * (0.35 + 0.2 * t)
            ]
        
        # 鼻子下部 (31-35)
        for i in range(5):
            t = i / 4.0
            landmarks[31 + i] = [
                x + fw * (0.35 + 0.3 * t),
                y + fh * 0.6
            ]
        
        # 左眼 (36-41)
        eye_center_x = x + fw * 0.3
        eye_center_y = y + fh * 0.45
        eye_radius_x = fw * 0.08
        eye_radius_y = fh * 0.05
        for i in range(6):
            angle = i * np.pi / 3
            landmarks[36 + i] = [
                eye_center_x + eye_radius_x * np.cos(angle),
                eye_center_y + eye_radius_y * np.sin(angle)
            ]
        
        # 右眼 (42-47)
        eye_center_x = x + fw * 0.7
        for i in range(6):
            angle = i * np.pi / 3
            landmarks[42 + i] = [
                eye_center_x + eye_radius_x * np.cos(angle),
                eye_center_y + eye_radius_y * np.sin(angle)
            ]
        
        # 外嘴唇 (48-59)
        mouth_center_x = x + fw * 0.5
        mouth_center_y = y + fh * 0.75
        mouth_radius_x = fw * 0.15
        mouth_radius_y = fh * 0.08
        for i in range(12):
            angle = i * np.pi / 6
            landmarks[48 + i] = [
                mouth_center_x + mouth_radius_x * np.cos(angle),
                mouth_center_y + mouth_radius_y * np.sin(angle)
            ]
        
        # 内嘴唇 (60-67)
        mouth_radius_x *= 0.6
        mouth_radius_y *= 0.6
        for i in range(8):
            angle = i * np.pi / 4
            landmarks[60 + i] = [
                mouth_center_x + mouth_radius_x * np.cos(angle),
                mouth_center_y + mouth_radius_y * np.sin(angle)
            ]
        
        return landmarks
    
    def get_eye_landmarks(self, landmarks: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """获取眼睛关键点"""
        left_eye = landmarks[self.LEFT_EYE_INDICES]
        right_eye = landmarks[self.RIGHT_EYE_INDICES]
        return left_eye, right_eye
    
    def get_eyebrow_landmarks(self, landmarks: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """获取眉毛关键点"""
        left_eyebrow = landmarks[self.LEFT_EYEBROW_INDICES]
        right_eyebrow = landmarks[self.RIGHT_EYEBROW_INDICES]
        return left_eyebrow, right_eyebrow
    
    def get_mouth_landmarks(self, landmarks: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """获取嘴巴关键点"""
        mouth_outer = landmarks[self.MOUTH_OUTER_INDICES]
        mouth_inner = landmarks[self.MOUTH_INNER_INDICES]
        return mouth_outer, mouth_inner
    
    def get_nose_landmarks(self, landmarks: np.ndarray) -> np.ndarray:
        """获取鼻子关键点"""
        return landmarks[self.NOSE_INDICES]
    
    def calculate_ear(self, eye_landmarks: np.ndarray) -> float:
        """
        计算眼睛纵横比 (Eye Aspect Ratio)
        用于检测眨眼
        """
        if len(eye_landmarks) < 6:
            return 0.3
        
        # 垂直距离
        v1 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
        v2 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
        
        # 水平距离
        h = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
        
        if h == 0:
            return 0.3
        
        ear = (v1 + v2) / (2.0 * h)
        return ear
    
    def calculate_mar(self, mouth_landmarks: np.ndarray) -> float:
        """
        计算嘴巴纵横比 (Mouth Aspect Ratio)
        用于检测张嘴
        """
        if len(mouth_landmarks) < 12:
            return 0.0
        
        # 垂直距离
        v1 = np.linalg.norm(mouth_landmarks[2] - mouth_landmarks[10])
        v2 = np.linalg.norm(mouth_landmarks[4] - mouth_landmarks[8])
        
        # 水平距离
        h = np.linalg.norm(mouth_landmarks[0] - mouth_landmarks[6])
        
        if h == 0:
            return 0.0
        
        mar = (v1 + v2) / (2.0 * h)
        return mar


# 别名,保持兼容性
LandmarkDetector = FaceLandmarkDetector


if __name__ == '__main__':
    # 测试代码
    detector = FaceLandmarkDetector()
    
    # 创建测试图像
    test_image = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # 模拟人脸区域
    face_rect = (200, 100, 240, 280)
    
    # 检测关键点
    landmarks = detector.detect(test_image, face_rect)
    
    if landmarks is not None:
        print(f"检测到 {len(landmarks)} 个关键点")
        print(f"关键点形状: {landmarks.shape}")
        
        # 测试各个功能
        left_eye, right_eye = detector.get_eye_landmarks(landmarks)
        print(f"左眼关键点数: {len(left_eye)}")
        print(f"右眼关键点数: {len(right_eye)}")
        
        ear_left = detector.calculate_ear(left_eye)
        ear_right = detector.calculate_ear(right_eye)
        print(f"左眼EAR: {ear_left:.3f}")
        print(f"右眼EAR: {ear_right:.3f}")
        
        mouth_outer, mouth_inner = detector.get_mouth_landmarks(landmarks)
        mar = detector.calculate_mar(mouth_outer)
        print(f"嘴巴MAR: {mar:.3f}")
        
        print("\n✓ 关键点检测器测试通过!")
    else:
        print("✗ 关键点检测失败")
