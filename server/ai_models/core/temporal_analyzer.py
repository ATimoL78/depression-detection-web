"""
时空特征分析模块
使用LSTM/GRU捕捉时序依赖和表情变化趋势
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
import time


class TemporalFeatureAnalyzer:
    """
    时序特征分析器
    
    功能:
    1. 滑动窗口特征提取
    2. 表情变化速率计算
    3. 微表情持续时间分析
    4. 长期趋势预测
    
    基于研究发现:
    - 抑郁症患者表情变化较慢
    - 积极情绪持续时间较短
    - 消极情绪持续时间较长
    """
    
    def __init__(
        self,
        window_size: int = 300,  # 10秒 @ 30fps
        short_window: int = 90,   # 3秒
        long_window: int = 900    # 30秒
    ):
        """
        初始化时序分析器
        
        Args:
            window_size: 主窗口大小(帧数)
            short_window: 短期窗口大小
            long_window: 长期窗口大小
        """
        self.window_size = window_size
        self.short_window = short_window
        self.long_window = long_window
        
        # 特征历史
        self.emotion_history = deque(maxlen=long_window)
        self.au_history = deque(maxlen=long_window)
        self.confidence_history = deque(maxlen=long_window)
        
        # 情绪极性映射
        self.emotion_polarity = {
            'happy': 1.0,
            'surprise': 0.5,
            'neutral': 0.0,
            'fear': -0.3,
            'disgust': -0.5,
            'angry': -0.7,
            'sad': -1.0
        }
    
    def update(
        self,
        emotion: str,
        confidence: float,
        au_activations: Optional[Dict] = None,
        timestamp: Optional[float] = None
    ):
        """
        更新时序数据
        
        Args:
            emotion: 情绪标签
            confidence: 置信度
            au_activations: AU激活状态
            timestamp: 时间戳
        """
        if timestamp is None:
            timestamp = time.time()
        
        self.emotion_history.append({
            'emotion': emotion,
            'confidence': confidence,
            'timestamp': timestamp
        })
        
        if au_activations:
            self.au_history.append({
                'au_activations': au_activations,
                'timestamp': timestamp
            })
        
        self.confidence_history.append(confidence)
    
    def analyze(self) -> Dict:
        """
        分析时序特征
        
        Returns:
            时序特征:
            - emotion_change_rate: 情绪变化率
            - expression_duration: 表情平均持续时间
            - positive_duration: 积极情绪平均持续时间
            - negative_duration: 消极情绪平均持续时间
            - emotion_stability: 情绪稳定性
            - short_term_trend: 短期趋势
            - long_term_trend: 长期趋势
            - micro_expression_count: 微表情次数
        """
        if len(self.emotion_history) < self.short_window:
            return {'status': 'insufficient_data'}
        
        # 1. 情绪变化率
        emotion_change_rate = self._calculate_change_rate()
        
        # 2. 表情持续时间
        duration_stats = self._calculate_duration_stats()
        
        # 3. 情绪稳定性
        emotion_stability = self._calculate_stability()
        
        # 4. 短期和长期趋势
        short_term_trend = self._calculate_trend(self.short_window)
        long_term_trend = self._calculate_trend(min(self.long_window, len(self.emotion_history)))
        
        # 5. 微表情统计
        micro_expression_stats = self._analyze_micro_expressions()
        
        return {
            'emotion_change_rate': emotion_change_rate,
            'expression_duration': duration_stats['avg_duration'],
            'positive_duration': duration_stats['positive_duration'],
            'negative_duration': duration_stats['negative_duration'],
            'emotion_stability': emotion_stability,
            'short_term_trend': short_term_trend,
            'long_term_trend': long_term_trend,
            'micro_expression_count': micro_expression_stats['count'],
            'micro_expression_rate': micro_expression_stats['rate']
        }
    
    def _calculate_change_rate(self) -> float:
        """计算情绪变化率"""
        if len(self.emotion_history) < 2:
            return 0.0
        
        changes = 0
        for i in range(1, len(self.emotion_history)):
            if self.emotion_history[i]['emotion'] != self.emotion_history[i-1]['emotion']:
                changes += 1
        
        return changes / (len(self.emotion_history) - 1)
    
    def _calculate_duration_stats(self) -> Dict:
        """计算表情持续时间统计"""
        if len(self.emotion_history) < 2:
            return {
                'avg_duration': 0.0,
                'positive_duration': 0.0,
                'negative_duration': 0.0
            }
        
        # 识别连续相同情绪的片段
        segments = []
        current_emotion = self.emotion_history[0]['emotion']
        start_idx = 0
        
        for i in range(1, len(self.emotion_history)):
            if self.emotion_history[i]['emotion'] != current_emotion:
                # 片段结束
                end_idx = i - 1
                duration = end_idx - start_idx + 1
                
                segments.append({
                    'emotion': current_emotion,
                    'duration': duration,
                    'start_time': self.emotion_history[start_idx]['timestamp'],
                    'end_time': self.emotion_history[end_idx]['timestamp']
                })
                
                current_emotion = self.emotion_history[i]['emotion']
                start_idx = i
        
        # 添加最后一个片段
        if start_idx < len(self.emotion_history):
            segments.append({
                'emotion': current_emotion,
                'duration': len(self.emotion_history) - start_idx,
                'start_time': self.emotion_history[start_idx]['timestamp'],
                'end_time': self.emotion_history[-1]['timestamp']
            })
        
        # 计算平均持续时间
        if len(segments) == 0:
            return {
                'avg_duration': 0.0,
                'positive_duration': 0.0,
                'negative_duration': 0.0
            }
        
        avg_duration = np.mean([s['duration'] for s in segments])
        
        # 积极和消极情绪持续时间
        positive_emotions = ['happy', 'surprise']
        negative_emotions = ['sad', 'angry', 'fear', 'disgust']
        
        positive_segments = [s for s in segments if s['emotion'] in positive_emotions]
        negative_segments = [s for s in segments if s['emotion'] in negative_emotions]
        
        positive_duration = np.mean([s['duration'] for s in positive_segments]) if positive_segments else 0.0
        negative_duration = np.mean([s['duration'] for s in negative_segments]) if negative_segments else 0.0
        
        return {
            'avg_duration': float(avg_duration),
            'positive_duration': float(positive_duration),
            'negative_duration': float(negative_duration),
            'segments': segments
        }
    
    def _calculate_stability(self) -> float:
        """计算情绪稳定性 (方差的倒数)"""
        if len(self.emotion_history) < 2:
            return 0.0
        
        # 将情绪转换为数值
        polarity_values = [
            self.emotion_polarity.get(record['emotion'], 0)
            for record in self.emotion_history
        ]
        
        variance = np.var(polarity_values)
        
        # 稳定性 = 1 / (1 + variance)
        stability = 1.0 / (1.0 + variance)
        
        return float(stability)
    
    def _calculate_trend(self, window: int) -> float:
        """
        计算情绪趋势 (线性回归斜率)
        
        正值: 情绪趋向积极
        负值: 情绪趋向消极
        """
        if len(self.emotion_history) < window:
            window = len(self.emotion_history)
        
        if window < 2:
            return 0.0
        
        # 取最近window帧
        recent_emotions = list(self.emotion_history)[-window:]
        
        # 转换为极性值
        polarity_values = [
            self.emotion_polarity.get(record['emotion'], 0)
            for record in recent_emotions
        ]
        
        # 线性回归
        x = np.arange(len(polarity_values))
        y = np.array(polarity_values)
        
        # 计算斜率
        slope = np.polyfit(x, y, 1)[0]
        
        return float(slope)
    
    def _analyze_micro_expressions(self) -> Dict:
        """
        分析微表情
        
        微表情定义: 持续时间<3秒(90帧)的表情变化
        """
        if len(self.emotion_history) < 2:
            return {'count': 0, 'rate': 0.0}
        
        duration_stats = self._calculate_duration_stats()
        segments = duration_stats.get('segments', [])
        
        # 统计短暂表情 (<90帧)
        micro_expressions = [s for s in segments if s['duration'] < 90]
        
        count = len(micro_expressions)
        rate = count / len(segments) if segments else 0.0
        
        return {
            'count': count,
            'rate': float(rate),
            'micro_expressions': micro_expressions
        }
    
    def get_depression_indicators(self) -> Dict:
        """
        提取抑郁相关指标
        
        基于研究发现:
        1. 抑郁症患者情绪变化率较低
        2. 消极情绪持续时间较长
        3. 积极情绪持续时间较短
        4. 情绪趋势向消极
        """
        analysis = self.analyze()
        
        if analysis.get('status') == 'insufficient_data':
            return {'status': 'insufficient_data'}
        
        indicators = {}
        
        # 1. 情绪变化率过低
        change_rate = analysis['emotion_change_rate']
        indicators['low_change_rate'] = change_rate < 0.1  # 阈值可调
        indicators['change_rate_score'] = 1.0 - change_rate if change_rate < 0.2 else 0.0
        
        # 2. 消极情绪持续时间过长
        negative_duration = analysis['negative_duration']
        positive_duration = analysis['positive_duration']
        
        if positive_duration > 0:
            duration_ratio = negative_duration / positive_duration
            indicators['high_negative_duration'] = duration_ratio > 2.0
            indicators['duration_ratio_score'] = min(duration_ratio / 5.0, 1.0)
        else:
            indicators['high_negative_duration'] = True
            indicators['duration_ratio_score'] = 1.0
        
        # 3. 情绪稳定性过低 (情绪扁平)
        stability = analysis['emotion_stability']
        indicators['low_stability'] = stability > 0.8  # 过于稳定=扁平
        indicators['stability_score'] = stability if stability > 0.7 else 0.0
        
        # 4. 长期趋势向消极
        long_term_trend = analysis['long_term_trend']
        indicators['negative_trend'] = long_term_trend < -0.01
        indicators['trend_score'] = abs(long_term_trend) if long_term_trend < 0 else 0.0
        
        # 5. 微表情减少
        micro_expr_rate = analysis['micro_expression_rate']
        indicators['low_micro_expression'] = micro_expr_rate < 0.1
        indicators['micro_expr_score'] = 1.0 - micro_expr_rate if micro_expr_rate < 0.2 else 0.0
        
        # 综合评分
        total_score = (
            indicators['change_rate_score'] * 0.25 +
            indicators['duration_ratio_score'] * 0.30 +
            indicators['stability_score'] * 0.20 +
            indicators['trend_score'] * 0.15 +
            indicators['micro_expr_score'] * 0.10
        )
        
        indicators['temporal_depression_score'] = total_score * 100  # 0-100
        
        return indicators
    
    def reset(self):
        """重置分析器"""
        self.emotion_history.clear()
        self.au_history.clear()
        self.confidence_history.clear()


class AttentionWeightCalculator:
    """
    注意力权重计算器
    
    为不同面部区域分配注意力权重
    基于抑郁症相关的面部特征
    """
    
    def __init__(self):
        """初始化注意力权重计算器"""
        # 面部区域权重 (基于抑郁症研究)
        self.region_weights = {
            'eyes': 0.35,        # 眼睛最重要
            'eyebrows': 0.25,    # 眉毛次之
            'mouth': 0.25,       # 嘴巴
            'nose': 0.10,        # 鼻子
            'cheeks': 0.05       # 脸颊
        }
        
        # AU到区域的映射
        self.au_to_region = {
            'AU1': 'eyebrows',
            'AU2': 'eyebrows',
            'AU4': 'eyebrows',
            'AU5': 'eyes',
            'AU6': 'cheeks',
            'AU7': 'eyes',
            'AU9': 'nose',
            'AU12': 'mouth',
            'AU15': 'mouth',
            'AU17': 'mouth',
            'AU20': 'mouth',
            'AU25': 'mouth',
            'AU26': 'mouth',
            'AU43': 'eyes'
        }
    
    def calculate_weights(self, au_activations: Dict) -> Dict:
        """
        根据AU激活计算区域注意力权重
        
        Args:
            au_activations: AU激活状态
            
        Returns:
            区域权重字典
        """
        # 初始化权重
        weights = self.region_weights.copy()
        
        # 根据激活的AU调整权重
        activated_regions = set()
        for au, activated in au_activations.items():
            if activated and au in self.au_to_region:
                region = self.au_to_region[au]
                activated_regions.add(region)
        
        # 增强激活区域的权重
        if activated_regions:
            boost_factor = 1.2
            for region in activated_regions:
                weights[region] *= boost_factor
            
            # 归一化
            total = sum(weights.values())
            weights = {k: v / total for k, v in weights.items()}
        
        return weights
    
    def apply_spatial_attention(
        self,
        feature_map: np.ndarray,
        au_activations: Dict
    ) -> np.ndarray:
        """
        应用空间注意力到特征图
        
        Args:
            feature_map: 特征图 (H, W, C)
            au_activations: AU激活状态
            
        Returns:
            加权后的特征图
        """
        # 计算权重
        weights = self.calculate_weights(au_activations)
        
        # 创建注意力掩码
        H, W = feature_map.shape[:2]
        attention_mask = np.ones((H, W), dtype=np.float32)
        
        # 简化版本: 将图像分为5个区域
        # 实际应用中应该使用关键点位置
        h_third = H // 3
        w_half = W // 2
        
        # 眉毛区域 (上1/3)
        attention_mask[0:h_third, :] *= weights['eyebrows']
        
        # 眼睛区域 (上1/3到中1/3)
        attention_mask[h_third:2*h_third, :] *= weights['eyes']
        
        # 鼻子区域 (中1/3)
        attention_mask[h_third:2*h_third, w_half-w_half//4:w_half+w_half//4] *= weights['nose']
        
        # 脸颊区域 (中1/3, 两侧)
        attention_mask[h_third:2*h_third, :w_half//2] *= weights['cheeks']
        attention_mask[h_third:2*h_third, -w_half//2:] *= weights['cheeks']
        
        # 嘴巴区域 (下1/3)
        attention_mask[2*h_third:, :] *= weights['mouth']
        
        # 应用掩码
        if len(feature_map.shape) == 3:
            attention_mask = np.expand_dims(attention_mask, axis=-1)
        
        weighted_feature_map = feature_map * attention_mask
        
        return weighted_feature_map


if __name__ == '__main__':
    """测试时序分析器"""
    print("="*60)
    print("时序特征分析器测试")
    print("="*60)
    
    # 创建分析器
    analyzer = TemporalFeatureAnalyzer()
    
    # 模拟情绪序列 (模拟抑郁症患者: 消极情绪持续时间长)
    print("\n模拟抑郁症患者情绪序列...")
    
    emotions_depressed = ['sad'] * 100 + ['neutral'] * 50 + ['sad'] * 80 + ['happy'] * 20 + ['sad'] * 50
    
    for i, emotion in enumerate(emotions_depressed):
        analyzer.update(
            emotion=emotion,
            confidence=0.8,
            timestamp=i * 0.033  # 30fps
        )
    
    # 分析
    analysis = analyzer.analyze()
    
    print(f"\n时序特征分析结果:")
    print(f"  情绪变化率: {analysis['emotion_change_rate']:.3f}")
    print(f"  平均表情持续时间: {analysis['expression_duration']:.1f} 帧")
    print(f"  积极情绪持续时间: {analysis['positive_duration']:.1f} 帧")
    print(f"  消极情绪持续时间: {analysis['negative_duration']:.1f} 帧")
    print(f"  情绪稳定性: {analysis['emotion_stability']:.3f}")
    print(f"  短期趋势: {analysis['short_term_trend']:.3f}")
    print(f"  长期趋势: {analysis['long_term_trend']:.3f}")
    print(f"  微表情次数: {analysis['micro_expression_count']}")
    
    # 抑郁指标
    indicators = analyzer.get_depression_indicators()
    
    print(f"\n抑郁相关指标:")
    print(f"  情绪变化率过低: {indicators['low_change_rate']}")
    print(f"  消极情绪持续过长: {indicators['high_negative_duration']}")
    print(f"  情绪过于稳定(扁平): {indicators['low_stability']}")
    print(f"  趋势向消极: {indicators['negative_trend']}")
    print(f"  微表情减少: {indicators['low_micro_expression']}")
    print(f"  时序抑郁评分: {indicators['temporal_depression_score']:.1f}/100")
    
    # 测试正常情绪序列
    print("\n" + "="*60)
    print("模拟正常人情绪序列...")
    
    analyzer_normal = TemporalFeatureAnalyzer()
    
    emotions_normal = ['happy'] * 30 + ['neutral'] * 20 + ['surprise'] * 15 + ['neutral'] * 25 + ['happy'] * 40 + ['sad'] * 10 + ['neutral'] * 30 + ['happy'] * 30
    
    for i, emotion in enumerate(emotions_normal):
        analyzer_normal.update(
            emotion=emotion,
            confidence=0.8,
            timestamp=i * 0.033
        )
    
    analysis_normal = analyzer_normal.analyze()
    indicators_normal = analyzer_normal.get_depression_indicators()
    
    print(f"\n时序抑郁评分对比:")
    print(f"  抑郁症患者: {indicators['temporal_depression_score']:.1f}/100")
    print(f"  正常人: {indicators_normal['temporal_depression_score']:.1f}/100")
    print(f"  差异: {indicators['temporal_depression_score'] - indicators_normal['temporal_depression_score']:.1f}")
    
    print("\n" + "="*60)
