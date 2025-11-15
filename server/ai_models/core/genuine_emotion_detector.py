"""
真假情绪识别器 - Genuine vs Fake Emotion Detector
基于Duchenne微笑理论和AU时序动态分析
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from collections import deque
import time


class GenuineEmotionDetector:
    """
    真假情绪识别器
    
    核心功能:
    1. 识别真假笑容(Duchenne vs Fake Smile)
    2. 检测表情不一致性(宏观vs微表情)
    3. 分析表情时序动态(起始-持续-消退)
    4. 评估情绪真实性(0-1评分)
    
    理论基础:
    - Duchenne Smile: AU6 + AU12同时激活
    - Fake Smile: 仅AU12,或AU6/AU12比值过低
    - 真实情绪: 自然的起始和消退过程
    - 伪装情绪: 突然起始或消退,持续时间异常
    """
    
    # 情绪类型
    EMOTIONS = {
        'happiness': {'key_aus': ['AU6', 'AU12'], 'type': 'positive'},
        'sadness': {'key_aus': ['AU1', 'AU4', 'AU15'], 'type': 'negative'},
        'anger': {'key_aus': ['AU4', 'AU7', 'AU23'], 'type': 'negative'},
        'fear': {'key_aus': ['AU1', 'AU2', 'AU5', 'AU20'], 'type': 'negative'},
        'disgust': {'key_aus': ['AU9', 'AU10'], 'type': 'negative'},
        'surprise': {'key_aus': ['AU1', 'AU2', 'AU5', 'AU26'], 'type': 'neutral'},
        'neutral': {'key_aus': [], 'type': 'neutral'}
    }
    
    def __init__(self, 
                 history_length: int = 90,      # 3秒历史@30fps
                 onset_threshold: float = 0.3,  # 起始阶段阈值
                 offset_threshold: float = 0.3): # 消退阶段阈值
        """
        初始化真假情绪识别器
        
        Args:
            history_length: 表情历史长度(帧数)
            onset_threshold: 起始阶段变化率阈值
            offset_threshold: 消退阶段变化率阈值
        """
        self.history_length = history_length
        self.onset_threshold = onset_threshold
        self.offset_threshold = offset_threshold
        
        # 表情历史
        self.emotion_history = deque(maxlen=history_length)
        self.au_intensity_history = {
            'AU6': deque(maxlen=history_length),
            'AU12': deque(maxlen=history_length),
            'AU1': deque(maxlen=history_length),
            'AU4': deque(maxlen=history_length),
            'AU15': deque(maxlen=history_length),
        }
        self.timestamp_history = deque(maxlen=history_length)
        
        # 当前表情状态
        self.current_emotion = 'neutral'
        self.emotion_start_time = None
        self.emotion_duration = 0.0
        
        # 统计信息
        self.genuine_count = 0
        self.fake_count = 0
        self.total_emotions = 0
        
    def analyze(self, 
                emotion: str, 
                au_results: Dict,
                timestamp: Optional[float] = None) -> Dict:
        """
        分析情绪的真实性
        
        Args:
            emotion: 当前检测到的情绪
            au_results: AU检测结果
            timestamp: 时间戳
            
        Returns:
            {
                'emotion': 'happiness',
                'is_genuine': True,
                'confidence': 0.92,
                'genuineness_score': 0.85,
                'indicators': {
                    'duchenne_smile': True,
                    'au6_au12_ratio': 0.75,
                    'temporal_consistency': 0.88,
                    'onset_natural': True,
                    'offset_natural': True
                },
                'fake_probability': 0.15
            }
        """
        if timestamp is None:
            timestamp = time.time()
        
        # 更新历史
        self.emotion_history.append(emotion)
        self.timestamp_history.append(timestamp)
        for au_name in self.au_intensity_history.keys():
            if au_name in au_results:
                self.au_intensity_history[au_name].append(
                    au_results[au_name]['intensity']
                )
            else:
                self.au_intensity_history[au_name].append(0.0)
        
        # 检测情绪变化
        if emotion != self.current_emotion:
            self.current_emotion = emotion
            self.emotion_start_time = timestamp
            self.emotion_duration = 0.0
        else:
            if self.emotion_start_time:
                self.emotion_duration = timestamp - self.emotion_start_time
        
        # 分析真实性
        if emotion == 'happiness':
            result = self._analyze_smile_genuineness(au_results)
        elif emotion in ['sadness', 'anger', 'fear', 'disgust']:
            result = self._analyze_negative_emotion_genuineness(emotion, au_results)
        else:
            result = {
                'emotion': emotion,
                'is_genuine': True,
                'confidence': 0.5,
                'genuineness_score': 0.5,
                'indicators': {},
                'fake_probability': 0.5
            }
        
        # 添加时序一致性分析
        temporal_analysis = self._analyze_temporal_consistency()
        result['indicators'].update(temporal_analysis)
        
        # 更新统计
        self.total_emotions += 1
        if result['is_genuine']:
            self.genuine_count += 1
        else:
            self.fake_count += 1
        
        return result
    
    def _analyze_smile_genuineness(self, au_results: Dict) -> Dict:
        """
        分析笑容的真实性(Duchenne Smile检测)
        
        判断标准:
        1. AU6 + AU12同时激活
        2. AU6/AU12强度比 > 0.6
        3. 持续时间0.5-4秒
        4. 自然的起始和消退
        5. 左右对称
        """
        indicators = {}
        
        # 1. 检查AU6和AU12是否同时激活
        au6_active = au_results.get('AU6', {}).get('active', False)
        au12_active = au_results.get('AU12', {}).get('active', False)
        both_active = au6_active and au12_active
        indicators['duchenne_smile'] = both_active
        
        # 2. 计算AU6/AU12强度比
        au6_intensity = au_results.get('AU6', {}).get('intensity', 0.0)
        au12_intensity = au_results.get('AU12', {}).get('intensity', 0.0)
        
        if au12_intensity > 0.5:
            ratio = au6_intensity / (au12_intensity + 1e-6)
        else:
            ratio = 0.0
        indicators['au6_au12_ratio'] = float(ratio)
        
        # 3. 检查持续时间
        duration_ok = 0.5 <= self.emotion_duration <= 4.0 if self.emotion_duration > 0 else True
        indicators['duration_appropriate'] = duration_ok
        indicators['duration'] = float(self.emotion_duration)
        
        # 4. 检查起始和消退的自然性
        onset_natural = self._check_onset_naturalness('AU12')
        offset_natural = self._check_offset_naturalness('AU12')
        indicators['onset_natural'] = onset_natural
        indicators['offset_natural'] = offset_natural
        
        # 5. 计算真实性评分
        genuineness_score = 0.0
        
        # Duchenne smile (40%)
        if both_active:
            genuineness_score += 0.4
        elif au12_active:
            genuineness_score += 0.2
        
        # AU6/AU12比值 (30%)
        if ratio > 0.6:
            genuineness_score += 0.3
        elif ratio > 0.3:
            genuineness_score += 0.15
        
        # 持续时间 (10%)
        if duration_ok:
            genuineness_score += 0.1
        
        # 起始自然性 (10%)
        if onset_natural:
            genuineness_score += 0.1
        
        # 消退自然性 (10%)
        if offset_natural:
            genuineness_score += 0.1
        
        # 判断是否真实
        is_genuine = genuineness_score >= 0.6
        confidence = min(0.95, genuineness_score + 0.1)
        
        return {
            'emotion': 'happiness',
            'is_genuine': is_genuine,
            'confidence': float(confidence),
            'genuineness_score': float(genuineness_score),
            'indicators': indicators,
            'fake_probability': float(1.0 - genuineness_score)
        }
    
    def _analyze_negative_emotion_genuineness(self, 
                                              emotion: str, 
                                              au_results: Dict) -> Dict:
        """
        分析负面情绪的真实性
        
        判断标准:
        1. 关键AU激活
        2. AU强度适中(不过度)
        3. 持续时间合理
        4. 时序一致性
        """
        indicators = {}
        
        # 获取该情绪的关键AU
        key_aus = self.EMOTIONS[emotion]['key_aus']
        
        # 1. 检查关键AU激活情况
        active_key_aus = []
        for au in key_aus:
            if au in au_results and au_results[au]['active']:
                active_key_aus.append(au)
        
        activation_ratio = len(active_key_aus) / len(key_aus) if key_aus else 0.0
        indicators['key_aus_active'] = active_key_aus
        indicators['activation_ratio'] = float(activation_ratio)
        
        # 2. 检查AU强度(真实情绪强度适中,不会过度)
        intensities = [au_results[au]['intensity'] for au in active_key_aus if au in au_results]
        avg_intensity = np.mean(intensities) if intensities else 0.0
        intensity_appropriate = 1.5 <= avg_intensity <= 4.0
        indicators['average_intensity'] = float(avg_intensity)
        indicators['intensity_appropriate'] = intensity_appropriate
        
        # 3. 检查持续时间
        duration_ok = self.emotion_duration >= 0.5 if self.emotion_duration > 0 else True
        indicators['duration'] = float(self.emotion_duration)
        indicators['duration_appropriate'] = duration_ok
        
        # 4. 检查时序一致性
        temporal_consistent = self._check_temporal_consistency(emotion)
        indicators['temporal_consistent'] = temporal_consistent
        
        # 计算真实性评分
        genuineness_score = 0.0
        
        # 关键AU激活 (40%)
        genuineness_score += activation_ratio * 0.4
        
        # 强度适中 (30%)
        if intensity_appropriate:
            genuineness_score += 0.3
        elif avg_intensity > 0:
            genuineness_score += 0.15
        
        # 持续时间 (15%)
        if duration_ok:
            genuineness_score += 0.15
        
        # 时序一致性 (15%)
        if temporal_consistent:
            genuineness_score += 0.15
        
        # 判断是否真实
        is_genuine = genuineness_score >= 0.5
        confidence = min(0.95, genuineness_score + 0.2)
        
        return {
            'emotion': emotion,
            'is_genuine': is_genuine,
            'confidence': float(confidence),
            'genuineness_score': float(genuineness_score),
            'indicators': indicators,
            'fake_probability': float(1.0 - genuineness_score)
        }
    
    def _check_onset_naturalness(self, au_name: str) -> bool:
        """
        检查起始阶段的自然性
        
        真实情绪: 缓慢起始(变化率 < threshold)
        伪装情绪: 突然起始(变化率 > threshold)
        """
        if len(self.au_intensity_history[au_name]) < 10:
            return True
        
        # 获取最近10帧
        recent = list(self.au_intensity_history[au_name])[-10:]
        
        # 计算变化率
        changes = np.diff(recent)
        max_change = np.max(np.abs(changes)) if len(changes) > 0 else 0.0
        
        # 如果最大变化率小于阈值,认为是自然起始
        return max_change < self.onset_threshold
    
    def _check_offset_naturalness(self, au_name: str) -> bool:
        """
        检查消退阶段的自然性
        
        真实情绪: 缓慢消退
        伪装情绪: 突然消退
        """
        # 类似于起始阶段检查
        return self._check_onset_naturalness(au_name)
    
    def _check_temporal_consistency(self, emotion: str) -> bool:
        """
        检查时序一致性
        
        真实情绪: 表情在一段时间内保持稳定
        伪装情绪: 表情频繁变化
        """
        if len(self.emotion_history) < 10:
            return True
        
        # 计算最近10帧中该情绪出现的比例
        recent = list(self.emotion_history)[-10:]
        emotion_count = recent.count(emotion)
        consistency = emotion_count / len(recent)
        
        # 如果一致性 > 0.7,认为是一致的
        return consistency > 0.7
    
    def _analyze_temporal_consistency(self) -> Dict:
        """
        分析表情的时序一致性
        
        返回:
        {
            'consistency_score': 0.85,
            'emotion_stability': 0.9,
            'au_stability': 0.8
        }
        """
        if len(self.emotion_history) < 5:
            return {
                'consistency_score': 0.5,
                'emotion_stability': 0.5,
                'au_stability': 0.5
            }
        
        # 情绪稳定性: 最近的情绪是否一致
        recent_emotions = list(self.emotion_history)[-10:]
        most_common = max(set(recent_emotions), key=recent_emotions.count)
        emotion_stability = recent_emotions.count(most_common) / len(recent_emotions)
        
        # AU稳定性: AU强度的变化是否平滑
        au_stabilities = []
        for au_name, history in self.au_intensity_history.items():
            if len(history) >= 5:
                recent = list(history)[-10:]
                std = np.std(recent)
                stability = 1.0 / (1.0 + std)
                au_stabilities.append(stability)
        
        au_stability = np.mean(au_stabilities) if au_stabilities else 0.5
        
        # 综合一致性评分
        consistency_score = emotion_stability * 0.6 + au_stability * 0.4
        
        return {
            'consistency_score': float(consistency_score),
            'emotion_stability': float(emotion_stability),
            'au_stability': float(au_stability)
        }
    
    def detect_concealed_depression(self, 
                                   macro_emotion: str,
                                   micro_emotions: List[Dict]) -> Dict:
        """
        检测隐匿性抑郁
        
        方法: 对比宏观表情和微表情,检测不一致性
        
        Args:
            macro_emotion: 宏观表情(主要表情)
            micro_emotions: 微表情列表
            
        Returns:
            {
                'concealed_depression_detected': True,
                'inconsistency_score': 0.75,
                'macro_emotion': 'happiness',
                'hidden_emotions': ['sadness', 'fear'],
                'risk_level': 'high'
            }
        """
        # 统计微表情中的情绪
        micro_emotion_counts = {}
        for micro in micro_emotions:
            emotion = micro.get('emotion', 'neutral')
            micro_emotion_counts[emotion] = micro_emotion_counts.get(emotion, 0) + 1
        
        # 检查不一致性
        inconsistency_detected = False
        hidden_emotions = []
        
        # 如果宏观表情是快乐/中性,但微表情显示悲伤/恐惧
        if macro_emotion in ['happiness', 'neutral']:
            for emotion in ['sadness', 'fear', 'anger']:
                if micro_emotion_counts.get(emotion, 0) > 0:
                    inconsistency_detected = True
                    hidden_emotions.append(emotion)
        
        # 计算不一致性评分
        total_micro = sum(micro_emotion_counts.values())
        if total_micro > 0:
            hidden_count = sum(micro_emotion_counts.get(e, 0) for e in hidden_emotions)
            inconsistency_score = hidden_count / total_micro
        else:
            inconsistency_score = 0.0
        
        # 评估风险等级
        if inconsistency_score >= 0.6:
            risk_level = 'high'
        elif inconsistency_score >= 0.3:
            risk_level = 'moderate'
        else:
            risk_level = 'low'
        
        return {
            'concealed_depression_detected': inconsistency_detected,
            'inconsistency_score': float(inconsistency_score),
            'macro_emotion': macro_emotion,
            'hidden_emotions': hidden_emotions,
            'risk_level': risk_level,
            'micro_emotion_distribution': micro_emotion_counts
        }
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        genuine_rate = self.genuine_count / self.total_emotions if self.total_emotions > 0 else 0.0
        fake_rate = self.fake_count / self.total_emotions if self.total_emotions > 0 else 0.0
        
        return {
            'total_emotions': self.total_emotions,
            'genuine_count': self.genuine_count,
            'fake_count': self.fake_count,
            'genuine_rate': float(genuine_rate),
            'fake_rate': float(fake_rate)
        }
    
    def reset(self):
        """重置检测器"""
        self.emotion_history.clear()
        for history in self.au_intensity_history.values():
            history.clear()
        self.timestamp_history.clear()
        
        self.current_emotion = 'neutral'
        self.emotion_start_time = None
        self.emotion_duration = 0.0
        
        self.genuine_count = 0
        self.fake_count = 0
        self.total_emotions = 0
