"""
多模态抑郁评估器
融合视觉(面部表情、AU、眼部)和语音(语音特征、文本内容)
"""

import numpy as np
from collections import deque
from typing import Dict, List, Optional, Tuple
import time


class MultimodalDepressionAssessor:
    """
    多模态抑郁评估器
    
    融合多个模态:
    1. 视觉模态:
       - 面部表情(情绪识别)
       - 面部动作单元(AU)
       - 眼部特征(眨眼、疲劳、凝视)
    
    2. 语音模态:
       - 语音特征(音调、音量、语速)
       - 文本内容(情感、关键词)
    
    3. 时序特征:
       - 情绪变化趋势
       - 行为模式
    """
    
    def __init__(
        self,
        visual_weight: float = 0.6,
        voice_weight: float = 0.4,
        history_size: int = 300
    ):
        """
        初始化多模态评估器
        
        Args:
            visual_weight: 视觉模态权重
            voice_weight: 语音模态权重
            history_size: 历史数据大小
        """
        self.visual_weight = visual_weight
        self.voice_weight = voice_weight
        
        # 历史数据
        self.visual_scores = deque(maxlen=history_size)
        self.voice_scores = deque(maxlen=history_size)
        self.fusion_scores = deque(maxlen=history_size)
        
        # PHQ-9症状映射
        self.phq9_symptoms = {
            'anhedonia': 0.0,           # 兴趣丧失
            'depression': 0.0,           # 情绪低落
            'sleep': 0.0,                # 睡眠问题
            'fatigue': 0.0,              # 疲劳
            'appetite': 0.0,             # 食欲改变
            'worthlessness': 0.0,        # 自我价值感低
            'concentration': 0.0,        # 注意力问题
            'psychomotor': 0.0,          # 精神运动性改变
            'suicidal': 0.0              # 自杀想法
        }
        
        # 评估历史
        self.assessment_history = []
        
        print("✓ 多模态抑郁评估器已初始化")
    
    def assess_visual(
        self,
        emotion: Dict,
        au_result: Dict,
        eye_analysis: Dict
    ) -> Dict:
        """
        评估视觉模态
        
        Args:
            emotion: 情绪识别结果
            au_result: AU检测结果
            eye_analysis: 眼部分析结果
            
        Returns:
            视觉评估结果
        """
        scores = {}
        
        # 1. 情绪评分
        emotion_name = emotion.get('emotion', 'neutral')
        emotion_conf = emotion.get('confidence', 0.0)
        
        # 抑郁相关情绪权重 (优化后)
        emotion_weights = {
            'sad': 1.0,      # 悲伤 - 高度相关
            'neutral': 0.4,  # 中性 - 中度相关(表情平淡)
            'angry': 0.6,    # 愤怒 - 中高相关
            'fear': 0.7,     # 恐惧 - 高相关
            'disgust': 0.5,  # 厌恶 - 中度相关
            'happy': 0.0,    # 快乐 - 不相关(但不降低评分)
            'surprise': 0.2  # 惊讶 - 低相关
        }
        
        emotion_score = emotion_weights.get(emotion_name, 0.0) * emotion_conf
        scores['emotion'] = emotion_score  # 已经保证非负
        
        # 2. AU评分
        au_activations = au_result.get('au_activations', {})
        
        # 抑郁相关AU (优化后)
        # 分为正相关和负相关两类
        positive_aus = {
            'AU1': 0.8,   # 内眉上扬 (悲伤)
            'AU4': 0.9,   # 皱眉 (悲伤、愤怒)
            'AU7': 0.6,   # 眼睑收紧
            'AU15': 0.8,  # 嘴角下拉 (悲伤)
            'AU17': 0.5,  # 下巴上提
            'AU20': 0.4,  # 嘴唇拉伸
            'AU23': 0.5,  # 嘴唇收紧
            'AU24': 0.6,  # 嘴唇压紧
            'AU43': 0.7   # 闭眼 (疲劳)
        }
        
        negative_aus = {
            'AU6': 0.6,   # 脸颊上提 (快乐) - 出现时降低评分
            'AU12': 0.7   # 嘴角上扬 (快乐) - 出现时降低评分
        }
        
        # 计算正相关AU评分
        positive_score = 0.0
        positive_count = 0
        
        for au, weight in positive_aus.items():
            if au_activations.get(au, False):
                positive_score += weight
                positive_count += 1
        
        if positive_count > 0:
            positive_score = positive_score / positive_count
        
        # 计算负相关AU的减分
        negative_penalty = 0.0
        negative_count = 0
        
        for au, weight in negative_aus.items():
            if au_activations.get(au, False):
                negative_penalty += weight
                negative_count += 1
        
        if negative_count > 0:
            negative_penalty = negative_penalty / negative_count
        
        # 综合评分 = 正相关 - 负相关
        au_score = max(0.0, positive_score - negative_penalty * 0.5)  # 负相关权重降低
        
        scores['au'] = au_score
        
        # 3. 眼部评分 (优化后)
        eye_score = 0.0
        
        # 眨眼频率异常 (正常15-20次/分钟)
        blink_rate = eye_analysis.get('blink_rate', 0)
        if blink_rate > 0:  # 只在有数据时评估
            if blink_rate < 10:  # 眨眼过少 (抑郁相关)
                eye_score += min(0.4, (10 - blink_rate) / 10 * 0.4)
            elif blink_rate > 30:  # 眨眼过多 (焦虑相关)
                eye_score += min(0.3, (blink_rate - 30) / 20 * 0.3)
        
        # 疲劳 (核心指标)
        fatigue_level = eye_analysis.get('fatigue_level', 0)
        eye_score += fatigue_level * 0.5  # 提高权重
        
        # 凝视时间长 (注意力问题)
        gaze_duration = eye_analysis.get('gaze_duration', 0)
        if gaze_duration > 3:  # 凝视超过3秒
            eye_score += min(0.3, gaze_duration / 10 * 0.3)
        
        scores['eye'] = min(1.0, eye_score)
        
        # 综合视觉评分
        visual_score = (
            scores['emotion'] * 0.5 +
            scores['au'] * 0.3 +
            scores['eye'] * 0.2
        )
        
        self.visual_scores.append(visual_score)
        
        return {
            'visual_score': visual_score,
            'emotion_score': scores['emotion'],
            'au_score': scores['au'],
            'eye_score': scores['eye'],
            'timestamp': time.time()
        }
    
    def assess_voice(
        self,
        voice_indicators: Dict,
        text_sentiment: Optional[Dict] = None
    ) -> Dict:
        """
        评估语音模态
        
        Args:
            voice_indicators: 语音指标
            text_sentiment: 文本情感分析结果
            
        Returns:
            语音评估结果
        """
        scores = {}
        
        # 1. 语音特征评分
        voice_score = voice_indicators.get('overall_score', 0.0)
        scores['voice_features'] = voice_score
        
        # 2. 文本情感评分
        if text_sentiment:
            text_score = text_sentiment.get('depression_score', 0.0)
            scores['text_sentiment'] = text_score
            
            # 综合语音评分
            voice_overall = voice_score * 0.6 + text_score * 0.4
        else:
            scores['text_sentiment'] = 0.0
            voice_overall = voice_score
        
        self.voice_scores.append(voice_overall)
        
        return {
            'voice_score': voice_overall,
            'voice_features_score': scores['voice_features'],
            'text_sentiment_score': scores['text_sentiment'],
            'timestamp': time.time()
        }
    
    def fuse_multimodal(
        self,
        visual_result: Dict,
        voice_result: Optional[Dict] = None
    ) -> Dict:
        """
        融合多模态评估结果
        
        Args:
            visual_result: 视觉评估结果
            voice_result: 语音评估结果(可选)
            
        Returns:
            融合评估结果
        """
        visual_score = visual_result['visual_score']
        
        if voice_result:
            voice_score = voice_result['voice_score']
            
            # 加权融合
            fusion_score = (
                visual_score * self.visual_weight +
                voice_score * self.voice_weight
            )
            
            has_voice = True
        else:
            # 仅视觉
            fusion_score = visual_score
            voice_score = 0.0
            has_voice = False
        
        self.fusion_scores.append(fusion_score)
        
        # 更新PHQ-9症状
        self._update_phq9_symptoms(visual_result, voice_result)
        
        # 风险等级
        risk_level = self._get_risk_level(fusion_score)
        
        # 建议
        recommendations = self._generate_recommendations(fusion_score, risk_level)
        
        result = {
            'fusion_score': fusion_score,
            'visual_score': visual_score,
            'voice_score': voice_score,
            'has_voice': has_voice,
            'risk_level': risk_level,
            'phq9_symptoms': self.phq9_symptoms.copy(),
            'recommendations': recommendations,
            'timestamp': time.time()
        }
        
        self.assessment_history.append(result)
        
        return result
    
    def _update_phq9_symptoms(
        self,
        visual_result: Dict,
        voice_result: Optional[Dict]
    ):
        """更新PHQ-9症状评分"""
        # 基于视觉特征
        emotion_score = visual_result.get('emotion_score', 0.0)
        au_score = visual_result.get('au_score', 0.0)
        eye_score = visual_result.get('eye_score', 0.0)
        
        # 兴趣丧失 (anhedonia) - 缺乏快乐表情
        self.phq9_symptoms['anhedonia'] = emotion_score * 0.8
        
        # 情绪低落 (depression) - 悲伤情绪
        self.phq9_symptoms['depression'] = emotion_score
        
        # 疲劳 (fatigue) - 眼部疲劳
        self.phq9_symptoms['fatigue'] = eye_score
        
        # 精神运动性改变 (psychomotor) - AU活动减少
        self.phq9_symptoms['psychomotor'] = au_score * 0.6
        
        # 基于语音特征
        if voice_result:
            voice_score = voice_result.get('voice_score', 0.0)
            
            # 睡眠问题 - 语音疲劳
            self.phq9_symptoms['sleep'] = voice_score * 0.5
            
            # 注意力问题 - 语速变慢、停顿增多
            self.phq9_symptoms['concentration'] = voice_score * 0.6
            
            # 自我价值感低 - 文本内容
            if voice_result.get('text_sentiment_score', 0) > 0.5:
                self.phq9_symptoms['worthlessness'] = voice_score * 0.7
    
    def _get_risk_level(self, score: float) -> str:
        """获取风险等级"""
        if score < 0.3:
            return 'low'
        elif score < 0.5:
            return 'mild'
        elif score < 0.7:
            return 'moderate'
        else:
            return 'severe'
    
    def _generate_recommendations(self, score: float, risk_level: str) -> List[str]:
        """生成建议"""
        recommendations = []
        
        if risk_level == 'low':
            recommendations.append("您的状态良好,继续保持积极的生活方式")
            recommendations.append("建议保持规律作息和适度运动")
        
        elif risk_level == 'mild':
            recommendations.append("检测到轻度抑郁倾向,建议关注心理健康")
            recommendations.append("可以尝试放松训练、冥想等自我调节方法")
            recommendations.append("保持社交活动,与朋友家人多交流")
        
        elif risk_level == 'moderate':
            recommendations.append("检测到中度抑郁倾向,建议寻求专业帮助")
            recommendations.append("可以咨询心理咨询师或心理医生")
            recommendations.append("建立规律的作息时间,保证充足睡眠")
            recommendations.append("避免独处过久,寻求社会支持")
        
        else:  # severe
            recommendations.append("检测到严重抑郁倾向,强烈建议立即就医")
            recommendations.append("请联系精神科医生或心理危机干预热线")
            recommendations.append("不要独自面对,告诉信任的人您的感受")
            recommendations.append("危机干预热线: 400-161-9995 (24小时)")
        
        return recommendations
    
    def get_phq9_score(self) -> Dict:
        """
        计算PHQ-9总分
        
        Returns:
            PHQ-9评分结果
        """
        # 每个症状0-3分
        symptom_scores = {}
        total_score = 0
        
        for symptom, value in self.phq9_symptoms.items():
            # 转换为0-3分
            score = int(value * 3)
            symptom_scores[symptom] = score
            total_score += score
        
        # PHQ-9严重程度
        if total_score < 5:
            severity = 'minimal'
        elif total_score < 10:
            severity = 'mild'
        elif total_score < 15:
            severity = 'moderate'
        elif total_score < 20:
            severity = 'moderately_severe'
        else:
            severity = 'severe'
        
        return {
            'total_score': total_score,
            'max_score': 27,
            'severity': severity,
            'symptom_scores': symptom_scores
        }
    
    def get_trend_analysis(self, window: int = 50) -> Dict:
        """
        获取趋势分析
        
        Args:
            window: 分析窗口大小
            
        Returns:
            趋势分析结果
        """
        if len(self.fusion_scores) < 10:
            return {
                'available': False,
                'message': '数据不足'
            }
        
        # 提取最近的评分
        recent_scores = list(self.fusion_scores)[-window:]
        
        # 计算统计量
        mean_score = np.mean(recent_scores)
        std_score = np.std(recent_scores)
        min_score = np.min(recent_scores)
        max_score = np.max(recent_scores)
        
        # 计算趋势
        if len(recent_scores) >= 20:
            first_half = np.mean(recent_scores[:len(recent_scores)//2])
            second_half = np.mean(recent_scores[len(recent_scores)//2:])
            
            if second_half > first_half + 0.1:
                trend = 'worsening'
            elif second_half < first_half - 0.1:
                trend = 'improving'
            else:
                trend = 'stable'
        else:
            trend = 'unknown'
        
        return {
            'available': True,
            'mean_score': mean_score,
            'std_score': std_score,
            'min_score': min_score,
            'max_score': max_score,
            'trend': trend,
            'sample_count': len(recent_scores)
        }
    
    def get_summary_report(self) -> Dict:
        """
        生成综合报告
        
        Returns:
            综合报告
        """
        # PHQ-9评分
        phq9 = self.get_phq9_score()
        
        # 趋势分析
        trend = self.get_trend_analysis()
        
        # 最近评估
        if self.assessment_history:
            latest = self.assessment_history[-1]
        else:
            latest = None
        
        # 统计
        if self.fusion_scores:
            avg_score = np.mean(self.fusion_scores)
            risk_level = self._get_risk_level(avg_score)
        else:
            avg_score = 0.0
            risk_level = 'unknown'
        
        return {
            'phq9': phq9,
            'trend': trend,
            'latest_assessment': latest,
            'average_score': avg_score,
            'risk_level': risk_level,
            'assessment_count': len(self.assessment_history),
            'timestamp': time.time()
        }
