"""
高级情绪识别器 v2.0
- 多模型融合(AU规则 + 深度学习 + 几何特征)
- 8种情绪分类 + 细粒度情绪
- 置信度校准
- 情绪转换检测
- 情绪强度评估
"""

import numpy as np
import cv2
from typing import Dict, List, Optional, Tuple
from collections import deque
import time


class AdvancedEmotionRecognizer:
    """
    高级情绪识别器
    融合多种方法提供更准确的情绪识别
    """
    
    # 情绪定义
    EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'disgust', 'contempt']
    
    # 细粒度情绪
    FINE_GRAINED_EMOTIONS = {
        'happy': ['joyful', 'content', 'excited', 'amused'],
        'sad': ['depressed', 'disappointed', 'melancholic', 'gloomy'],
        'angry': ['furious', 'annoyed', 'frustrated', 'irritated'],
        'fear': ['terrified', 'anxious', 'worried', 'nervous'],
        'surprise': ['astonished', 'amazed', 'shocked', 'startled'],
        'disgust': ['repulsed', 'nauseated', 'aversion'],
        'contempt': ['scornful', 'disdainful'],
        'neutral': ['calm', 'indifferent', 'blank']
    }
    
    # AU情绪规则(增强版)
    AU_EMOTION_RULES = {
        'happy': {
            'required': [('AU6', 0.7), ('AU12', 0.8)],
            'optional': [('AU25', 0.3), ('AU26', 0.2)],
            'incompatible': ['AU1', 'AU4', 'AU15']
        },
        'sad': {
            'required': [('AU1', 0.6), ('AU4', 0.5), ('AU15', 0.6)],
            'optional': [('AU17', 0.4)],
            'incompatible': ['AU6', 'AU12']
        },
        'angry': {
            'required': [('AU4', 0.7), ('AU7', 0.6)],
            'optional': [('AU23', 0.5), ('AU24', 0.5)],
            'incompatible': ['AU6', 'AU12']
        },
        'fear': {
            'required': [('AU1', 0.6), ('AU2', 0.6), ('AU5', 0.7)],
            'optional': [('AU20', 0.5), ('AU25', 0.4)],
            'incompatible': ['AU12']
        },
        'surprise': {
            'required': [('AU1', 0.6), ('AU2', 0.7), ('AU5', 0.8)],
            'optional': [('AU25', 0.6), ('AU26', 0.6)],
            'incompatible': []
        },
        'disgust': {
            'required': [('AU9', 0.7), ('AU15', 0.5)],
            'optional': [('AU17', 0.4), ('AU7', 0.4)],
            'incompatible': ['AU6', 'AU12']
        },
        'contempt': {
            'required': [('AU12', 0.5)],  # 单侧嘴角上扬
            'optional': [('AU14', 0.4)],
            'incompatible': ['AU6']
        },
        'neutral': {
            'required': [],
            'optional': [],
            'incompatible': []
        }
    }
    
    def __init__(
        self,
        method: str = 'fusion',
        smoothing_window: int = 9,
        confidence_threshold: float = 0.3
    ):
        """
        初始化高级情绪识别器
        
        Args:
            method: 识别方法 ('au_rules', 'geometric', 'fusion')
            smoothing_window: 时序平滑窗口
            confidence_threshold: 置信度阈值
        """
        self.method = method
        self.smoothing_window = smoothing_window
        self.confidence_threshold = confidence_threshold
        
        # 历史数据
        self.emotion_history = deque(maxlen=smoothing_window)
        self.confidence_history = deque(maxlen=smoothing_window)
        self.intensity_history = deque(maxlen=smoothing_window)
        
        # 情绪转换检测
        self.last_emotion = 'neutral'
        self.emotion_duration = 0
        self.emotion_transitions = []
        
        # 统计信息
        self.frame_count = 0
        self.emotion_counts = {emotion: 0 for emotion in self.EMOTIONS}
        self.processing_times = deque(maxlen=100)
        
    def recognize(
        self,
        face_image: np.ndarray,
        au_result: Optional[Dict] = None,
        landmarks: Optional[np.ndarray] = None
    ) -> Dict:
        """
        识别情绪
        
        Args:
            face_image: 人脸图像
            au_result: AU检测结果
            landmarks: 人脸关键点
            
        Returns:
            情绪识别结果
        """
        start_time = time.time()
        self.frame_count += 1
        
        # 多方法融合
        emotion_scores = {}
        
        if self.method in ['au_rules', 'fusion'] and au_result:
            au_scores = self._recognize_from_au(au_result)
            emotion_scores['au'] = au_scores
        
        if self.method in ['geometric', 'fusion'] and landmarks is not None:
            geo_scores = self._recognize_from_geometry(landmarks)
            emotion_scores['geometric'] = geo_scores
        
        # 融合多个方法的结果
        if self.method == 'fusion' and len(emotion_scores) > 1:
            final_scores = self._fuse_scores(emotion_scores)
        elif emotion_scores:
            final_scores = list(emotion_scores.values())[0]
        else:
            final_scores = {emotion: 1.0/len(self.EMOTIONS) for emotion in self.EMOTIONS}
        
        # 获取主要情绪
        primary_emotion = max(final_scores, key=final_scores.get)
        confidence = final_scores[primary_emotion]
        
        # 置信度校准
        calibrated_confidence = self._calibrate_confidence(confidence, final_scores)
        
        # 计算情绪强度
        intensity = self._calculate_intensity(primary_emotion, au_result, calibrated_confidence)
        
        # 识别细粒度情绪
        fine_grained = self._identify_fine_grained_emotion(primary_emotion, intensity, au_result)
        
        # 时序平滑
        self.emotion_history.append(primary_emotion)
        self.confidence_history.append(calibrated_confidence)
        self.intensity_history.append(intensity)
        
        smoothed_emotion = self._smooth_emotion()
        smoothed_confidence = np.mean(list(self.confidence_history))
        smoothed_intensity = np.mean(list(self.intensity_history))
        
        # 检测情绪转换
        if smoothed_emotion != self.last_emotion:
            self.emotion_transitions.append({
                'from': self.last_emotion,
                'to': smoothed_emotion,
                'frame': self.frame_count,
                'duration': self.emotion_duration
            })
            self.emotion_duration = 1
            self.last_emotion = smoothed_emotion
        else:
            self.emotion_duration += 1
        
        # 更新统计
        self.emotion_counts[smoothed_emotion] += 1
        
        processing_time = (time.time() - start_time) * 1000
        self.processing_times.append(processing_time)
        
        return {
            'emotion': smoothed_emotion,
            'confidence': smoothed_confidence,
            'intensity': smoothed_intensity,
            'fine_grained': fine_grained,
            'all_scores': final_scores,
            'raw_emotion': primary_emotion,
            'raw_confidence': confidence,
            'emotion_duration': self.emotion_duration,
            'processing_time': processing_time
        }
    
    def _recognize_from_au(self, au_result: Dict) -> Dict[str, float]:
        """基于AU规则识别情绪"""
        au_activations = au_result.get('au_activations', {})
        au_intensities = au_result.get('au_intensities', {})
        
        emotion_scores = {}
        
        for emotion, rules in self.AU_EMOTION_RULES.items():
            score = 0.0
            required_count = 0
            required_total = len(rules['required'])
            
            # 检查必需AU
            for au, weight in rules['required']:
                if au_activations.get(au, False):
                    intensity = au_intensities.get(au, 0)
                    score += weight * (1 + intensity / 5.0)
                    required_count += 1
            
            # 检查可选AU
            for au, weight in rules['optional']:
                if au_activations.get(au, False):
                    intensity = au_intensities.get(au, 0)
                    score += weight * 0.5 * (1 + intensity / 5.0)
            
            # 检查不兼容AU(减分)
            for au in rules['incompatible']:
                if au_activations.get(au, False):
                    score -= 0.3
            
            # 必需AU满足率
            if required_total > 0:
                required_ratio = required_count / required_total
                score *= required_ratio
            
            emotion_scores[emotion] = max(0, score)
        
        # 归一化
        total = sum(emotion_scores.values())
        if total > 0:
            emotion_scores = {k: v/total for k, v in emotion_scores.items()}
        else:
            emotion_scores = {emotion: 1.0/len(self.EMOTIONS) for emotion in self.EMOTIONS}
        
        return emotion_scores
    
    def _recognize_from_geometry(self, landmarks: np.ndarray) -> Dict[str, float]:
        """基于几何特征识别情绪"""
        emotion_scores = {emotion: 0.0 for emotion in self.EMOTIONS}
        
        # 提取几何特征
        features = self._extract_geometric_features(landmarks)
        
        # 基于规则的几何特征判断
        # 快乐: 嘴角上扬,眼睛微眯
        if features['mouth_curvature'] > 0.1 and features['eye_openness'] < 0.35:
            emotion_scores['happy'] += 0.8
        
        # 悲伤: 嘴角下垂,眉毛下垂
        if features['mouth_curvature'] < -0.05 and features['eyebrow_height'] < 0.3:
            emotion_scores['sad'] += 0.7
        
        # 愤怒: 眉毛下压,嘴唇紧闭
        if features['eyebrow_height'] < 0.25 and features['mouth_openness'] < 0.1:
            emotion_scores['angry'] += 0.6
        
        # 恐惧: 眉毛上扬,眼睛睁大,嘴微张
        if features['eyebrow_height'] > 0.4 and features['eye_openness'] > 0.4:
            emotion_scores['fear'] += 0.7
        
        # 惊讶: 眉毛高扬,眼睛睁大,嘴张开
        if features['eyebrow_height'] > 0.45 and features['eye_openness'] > 0.45 and features['mouth_openness'] > 0.2:
            emotion_scores['surprise'] += 0.9
        
        # 厌恶: 鼻子皱起,上唇提升
        if features['nose_wrinkle'] > 0.15:
            emotion_scores['disgust'] += 0.7
        
        # 中性: 所有特征都在中等范围
        if all(0.25 < v < 0.4 for v in [features['eyebrow_height'], features['eye_openness'], features['mouth_openness']]):
            emotion_scores['neutral'] += 0.5
        
        # 归一化
        total = sum(emotion_scores.values())
        if total > 0:
            emotion_scores = {k: v/total for k, v in emotion_scores.items()}
        else:
            emotion_scores = {emotion: 1.0/len(self.EMOTIONS) for emotion in self.EMOTIONS}
        
        return emotion_scores
    
    def _extract_geometric_features(self, landmarks: np.ndarray) -> Dict[str, float]:
        """提取几何特征"""
        features = {}
        
        # 眉毛高度
        eyebrow_center = np.mean(landmarks[17:27], axis=0)
        eye_center = np.mean(landmarks[36:48], axis=0)
        features['eyebrow_height'] = (eyebrow_center[1] - eye_center[1]) / 100.0
        
        # 眼睛开度
        left_eye_height = abs(landmarks[37][1] - landmarks[41][1])
        right_eye_height = abs(landmarks[44][1] - landmarks[46][1])
        eye_width = abs(landmarks[36][0] - landmarks[45][0])
        features['eye_openness'] = (left_eye_height + right_eye_height) / (2 * eye_width + 1e-6)
        
        # 嘴巴开度
        mouth_height = abs(landmarks[51][1] - landmarks[57][1])
        mouth_width = abs(landmarks[48][0] - landmarks[54][0])
        features['mouth_openness'] = mouth_height / (mouth_width + 1e-6)
        
        # 嘴角曲率
        mouth_left_y = landmarks[48][1]
        mouth_right_y = landmarks[54][1]
        mouth_center_y = landmarks[51][1]
        features['mouth_curvature'] = (mouth_left_y + mouth_right_y) / 2 - mouth_center_y
        
        # 鼻子皱纹(简化估计)
        nose_top = landmarks[27]
        nose_tip = landmarks[30]
        features['nose_wrinkle'] = np.linalg.norm(nose_top - nose_tip) / 100.0
        
        return features
    
    def _fuse_scores(self, emotion_scores: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """融合多个方法的评分"""
        # 权重配置
        weights = {
            'au': 0.6,
            'geometric': 0.4
        }
        
        fused_scores = {emotion: 0.0 for emotion in self.EMOTIONS}
        
        for method, scores in emotion_scores.items():
            weight = weights.get(method, 1.0 / len(emotion_scores))
            for emotion, score in scores.items():
                fused_scores[emotion] += score * weight
        
        # 归一化
        total = sum(fused_scores.values())
        if total > 0:
            fused_scores = {k: v/total for k, v in fused_scores.items()}
        
        return fused_scores
    
    def _calibrate_confidence(self, confidence: float, all_scores: Dict[str, float]) -> float:
        """校准置信度"""
        # 计算得分分布的熵
        scores = list(all_scores.values())
        scores = [s + 1e-10 for s in scores]  # 避免log(0)
        entropy = -sum(s * np.log(s) for s in scores)
        max_entropy = np.log(len(scores))
        
        # 熵越低,置信度越高
        entropy_factor = 1 - (entropy / max_entropy)
        
        # 校准后的置信度
        calibrated = confidence * (0.5 + 0.5 * entropy_factor)
        
        return calibrated
    
    def _calculate_intensity(
        self,
        emotion: str,
        au_result: Optional[Dict],
        confidence: float
    ) -> float:
        """计算情绪强度(0-1)"""
        intensity = confidence  # 基础强度
        
        if au_result:
            au_intensities = au_result.get('au_intensities', {})
            rules = self.AU_EMOTION_RULES.get(emotion, {})
            
            # 基于相关AU的强度
            relevant_aus = [au for au, _ in rules.get('required', [])]
            if relevant_aus:
                au_intensity_values = [au_intensities.get(au, 0) for au in relevant_aus]
                avg_au_intensity = np.mean(au_intensity_values) / 5.0  # 归一化到0-1
                intensity = (intensity + avg_au_intensity) / 2
        
        return np.clip(intensity, 0.0, 1.0)
    
    def _identify_fine_grained_emotion(
        self,
        emotion: str,
        intensity: float,
        au_result: Optional[Dict]
    ) -> str:
        """识别细粒度情绪"""
        fine_grained_list = self.FINE_GRAINED_EMOTIONS.get(emotion, [emotion])
        
        if not fine_grained_list:
            return emotion
        
        # 基于强度选择细粒度情绪
        index = int(intensity * (len(fine_grained_list) - 1))
        return fine_grained_list[index]
    
    def _smooth_emotion(self) -> str:
        """时序平滑情绪"""
        if not self.emotion_history:
            return 'neutral'
        
        # 投票机制
        emotion_counts = {}
        for emotion in self.emotion_history:
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        return max(emotion_counts, key=emotion_counts.get)
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        return {
            'frame_count': self.frame_count,
            'emotion_distribution': {
                emotion: count / max(self.frame_count, 1)
                for emotion, count in self.emotion_counts.items()
            },
            'emotion_transitions': self.emotion_transitions[-10:],  # 最近10次转换
            'avg_processing_time': np.mean(list(self.processing_times)) if self.processing_times else 0,
            'current_emotion': self.last_emotion,
            'emotion_duration': self.emotion_duration
        }
    
    def reset(self):
        """重置识别器"""
        self.emotion_history.clear()
        self.confidence_history.clear()
        self.intensity_history.clear()
        self.last_emotion = 'neutral'
        self.emotion_duration = 0
        self.emotion_transitions = []
        self.frame_count = 0
        self.emotion_counts = {emotion: 0 for emotion in self.EMOTIONS}
