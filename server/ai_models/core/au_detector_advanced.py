"""
高级AU检测器 v2.0
- 支持68点和478点人脸模型
- 自适应阈值调整
- 强度级别检测(0-5级)
- 微表情捕捉
- 个性化基线校准
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
import time


class AdvancedAUDetector:
    """
    高级AU检测器
    支持更精确的AU检测和强度评估
    """
    
    # AU定义和描述
    AU_DEFINITIONS = {
        'AU1': {'name': '内眉上扬', 'emotions': ['sadness', 'worry'], 'intensity_range': (0, 5)},
        'AU2': {'name': '外眉上扬', 'emotions': ['surprise'], 'intensity_range': (0, 5)},
        'AU4': {'name': '眉毛下压', 'emotions': ['anger', 'sadness'], 'intensity_range': (0, 5)},
        'AU5': {'name': '上眼睑提升', 'emotions': ['surprise', 'fear'], 'intensity_range': (0, 5)},
        'AU6': {'name': '脸颊上提', 'emotions': ['happiness'], 'intensity_range': (0, 5)},
        'AU7': {'name': '眼睑收紧', 'emotions': ['disgust', 'anger'], 'intensity_range': (0, 5)},
        'AU9': {'name': '鼻皱', 'emotions': ['disgust'], 'intensity_range': (0, 5)},
        'AU10': {'name': '上唇提升', 'emotions': ['disgust'], 'intensity_range': (0, 5)},
        'AU12': {'name': '嘴角上扬', 'emotions': ['happiness'], 'intensity_range': (0, 5)},
        'AU14': {'name': '酒窝', 'emotions': ['happiness'], 'intensity_range': (0, 3)},
        'AU15': {'name': '嘴角下压', 'emotions': ['sadness'], 'intensity_range': (0, 5)},
        'AU17': {'name': '下巴上提', 'emotions': ['sadness'], 'intensity_range': (0, 5)},
        'AU20': {'name': '嘴角外拉', 'emotions': ['fear'], 'intensity_range': (0, 5)},
        'AU23': {'name': '嘴唇收紧', 'emotions': ['anger'], 'intensity_range': (0, 5)},
        'AU24': {'name': '嘴唇压紧', 'emotions': ['anger'], 'intensity_range': (0, 5)},
        'AU25': {'name': '嘴唇分开', 'emotions': ['surprise'], 'intensity_range': (0, 5)},
        'AU26': {'name': '下颌下降', 'emotions': ['surprise'], 'intensity_range': (0, 5)},
        'AU43': {'name': '眼睛闭合', 'emotions': ['fatigue'], 'intensity_range': (0, 5)},
    }
    
    # 自适应阈值(初始值)
    INITIAL_THRESHOLDS = {
        'AU1': 0.06,
        'AU2': 0.08,
        'AU4': 0.06,
        'AU5': 0.10,
        'AU6': 0.04,
        'AU7': 0.08,
        'AU9': 0.06,
        'AU10': 0.07,
        'AU12': 0.03,
        'AU14': 0.05,
        'AU15': 0.03,
        'AU17': 0.05,
        'AU20': 0.06,
        'AU23': 0.06,
        'AU24': 0.07,
        'AU25': 0.08,
        'AU26': 0.12,
        'AU43': 0.10,
    }
    
    def __init__(
        self,
        model_type: str = '68point',
        baseline_frames: int = 50,
        adaptive_threshold: bool = True,
        smoothing_window: int = 7
    ):
        """
        初始化高级AU检测器
        
        Args:
            model_type: 人脸模型类型 ('68point' 或 '478point')
            baseline_frames: 基线校准帧数
            adaptive_threshold: 是否使用自适应阈值
            smoothing_window: 时序平滑窗口大小
        """
        self.model_type = model_type
        self.baseline_frames = baseline_frames
        self.adaptive_threshold = adaptive_threshold
        self.smoothing_window = smoothing_window
        
        # 阈值管理
        self.thresholds = self.INITIAL_THRESHOLDS.copy()
        
        # 基线数据
        self.baseline = {}
        self.baseline_buffer = {au: deque(maxlen=baseline_frames) for au in self.AU_DEFINITIONS.keys()}
        self.baseline_calibrated = False
        self.calibration_progress = 0
        
        # AU历史数据(用于时序平滑)
        self.au_intensity_history = {au: deque(maxlen=smoothing_window) for au in self.AU_DEFINITIONS.keys()}
        self.au_activation_history = {au: deque(maxlen=smoothing_window) for au in self.AU_DEFINITIONS.keys()}
        
        # 微表情检测
        self.micro_expression_buffer = deque(maxlen=30)  # 1秒缓冲
        
        # 统计信息
        self.frame_count = 0
        self.detection_times = deque(maxlen=100)
        self.au_activation_counts = {au: 0 for au in self.AU_DEFINITIONS.keys()}
        
    def detect(self, landmarks: np.ndarray) -> Dict:
        """
        检测AU激活和强度
        
        Args:
            landmarks: 人脸关键点 (68点或478点)
            
        Returns:
            AU检测结果
        """
        start_time = time.time()
        self.frame_count += 1
        
        # 提取AU特征
        au_features = self._extract_au_features(landmarks)
        
        # 基线校准
        if not self.baseline_calibrated:
            self._update_baseline(au_features)
            
        # 计算AU激活和强度
        au_results = {}
        
        for au_name, feature_value in au_features.items():
            if au_name not in self.AU_DEFINITIONS:
                continue
                
            # 获取基线值
            baseline_value = self.baseline.get(au_name, feature_value)
            
            # 计算相对变化
            if abs(baseline_value) > 1e-6:
                relative_change = (feature_value - baseline_value) / abs(baseline_value)
            else:
                relative_change = 0.0
            
            # 计算强度(0-5级)
            intensity = self._calculate_intensity(au_name, abs(relative_change))
            
            # 判断激活
            threshold = self.thresholds.get(au_name, 0.05)
            is_activated = abs(relative_change) > threshold
            
            # 时序平滑
            self.au_intensity_history[au_name].append(intensity)
            self.au_activation_history[au_name].append(is_activated)
            
            smoothed_intensity = np.mean(list(self.au_intensity_history[au_name]))
            smoothed_activation = sum(self.au_activation_history[au_name]) >= len(self.au_activation_history[au_name]) // 2
            
            # 更新激活计数
            if smoothed_activation:
                self.au_activation_counts[au_name] += 1
            
            au_results[au_name] = {
                'activated': smoothed_activation,
                'intensity': smoothed_intensity,
                'raw_value': feature_value,
                'baseline': baseline_value,
                'relative_change': relative_change
            }
        
        # 检测微表情
        micro_expressions = self._detect_micro_expressions(au_results)
        
        # 自适应阈值调整
        if self.adaptive_threshold and self.baseline_calibrated:
            self._adapt_thresholds(au_results)
        
        detection_time = (time.time() - start_time) * 1000
        self.detection_times.append(detection_time)
        
        return {
            'au_results': au_results,
            'au_activations': {au: result['activated'] for au, result in au_results.items()},
            'au_intensities': {au: result['intensity'] for au, result in au_results.items()},
            'micro_expressions': micro_expressions,
            'baseline_calibrated': self.baseline_calibrated,
            'calibration_progress': self.calibration_progress,
            'detection_time': detection_time,
            'avg_detection_time': np.mean(list(self.detection_times)) if self.detection_times else 0
        }
    
    def _extract_au_features(self, landmarks: np.ndarray) -> Dict[str, float]:
        """提取AU特征值"""
        features = {}
        
        if self.model_type == '68point':
            features = self._extract_68point_features(landmarks)
        else:
            features = self._extract_478point_features(landmarks)
        
        return features
    
    def _extract_68point_features(self, landmarks: np.ndarray) -> Dict[str, float]:
        """从68点模型提取AU特征"""
        features = {}
        
        # 提取关键点组
        left_eyebrow = landmarks[17:22]
        right_eyebrow = landmarks[22:27]
        left_eye = landmarks[36:42]
        right_eye = landmarks[42:48]
        nose = landmarks[27:36]
        mouth_outer = landmarks[48:60]
        mouth_inner = landmarks[60:68]
        jaw = landmarks[0:17]
        
        # AU1: 内眉上扬
        inner_brow_left = landmarks[17]
        inner_brow_right = landmarks[26]
        eye_top_left = landmarks[37]
        eye_top_right = landmarks[44]
        features['AU1'] = (
            self._euclidean_distance(inner_brow_left, eye_top_left) +
            self._euclidean_distance(inner_brow_right, eye_top_right)
        ) / 2.0
        
        # AU2: 外眉上扬
        outer_brow_left = landmarks[21]
        outer_brow_right = landmarks[22]
        features['AU2'] = (
            self._euclidean_distance(outer_brow_left, eye_top_left) +
            self._euclidean_distance(outer_brow_right, eye_top_right)
        ) / 2.0
        
        # AU4: 眉毛下压
        brow_center = self._get_center(np.vstack([left_eyebrow, right_eyebrow]))
        nose_bridge = landmarks[27]
        features['AU4'] = self._euclidean_distance(brow_center, nose_bridge)
        
        # AU5: 上眼睑提升
        left_eye_height = self._vertical_distance(landmarks[37], landmarks[41])
        right_eye_height = self._vertical_distance(landmarks[44], landmarks[46])
        features['AU5'] = (left_eye_height + right_eye_height) / 2.0
        
        # AU6: 脸颊上提
        cheek_left = landmarks[3]
        cheek_right = landmarks[13]
        eye_bottom_left = landmarks[41]
        eye_bottom_right = landmarks[46]
        features['AU6'] = (
            self._euclidean_distance(cheek_left, eye_bottom_left) +
            self._euclidean_distance(cheek_right, eye_bottom_right)
        ) / 2.0
        
        # AU7: 眼睑收紧
        left_eye_width = self._euclidean_distance(landmarks[36], landmarks[39])
        right_eye_width = self._euclidean_distance(landmarks[42], landmarks[45])
        features['AU7'] = (left_eye_width + right_eye_width) / 2.0
        
        # AU9: 鼻皱
        nose_top = landmarks[27]
        nose_tip = landmarks[30]
        features['AU9'] = self._euclidean_distance(nose_top, nose_tip)
        
        # AU10: 上唇提升
        upper_lip_top = landmarks[51]
        nose_bottom = landmarks[33]
        features['AU10'] = self._euclidean_distance(upper_lip_top, nose_bottom)
        
        # AU12: 嘴角上扬
        mouth_left = landmarks[48]
        mouth_right = landmarks[54]
        mouth_center = self._get_center(mouth_outer)
        features['AU12'] = (
            self._angle_between_points(mouth_left, mouth_center, landmarks[33]) +
            self._angle_between_points(mouth_right, mouth_center, landmarks[33])
        ) / 2.0
        
        # AU14: 酒窝
        features['AU14'] = features['AU12'] * 0.8  # 简化估计
        
        # AU15: 嘴角下压
        features['AU15'] = -features['AU12']  # 与AU12相反
        
        # AU17: 下巴上提
        chin = landmarks[8]
        lower_lip = landmarks[57]
        features['AU17'] = self._euclidean_distance(chin, lower_lip)
        
        # AU20: 嘴角外拉
        mouth_width = self._euclidean_distance(landmarks[48], landmarks[54])
        features['AU20'] = mouth_width
        
        # AU23: 嘴唇收紧
        upper_lip_height = self._vertical_distance(landmarks[51], landmarks[62])
        lower_lip_height = self._vertical_distance(landmarks[57], landmarks[66])
        features['AU23'] = (upper_lip_height + lower_lip_height) / 2.0
        
        # AU24: 嘴唇压紧
        features['AU24'] = features['AU23'] * 0.9
        
        # AU25: 嘴唇分开
        lip_distance = self._vertical_distance(landmarks[62], landmarks[66])
        features['AU25'] = lip_distance
        
        # AU26: 下颌下降
        jaw_opening = self._vertical_distance(landmarks[51], landmarks[57])
        features['AU26'] = jaw_opening
        
        # AU43: 眼睛闭合
        left_ear = self._calculate_ear(left_eye)
        right_ear = self._calculate_ear(right_eye)
        features['AU43'] = (left_ear + right_ear) / 2.0
        
        return features
    
    def _extract_478point_features(self, landmarks: np.ndarray) -> Dict[str, float]:
        """从478点模型提取AU特征(MediaPipe)"""
        # 简化实现,返回68点特征
        # 实际使用时需要根据478点模型的索引映射
        return self._extract_68point_features(landmarks[:68])
    
    def _calculate_intensity(self, au_name: str, relative_change: float) -> float:
        """
        计算AU强度级别(0-5)
        
        Args:
            au_name: AU名称
            relative_change: 相对变化值
            
        Returns:
            强度级别(0-5)
        """
        # 强度映射
        intensity_map = [
            (0.02, 0),  # 无激活
            (0.05, 1),  # 微弱
            (0.10, 2),  # 轻度
            (0.20, 3),  # 中度
            (0.35, 4),  # 强烈
            (float('inf'), 5)  # 极强
        ]
        
        for threshold, intensity in intensity_map:
            if relative_change < threshold:
                return intensity
        
        return 5
    
    def _update_baseline(self, au_features: Dict[str, float]):
        """更新基线数据"""
        for au_name, value in au_features.items():
            if au_name in self.baseline_buffer:
                self.baseline_buffer[au_name].append(value)
        
        # 检查是否完成校准
        if all(len(buffer) >= self.baseline_frames for buffer in self.baseline_buffer.values()):
            # 计算基线(中位数)
            for au_name, buffer in self.baseline_buffer.items():
                self.baseline[au_name] = np.median(list(buffer))
            
            self.baseline_calibrated = True
            self.calibration_progress = 100
        else:
            # 更新校准进度
            total_frames = sum(len(buffer) for buffer in self.baseline_buffer.values())
            max_frames = len(self.baseline_buffer) * self.baseline_frames
            self.calibration_progress = int((total_frames / max_frames) * 100)
    
    def _detect_micro_expressions(self, au_results: Dict) -> List[Dict]:
        """检测微表情"""
        micro_expressions = []
        
        # 微表情特征:短暂(0.04-0.2秒)、强度高、突然出现
        self.micro_expression_buffer.append(au_results)
        
        if len(self.micro_expression_buffer) < 10:  # 至少需要10帧
            return micro_expressions
        
        # 检测突然的强度变化
        for au_name in self.AU_DEFINITIONS.keys():
            recent_intensities = [
                frame.get(au_name, {}).get('intensity', 0)
                for frame in list(self.micro_expression_buffer)[-10:]
            ]
            
            if len(recent_intensities) < 10:
                continue
            
            # 检测峰值
            max_intensity = max(recent_intensities)
            avg_intensity = np.mean(recent_intensities[:5] + recent_intensities[-5:])
            
            if max_intensity > 3 and max_intensity > avg_intensity * 2:
                micro_expressions.append({
                    'au': au_name,
                    'intensity': max_intensity,
                    'duration': len(recent_intensities) / 30.0,  # 假设30fps
                    'type': 'micro_expression'
                })
        
        return micro_expressions
    
    def _adapt_thresholds(self, au_results: Dict):
        """自适应调整阈值"""
        # 基于激活频率调整阈值
        for au_name in self.AU_DEFINITIONS.keys():
            if self.frame_count < 100:
                continue
            
            activation_rate = self.au_activation_counts[au_name] / self.frame_count
            
            # 如果激活率过高,提高阈值
            if activation_rate > 0.5:
                self.thresholds[au_name] *= 1.01
            # 如果激活率过低,降低阈值
            elif activation_rate < 0.05:
                self.thresholds[au_name] *= 0.99
            
            # 限制阈值范围
            self.thresholds[au_name] = np.clip(
                self.thresholds[au_name],
                self.INITIAL_THRESHOLDS[au_name] * 0.5,
                self.INITIAL_THRESHOLDS[au_name] * 2.0
            )
    
    def reset_baseline(self):
        """重置基线校准"""
        self.baseline = {}
        self.baseline_buffer = {au: deque(maxlen=self.baseline_frames) for au in self.AU_DEFINITIONS.keys()}
        self.baseline_calibrated = False
        self.calibration_progress = 0
        self.frame_count = 0
        self.au_activation_counts = {au: 0 for au in self.AU_DEFINITIONS.keys()}
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        return {
            'frame_count': self.frame_count,
            'baseline_calibrated': self.baseline_calibrated,
            'calibration_progress': self.calibration_progress,
            'avg_detection_time': np.mean(list(self.detection_times)) if self.detection_times else 0,
            'au_activation_rates': {
                au: count / max(self.frame_count, 1)
                for au, count in self.au_activation_counts.items()
            },
            'current_thresholds': self.thresholds.copy()
        }
    
    # 辅助几何计算方法
    def _euclidean_distance(self, p1: np.ndarray, p2: np.ndarray) -> float:
        """计算欧氏距离"""
        return np.linalg.norm(p1 - p2)
    
    def _vertical_distance(self, p1: np.ndarray, p2: np.ndarray) -> float:
        """计算垂直距离"""
        return abs(p1[1] - p2[1])
    
    def _get_center(self, points: np.ndarray) -> np.ndarray:
        """计算点集中心"""
        return np.mean(points, axis=0)
    
    def _angle_between_points(self, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
        """计算三点之间的角度"""
        v1 = p1 - p2
        v2 = p3 - p2
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        return np.arccos(np.clip(cos_angle, -1.0, 1.0))
    
    def _calculate_ear(self, eye_points: np.ndarray) -> float:
        """计算眼睛纵横比(EAR)"""
        A = self._euclidean_distance(eye_points[1], eye_points[5])
        B = self._euclidean_distance(eye_points[2], eye_points[4])
        C = self._euclidean_distance(eye_points[0], eye_points[3])
        ear = (A + B) / (2.0 * C + 1e-6)
        return ear
