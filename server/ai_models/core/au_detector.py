"""
AU (Action Unit) 微表情检测器
基于面部关键点几何特征检测AU激活
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
import time


class AUDetector:
    """
    AU (Action Unit) 检测器
    基于FACS(面部动作编码系统)
    
    支持的AU:
    - AU1: 眉毛内侧上扬 (悲伤、担忧)
    - AU2: 眉毛外侧上扬 (惊讶)
    - AU4: 眉毛下压 (愤怒、困惑)
    - AU5: 上眼睑提升 (惊讶、恐惧)
    - AU6: 脸颊上提 (快乐)
    - AU7: 眼睑收紧 (厌恶、愤怒)
    - AU9: 鼻皱 (厌恶)
    - AU12: 嘴角上扬 (快乐)
    - AU15: 嘴角下压 (悲伤)
    - AU17: 下巴提升 (悲伤、怀疑)
    - AU20: 嘴角外拉 (恐惧)
    - AU25: 嘴唇分开 (惊讶)
    - AU26: 下颌下降 (惊讶)
    - AU43: 眼睛闭合 (疲劳、眨眼)
    """
    
    # AU激活阈值 (降低阈值提高灵敏度)
    AU_THRESHOLDS = {
        'AU1': 0.08,   # 眉毛内侧上扬 (悲伤)
        'AU2': 0.10,   # 眉毛外侧上扬 (惊讶)
        'AU4': 0.08,   # 眉毛下压 (愤怒)
        'AU5': 0.12,   # 上眼睑提升 (惊讶)
        'AU6': 0.06,   # 脸颊上提 (快乐)
        'AU7': 0.10,   # 眼睑收紧 (厌恶)
        'AU9': 0.08,   # 鼻皱 (厌恶)
        'AU12': 0.05,  # 嘴角上扬 (快乐)
        'AU15': 0.05,  # 嘴角下压 (悲伤)
        'AU17': 0.07,  # 下巴提升 (悲伤)
        'AU20': 0.08,  # 嘴角外拉 (恐惧)
        'AU25': 0.10,  # 嘴唇分开 (惊讶)
        'AU26': 0.15,  # 下颌下降 (惊讶)
        'AU43': 0.12   # 眼睛闭合 (疲劳)
    }
    
    def __init__(self, baseline_frames: int = 30):
        """
        初始化AU检测器
        
        Args:
            baseline_frames: 基线校准帧数
        """
        self.baseline_frames = baseline_frames
        
        # 基线数据(用于个体差异校准)
        self.baseline = {}
        self.baseline_buffer = {}
        self.baseline_calibrated = False
        
        # AU激活历史(用于时序平滑)
        self.au_history = {au: deque(maxlen=5) for au in self.AU_THRESHOLDS.keys()}
        
        # 性能统计
        self.detection_times = []
        
    def detect(self, key_points: Dict[str, List[List[float]]]) -> Dict[str, any]:
        """
        检测AU激活
        
        Args:
            key_points: 关键点字典,包含:
                - left_eye: 左眼关键点
                - right_eye: 右眼关键点
                - left_eyebrow: 左眉关键点
                - right_eyebrow: 右眉关键点
                - mouth_outer: 嘴巴外轮廓
                - mouth_inner: 嘴巴内轮廓
                - nose: 鼻子关键点
                - face_oval: 脸部轮廓
                
        Returns:
            AU检测结果:
            - au_activations: AU激活字典 {AU名称: bool}
            - au_intensities: AU强度字典 {AU名称: float}
            - micro_expressions: 识别的微表情列表
        """
        start_time = time.time()
        
        # 计算AU特征
        au_features = self._calculate_au_features(key_points)
        
        # 基线校准
        if not self.baseline_calibrated:
            self._update_baseline(au_features)
        
        # 检测AU激活
        au_activations = {}
        au_intensities = {}
        
        for au_name, feature_value in au_features.items():
            # 与基线对比
            baseline_value = self.baseline.get(au_name, feature_value)
            
            # 计算激活强度
            if baseline_value != 0:
                intensity = (feature_value - baseline_value) / abs(baseline_value)
            else:
                intensity = 0.0
            
            # 判断是否激活
            threshold = self.AU_THRESHOLDS.get(au_name, 0.15)
            activated = abs(intensity) > threshold
            
            # 时序平滑
            self.au_history[au_name].append(activated)
            smoothed_activation = sum(self.au_history[au_name]) >= len(self.au_history[au_name]) // 2
            
            au_activations[au_name] = smoothed_activation
            au_intensities[au_name] = intensity
        
        # 识别微表情
        micro_expressions = self._classify_micro_expressions(au_activations, au_intensities)
        
        detection_time = (time.time() - start_time) * 1000
        self.detection_times.append(detection_time)
        if len(self.detection_times) > 100:
            self.detection_times.pop(0)
        
        return {
            'au_activations': au_activations,
            'au_intensities': au_intensities,
            'micro_expressions': micro_expressions,
            'detection_time': detection_time
        }
    
    def _calculate_au_features(self, key_points) -> Dict[str, float]:
        """计算AU特征值"""
        features = {}
        
        # 处理不同格式的关键点
        if isinstance(key_points, dict):
            # 字典格式
            left_eye = key_points.get('left_eye', [])
            right_eye = key_points.get('right_eye', [])
            left_eyebrow = key_points.get('left_eyebrow', [])
            right_eyebrow = key_points.get('right_eyebrow', [])
            mouth_outer = key_points.get('mouth_outer', [])
            mouth_inner = key_points.get('mouth_inner', [])
            nose = key_points.get('nose', [])
        else:
            # numpy数组格式 (68点模型)
            import numpy as np
            if isinstance(key_points, np.ndarray):
                # 从68点模型中提取关键点
                left_eye = key_points[36:42]  # 左眼
                right_eye = key_points[42:48]  # 右眼
                left_eyebrow = key_points[17:22]  # 左眉
                right_eyebrow = key_points[22:27]  # 右眉
                mouth_outer = key_points[48:60]  # 外嘴唇
                mouth_inner = key_points[60:68]  # 内嘴唇
                nose = key_points[27:36]  # 鼻子
            else:
                # 无法处理的格式
                return features
        
        # AU1: 眉毛内侧上扬
        if len(left_eyebrow) > 0 and len(left_eye) > 0:
            inner_brow = left_eyebrow[0]
            eye_top = left_eye[1]
            features['AU1'] = self._euclidean_distance(inner_brow, eye_top)
        
        # AU2: 眉毛外侧上扬
        if len(left_eyebrow) > 2 and len(left_eye) > 0:
            outer_brow = left_eyebrow[-1]
            eye_top = left_eye[1]
            features['AU2'] = self._euclidean_distance(outer_brow, eye_top)
        
        # AU4: 眉毛下压
        if len(left_eyebrow) > 0 and len(right_eyebrow) > 0:
            left_brow_center = self._get_center(left_eyebrow)
            right_brow_center = self._get_center(right_eyebrow)
            brow_center = self._midpoint(left_brow_center, right_brow_center)
            
            if len(nose) > 0:
                nose_bridge = nose[0]
                features['AU4'] = -self._euclidean_distance(brow_center, nose_bridge)
        
        # AU5: 上眼睑提升
        if len(left_eye) > 2:
            eye_height = self._vertical_distance(left_eye[1], left_eye[5])
            features['AU5'] = eye_height
        
        # AU6: 脸颊上提
        if len(left_eye) > 0 and len(mouth_outer) > 0:
            eye_bottom = left_eye[4]
            mouth_corner = mouth_outer[0]
            features['AU6'] = -self._euclidean_distance(eye_bottom, mouth_corner)
        
        # AU7: 眼睑收紧
        if len(left_eye) > 2:
            eye_openness = self._vertical_distance(left_eye[1], left_eye[5])
            features['AU7'] = -eye_openness
        
        # AU9: 鼻皱
        if len(nose) > 3:
            nose_width = self._horizontal_distance(nose[1], nose[2])
            features['AU9'] = nose_width
        
        # AU12: 嘴角上扬
        if len(mouth_outer) >= 6:
            left_corner = mouth_outer[0]
            right_corner = mouth_outer[6]
            mouth_center = mouth_outer[3]
            
            left_height = mouth_center[1] - left_corner[1]
            right_height = mouth_center[1] - right_corner[1]
            features['AU12'] = (left_height + right_height) / 2.0
        
        # AU15: 嘴角下压
        if len(mouth_outer) >= 6:
            left_corner = mouth_outer[0]
            right_corner = mouth_outer[6]
            mouth_center = mouth_outer[3]
            
            left_height = left_corner[1] - mouth_center[1]
            right_height = right_corner[1] - mouth_center[1]
            features['AU15'] = (left_height + right_height) / 2.0
        
        # AU17: 下巴提升
        if len(mouth_outer) > 0:
            bottom_lip = mouth_outer[9] if len(mouth_outer) > 9 else mouth_outer[-1]
            # 简化:使用y坐标
            features['AU17'] = -bottom_lip[1]
        
        # AU20: 嘴角外拉
        if len(mouth_outer) >= 6:
            left_corner = mouth_outer[0]
            right_corner = mouth_outer[6]
            mouth_width = self._horizontal_distance(left_corner, right_corner)
            features['AU20'] = mouth_width
        
        # AU25: 嘴唇分开
        if len(mouth_outer) > 3 and len(mouth_inner) > 3:
            upper_lip = mouth_outer[3]
            lower_lip = mouth_outer[9] if len(mouth_outer) > 9 else mouth_outer[-1]
            lip_distance = self._vertical_distance(upper_lip, lower_lip)
            features['AU25'] = lip_distance
        
        # AU26: 下颌下降
        if len(mouth_outer) > 9:
            upper_lip = mouth_outer[3]
            lower_lip = mouth_outer[9]
            jaw_drop = self._vertical_distance(upper_lip, lower_lip)
            features['AU26'] = jaw_drop
        
        # AU43: 眼睛闭合
        if len(left_eye) > 2 and len(right_eye) > 2:
            left_ear = self._calculate_ear(left_eye)
            right_ear = self._calculate_ear(right_eye)
            avg_ear = (left_ear + right_ear) / 2.0
            features['AU43'] = -avg_ear  # 负值,因为闭眼时EAR降低
        
        return features
    
    def _classify_micro_expressions(self, au_activations: Dict, au_intensities: Dict) -> List[str]:
        """基于AU组合识别微表情"""
        expressions = []
        
        # 真实微笑 (Duchenne Smile: AU6 + AU12)
        if au_activations.get('AU6', False) and au_activations.get('AU12', False):
            expressions.append('genuine_smile')
        
        # 假笑 (AU12 only, no AU6)
        elif au_activations.get('AU12', False) and not au_activations.get('AU6', False):
            expressions.append('fake_smile')
        
        # 悲伤 (AU1 + AU4 + AU15)
        if au_activations.get('AU1', False) and au_activations.get('AU15', False):
            expressions.append('sadness')
        
        # 担忧 (AU1 + AU4)
        if au_activations.get('AU1', False) and au_activations.get('AU4', False):
            expressions.append('worry')
        
        # 愤怒 (AU4 + AU7)
        if au_activations.get('AU4', False) and au_activations.get('AU7', False):
            expressions.append('anger')
        
        # 厌恶 (AU9 + AU7)
        if au_activations.get('AU9', False) and au_activations.get('AU7', False):
            expressions.append('disgust')
        
        # 恐惧 (AU1 + AU2 + AU5 + AU20)
        if (au_activations.get('AU1', False) and au_activations.get('AU2', False) and
            au_activations.get('AU5', False)):
            expressions.append('fear')
        
        # 惊讶 (AU1 + AU2 + AU5 + AU26)
        if (au_activations.get('AU1', False) and au_activations.get('AU2', False) and
            au_activations.get('AU26', False)):
            expressions.append('surprise')
        
        # 疲劳 (AU43频繁)
        if au_activations.get('AU43', False):
            expressions.append('fatigue')
        
        return expressions
    
    def _update_baseline(self, au_features: Dict):
        """更新基线数据"""
        for au_name, value in au_features.items():
            if au_name not in self.baseline_buffer:
                self.baseline_buffer[au_name] = []
            
            self.baseline_buffer[au_name].append(value)
            
            # 达到基线帧数后计算平均值
            if len(self.baseline_buffer[au_name]) >= self.baseline_frames:
                self.baseline[au_name] = np.mean(self.baseline_buffer[au_name])
        
        # 检查是否所有AU都已校准
        if len(self.baseline) >= len(self.AU_THRESHOLDS):
            self.baseline_calibrated = True
    
    def reset_baseline(self):
        """重置基线"""
        self.baseline = {}
        self.baseline_buffer = {}
        self.baseline_calibrated = False
    
    @staticmethod
    def _euclidean_distance(pt1: List[float], pt2: List[float]) -> float:
        """计算欧氏距离"""
        return np.sqrt((pt1[0] - pt2[0])**2 + (pt1[1] - pt2[1])**2)
    
    @staticmethod
    def _vertical_distance(pt1: List[float], pt2: List[float]) -> float:
        """计算垂直距离"""
        return abs(pt1[1] - pt2[1])
    
    @staticmethod
    def _horizontal_distance(pt1: List[float], pt2: List[float]) -> float:
        """计算水平距离"""
        return abs(pt1[0] - pt2[0])
    
    @staticmethod
    def _get_center(points: List[List[float]]) -> List[float]:
        """计算点集中心"""
        if len(points) == 0:
            return [0, 0]
        x = sum(p[0] for p in points) / len(points)
        y = sum(p[1] for p in points) / len(points)
        return [x, y]
    
    @staticmethod
    def _midpoint(pt1: List[float], pt2: List[float]) -> List[float]:
        """计算中点"""
        return [(pt1[0] + pt2[0]) / 2.0, (pt1[1] + pt2[1]) / 2.0]
    
    @staticmethod
    def _calculate_ear(eye_points: List[List[float]]) -> float:
        """计算眼睛纵横比(EAR)"""
        if len(eye_points) < 6:
            return 0.0
        
        p1, p2, p3, p4, p5, p6 = eye_points[:6]
        
        def dist(pt1, pt2):
            return np.sqrt((pt1[0] - pt2[0])**2 + (pt1[1] - pt2[1])**2)
        
        vertical1 = dist(p2, p6)
        vertical2 = dist(p3, p5)
        horizontal = dist(p1, p4)
        
        if horizontal == 0:
            return 0.0
        
        ear = (vertical1 + vertical2) / (2.0 * horizontal)
        
        return ear
    
    def get_avg_detection_time(self) -> float:
        """获取平均检测时间(ms)"""
        if len(self.detection_times) == 0:
            return 0
        return sum(self.detection_times) / len(self.detection_times)


class MicroExpressionClassifier:
    """微表情分类器"""
    
    # 微表情与情绪的映射
    EXPRESSION_EMOTION_MAP = {
        'genuine_smile': 'happy',
        'fake_smile': 'neutral',
        'sadness': 'sad',
        'worry': 'sad',
        'anger': 'angry',
        'disgust': 'disgust',
        'fear': 'fear',
        'surprise': 'surprise',
        'fatigue': 'neutral'
    }
    
    @classmethod
    def classify_emotion(cls, micro_expressions: List[str]) -> Optional[str]:
        """根据微表情推断情绪"""
        if not micro_expressions:
            return None
        
        # 优先级:悲伤 > 愤怒 > 恐惧 > 厌恶 > 惊讶 > 快乐
        priority = ['sadness', 'worry', 'anger', 'fear', 'disgust', 'surprise', 'genuine_smile']
        
        for expr in priority:
            if expr in micro_expressions:
                return cls.EXPRESSION_EMOTION_MAP.get(expr)
        
        # 默认返回第一个
        return cls.EXPRESSION_EMOTION_MAP.get(micro_expressions[0])


if __name__ == '__main__':
    """测试AU检测器"""
    import sys
    import os
    import cv2
    
    # 导入依赖模块
    sys.path.insert(0, os.path.dirname(__file__))
    from face_detector import YuNetFaceDetector
    from landmark_detector import FaceLandmarkDetector
    
    # 模型路径
    model_path = os.path.join(
        os.path.dirname(__file__),
        '../models/face_detection_yunet_2023mar.onnx'
    )
    
    if not os.path.exists(model_path):
        print(f"模型文件不存在: {model_path}")
        exit(1)
    
    # 创建检测器
    face_detector = YuNetFaceDetector(model_path)
    landmark_detector = FaceLandmarkDetector()
    au_detector = AUDetector()
    
    # 打开摄像头
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    print("按 'q' 退出")
    print("按 'r' 重置基线")
    print("\n正在进行基线校准,请保持中性表情...")
    
    fps_list = []
    
    while True:
        start_time = time.time()
        
        ret, frame = cap.read()
        if not ret:
            break
        
        # 检测人脸
        faces = face_detector.detect(frame)
        
        output = frame.copy()
        
        if len(faces) > 0:
            face = faces[0]
            bbox = face['bbox']
            
            # 绘制人脸框
            x, y, w, h = bbox
            cv2.rectangle(output, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            # 检测关键点
            landmark_result = landmark_detector.detect(frame, bbox)
            
            if landmark_result is not None:
                key_points = landmark_result['key_points']
                
                # 检测AU
                au_result = au_detector.detect(key_points)
                
                au_activations = au_result['au_activations']
                micro_expressions = au_result['micro_expressions']
                
                # 显示激活的AU
                y_offset = 90
                active_aus = [au for au, active in au_activations.items() if active]
                
                if active_aus:
                    au_text = "Active AUs: " + ", ".join(active_aus)
                    cv2.putText(output, au_text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
                    y_offset += 25
                
                # 显示微表情
                if micro_expressions:
                    expr_text = "Expressions: " + ", ".join(micro_expressions)
                    cv2.putText(output, expr_text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
                    y_offset += 25
                
                # 显示基线状态
                baseline_text = f"Baseline: {'Calibrated' if au_detector.baseline_calibrated else 'Calibrating...'}"
                cv2.putText(output, baseline_text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
        
        # 计算FPS
        fps = 1.0 / (time.time() - start_time)
        fps_list.append(fps)
        if len(fps_list) > 30:
            fps_list.pop(0)
        avg_fps = sum(fps_list) / len(fps_list)
        
        # 显示信息
        info_text = f"FPS: {avg_fps:.1f} | Faces: {len(faces)}"
        cv2.putText(output, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # 显示检测时间
        if len(faces) > 0 and landmark_result is not None:
            det_time = au_result['detection_time']
            time_text = f"AU Time: {det_time:.1f}ms"
            cv2.putText(output, time_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow('AU Detection', output)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            au_detector.reset_baseline()
            print("基线已重置,请保持中性表情...")
    
    cap.release()
    cv2.destroyAllWindows()
    landmark_detector.close()
    
    print(f"\n平均FPS: {sum(fps_list) / len(fps_list):.1f}")
    print(f"平均AU检测时间: {au_detector.get_avg_detection_time():.1f}ms")
