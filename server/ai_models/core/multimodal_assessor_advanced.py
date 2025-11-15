"""
高级多模态抑郁评估器 v2.0
- 视觉、语音、行为多模态融合
- PHQ-9标准化评估
- 时序趋势分析
- 风险预警
- 个性化建议生成
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
from datetime import datetime
import json


class AdvancedMultimodalAssessor:
    """
    高级多模态抑郁评估器
    整合多种模态数据进行综合评估
    """
    
    # PHQ-9症状定义
    PHQ9_SYMPTOMS = [
        'anhedonia',  # 兴趣丧失
        'depressed_mood',  # 情绪低落
        'sleep_problems',  # 睡眠问题
        'fatigue',  # 疲劳
        'appetite_changes',  # 食欲改变
        'low_self_worth',  # 自我价值感低
        'concentration_problems',  # 注意力问题
        'psychomotor_changes',  # 精神运动性改变
        'suicidal_thoughts'  # 自杀想法
    ]
    
    # 风险等级定义
    RISK_LEVELS = {
        'minimal': (0, 0.2),
        'mild': (0.2, 0.4),
        'moderate': (0.4, 0.6),
        'moderately_severe': (0.6, 0.8),
        'severe': (0.8, 1.0)
    }
    
    def __init__(
        self,
        assessment_window: int = 1800,  # 30秒评估窗口
        history_size: int = 100
    ):
        """
        初始化评估器
        
        Args:
            assessment_window: 评估窗口大小(帧数)
            history_size: 历史记录大小
        """
        self.assessment_window = assessment_window
        self.history_size = history_size
        
        # 评估历史
        self.visual_scores_history = deque(maxlen=history_size)
        self.voice_scores_history = deque(maxlen=history_size)
        self.overall_scores_history = deque(maxlen=history_size)
        self.phq9_scores_history = deque(maxlen=history_size)
        
        # 症状评分历史
        self.symptom_scores_history = {symptom: deque(maxlen=history_size) for symptom in self.PHQ9_SYMPTOMS}
        
        # 评估记录
        self.assessments = []
        
        # 统计信息
        self.assessment_count = 0
        
    def assess(
        self,
        emotion_result: Dict,
        au_result: Dict,
        eye_analysis: Dict,
        voice_result: Optional[Dict] = None
    ) -> Dict:
        """
        执行多模态评估
        
        Args:
            emotion_result: 情绪识别结果
            au_result: AU检测结果
            eye_analysis: 眼部分析结果
            voice_result: 语音分析结果(可选)
            
        Returns:
            评估结果
        """
        self.assessment_count += 1
        
        # 视觉模态评估
        visual_assessment = self._assess_visual(emotion_result, au_result, eye_analysis)
        
        # 语音模态评估
        if voice_result:
            voice_assessment = self._assess_voice(voice_result)
        else:
            # 返回默认结构,包含component_scores
            voice_assessment = {
                'score': 0.0,
                'component_scores': {
                    'pitch': 0.0,
                    'volume': 0.0,
                    'speech_rate': 0.0,
                    'pause': 0.0,
                    'sentiment': 0.0
                },
                'indicators': []
            }
        
        # 多模态融合
        fusion_result = self._fuse_modalities(visual_assessment, voice_assessment)
        
        # PHQ-9症状映射
        phq9_result = self._map_to_phq9(visual_assessment, voice_assessment, fusion_result)
        
        # 风险评估
        risk_assessment = self._assess_risk(fusion_result['overall_score'], phq9_result)
        
        # 趋势分析
        trend_analysis = self._analyze_trend()
        
        # 生成建议
        recommendations = self._generate_recommendations(
            fusion_result['overall_score'],
            risk_assessment,
            phq9_result,
            trend_analysis
        )
        
        # 记录评估结果
        self.visual_scores_history.append(visual_assessment['score'])
        self.voice_scores_history.append(voice_assessment['score'])
        self.overall_scores_history.append(fusion_result['overall_score'])
        self.phq9_scores_history.append(phq9_result['total_score'])
        
        for symptom, score in phq9_result['symptom_scores'].items():
            self.symptom_scores_history[symptom].append(score)
        
        assessment_record = {
            'timestamp': datetime.now().isoformat(),
            'visual': visual_assessment,
            'voice': voice_assessment,
            'fusion': fusion_result,
            'phq9': phq9_result,
            'risk': risk_assessment,
            'trend': trend_analysis,
            'recommendations': recommendations
        }
        
        self.assessments.append(assessment_record)
        
        return assessment_record
    
    def _assess_visual(
        self,
        emotion_result: Dict,
        au_result: Dict,
        eye_analysis: Dict
    ) -> Dict:
        """评估视觉模态"""
        scores = {}
        indicators = []
        
        # 1. 情绪评分
        emotion = emotion_result.get('emotion', 'neutral')
        confidence = emotion_result.get('confidence', 0.0)
        intensity = emotion_result.get('intensity', 0.0)
        
        # 抑郁相关情绪权重
        emotion_weights = {
            'sad': 1.0,
            'neutral': 0.4,  # 表情平淡
            'angry': 0.5,
            'fear': 0.6,
            'disgust': 0.4,
            'contempt': 0.3,
            'happy': 0.0,
            'surprise': 0.1
        }
        
        emotion_score = emotion_weights.get(emotion, 0.0) * confidence * (0.5 + 0.5 * intensity)
        scores['emotion'] = emotion_score
        
        if emotion in ['sad', 'neutral'] and confidence > 0.5:
            indicators.append(f'{emotion}_emotion')
        
        # 2. AU评分
        au_activations = au_result.get('au_activations', {})
        au_intensities = au_result.get('au_intensities', {})
        
        # 抑郁相关AU
        depression_aus = {
            'AU1': 0.8,   # 内眉上扬(悲伤)
            'AU4': 0.9,   # 皱眉(悲伤、愤怒)
            'AU15': 0.8,  # 嘴角下压(悲伤)
            'AU17': 0.5,  # 下巴上提
            'AU7': 0.6,   # 眼睑收紧
            'AU43': 0.7   # 眼睛闭合(疲劳)
        }
        
        positive_aus = {
            'AU6': 0.6,   # 脸颊上提(快乐)
            'AU12': 0.7   # 嘴角上扬(快乐)
        }
        
        # 计算抑郁AU评分
        depression_au_score = 0.0
        depression_au_count = 0
        
        for au, weight in depression_aus.items():
            if au_activations.get(au, False):
                intensity_val = au_intensities.get(au, 0) / 5.0  # 归一化
                depression_au_score += weight * (0.5 + 0.5 * intensity_val)
                depression_au_count += 1
                indicators.append(f'au_{au.lower()}')
        
        if depression_au_count > 0:
            depression_au_score /= depression_au_count
        
        # 计算积极AU评分(减分项)
        positive_au_penalty = 0.0
        positive_au_count = 0
        
        for au, weight in positive_aus.items():
            if au_activations.get(au, False):
                intensity_val = au_intensities.get(au, 0) / 5.0
                positive_au_penalty += weight * (0.5 + 0.5 * intensity_val)
                positive_au_count += 1
        
        if positive_au_count > 0:
            positive_au_penalty /= positive_au_count
        
        # 综合AU评分
        au_score = max(0.0, depression_au_score - positive_au_penalty * 0.4)
        scores['au'] = au_score
        
        # 3. 眼部评分
        eye_score = 0.0
        
        # 眨眼频率异常
        blink_rate = eye_analysis.get('blink_rate', 0)
        if blink_rate > 0:
            if blink_rate < 10:  # 眨眼过少
                blink_score = min(0.4, (10 - blink_rate) / 10 * 0.4)
                eye_score += blink_score
                indicators.append('reduced_blink_rate')
            elif blink_rate > 30:  # 眨眼过多
                blink_score = min(0.3, (blink_rate - 30) / 20 * 0.3)
                eye_score += blink_score
                indicators.append('increased_blink_rate')
        
        # 疲劳
        fatigue_score = eye_analysis.get('fatigue_score', 0)
        eye_score += fatigue_score * 0.5
        
        if fatigue_score > 0.5:
            indicators.append('eye_fatigue')
        
        # 凝视异常
        avg_fixation = eye_analysis.get('avg_fixation_duration', 0)
        if avg_fixation > 3.0:
            fixation_score = min(0.3, (avg_fixation - 3.0) / 5.0 * 0.3)
            eye_score += fixation_score
            indicators.append('prolonged_gaze')
        
        scores['eye'] = min(1.0, eye_score)
        
        # 综合视觉评分(加权平均)
        visual_score = (
            scores['emotion'] * 0.4 +
            scores['au'] * 0.35 +
            scores['eye'] * 0.25
        )
        
        return {
            'score': visual_score,
            'component_scores': scores,
            'indicators': indicators
        }
    
    def _assess_voice(self, voice_result: Dict) -> Dict:
        """评估语音模态"""
        scores = {}
        indicators = []
        
        # 语音特征评分
        voice_indicators = voice_result.get('voice_indicators', {})
        
        # 音调
        pitch_score = voice_indicators.get('pitch_score', 0)
        scores['pitch'] = pitch_score
        if pitch_score > 0.5:
            indicators.append('low_pitch')
        
        # 音量
        volume_score = voice_indicators.get('volume_score', 0)
        scores['volume'] = volume_score
        if volume_score > 0.5:
            indicators.append('low_volume')
        
        # 语速
        speech_rate_score = voice_indicators.get('speech_rate_score', 0)
        scores['speech_rate'] = speech_rate_score
        if speech_rate_score > 0.5:
            indicators.append('slow_speech')
        
        # 停顿
        pause_score = voice_indicators.get('pause_score', 0)
        scores['pause'] = pause_score
        if pause_score > 0.5:
            indicators.append('frequent_pauses')
        
        # 文本情感评分
        text_sentiment = voice_result.get('text_sentiment', {})
        sentiment_score = text_sentiment.get('depression_score', 0)
        scores['sentiment'] = sentiment_score
        
        if sentiment_score > 0.5:
            indicators.append('negative_content')
        
        # 综合语音评分
        voice_score = (
            scores['pitch'] * 0.2 +
            scores['volume'] * 0.15 +
            scores['speech_rate'] * 0.2 +
            scores['pause'] * 0.15 +
            scores['sentiment'] * 0.3
        )
        
        return {
            'score': voice_score,
            'component_scores': scores,
            'indicators': indicators
        }
    
    def _fuse_modalities(
        self,
        visual_assessment: Dict,
        voice_assessment: Dict
    ) -> Dict:
        """融合多模态评估结果"""
        # 权重配置
        visual_weight = 0.65
        voice_weight = 0.35
        
        # 如果没有语音数据,全部权重给视觉
        if voice_assessment['score'] == 0:
            visual_weight = 1.0
            voice_weight = 0.0
        
        # 加权融合
        overall_score = (
            visual_assessment['score'] * visual_weight +
            voice_assessment['score'] * voice_weight
        )
        
        # 合并指标
        all_indicators = visual_assessment['indicators'] + voice_assessment['indicators']
        
        return {
            'overall_score': overall_score,
            'visual_score': visual_assessment['score'],
            'voice_score': voice_assessment['score'],
            'weights': {'visual': visual_weight, 'voice': voice_weight},
            'indicators': all_indicators
        }
    
    def _map_to_phq9(
        self,
        visual_assessment: Dict,
        voice_assessment: Dict,
        fusion_result: Dict
    ) -> Dict:
        """映射到PHQ-9症状评分"""
        symptom_scores = {}
        
        indicators = fusion_result['indicators']
        visual_scores = visual_assessment['component_scores']
        voice_scores = voice_assessment['component_scores']
        
        # 1. 兴趣丧失 (Anhedonia)
        anhedonia_score = 0
        if 'neutral_emotion' in indicators or 'happy' not in visual_assessment.get('emotion', ''):
            anhedonia_score += 1
        if visual_scores.get('emotion', 0) > 0.3:
            anhedonia_score += 1
        if 'au_au6' not in indicators and 'au_au12' not in indicators:
            anhedonia_score += 1
        symptom_scores['anhedonia'] = min(3, anhedonia_score)
        
        # 2. 情绪低落 (Depressed Mood)
        mood_score = 0
        if 'sad_emotion' in indicators:
            mood_score += 2
        if visual_scores.get('emotion', 0) > 0.5:
            mood_score += 1
        symptom_scores['depressed_mood'] = min(3, mood_score)
        
        # 3. 睡眠问题 (Sleep Problems)
        sleep_score = 0
        if 'eye_fatigue' in indicators:
            sleep_score += 2
        if voice_scores.get('volume', 0) > 0.5:
            sleep_score += 1
        symptom_scores['sleep_problems'] = min(3, sleep_score)
        
        # 4. 疲劳 (Fatigue)
        fatigue_score = 0
        if visual_scores.get('eye', 0) > 0.5:
            fatigue_score += 2
        if 'slow_speech' in indicators:
            fatigue_score += 1
        symptom_scores['fatigue'] = min(3, fatigue_score)
        
        # 5. 食欲改变 (Appetite Changes)
        appetite_score = 0
        if 'negative_content' in indicators:
            appetite_score += 1
        symptom_scores['appetite_changes'] = min(3, appetite_score)
        
        # 6. 自我价值感低 (Low Self-Worth)
        self_worth_score = 0
        if voice_scores.get('sentiment', 0) > 0.6:
            self_worth_score += 2
        if 'low_pitch' in indicators:
            self_worth_score += 1
        symptom_scores['low_self_worth'] = min(3, self_worth_score)
        
        # 7. 注意力问题 (Concentration Problems)
        concentration_score = 0
        if 'prolonged_gaze' in indicators:
            concentration_score += 1
        if 'frequent_pauses' in indicators:
            concentration_score += 1
        symptom_scores['concentration_problems'] = min(3, concentration_score)
        
        # 8. 精神运动性改变 (Psychomotor Changes)
        psychomotor_score = 0
        if visual_scores.get('au', 0) < 0.2:  # AU活动减少
            psychomotor_score += 1
        if 'slow_speech' in indicators:
            psychomotor_score += 1
        symptom_scores['psychomotor_changes'] = min(3, psychomotor_score)
        
        # 9. 自杀想法 (Suicidal Thoughts)
        # 这个需要更专业的评估,这里保守给0
        symptom_scores['suicidal_thoughts'] = 0
        
        # 计算总分 (0-27)
        total_score = sum(symptom_scores.values())
        
        # 严重程度
        if total_score <= 4:
            severity = 'minimal'
        elif total_score <= 9:
            severity = 'mild'
        elif total_score <= 14:
            severity = 'moderate'
        elif total_score <= 19:
            severity = 'moderately_severe'
        else:
            severity = 'severe'
        
        return {
            'total_score': total_score,
            'symptom_scores': symptom_scores,
            'severity': severity
        }
    
    def _assess_risk(self, overall_score: float, phq9_result: Dict) -> Dict:
        """评估风险等级"""
        # 基于综合评分确定风险等级
        for level, (min_score, max_score) in self.RISK_LEVELS.items():
            if min_score <= overall_score < max_score:
                risk_level = level
                break
        else:
            risk_level = 'severe'
        
        # 风险因素
        risk_factors = []
        
        if phq9_result['total_score'] >= 15:
            risk_factors.append('high_phq9_score')
        
        if overall_score >= 0.7:
            risk_factors.append('high_depression_indicators')
        
        symptom_scores = phq9_result['symptom_scores']
        if symptom_scores.get('suicidal_thoughts', 0) > 0:
            risk_factors.append('suicidal_ideation')
            risk_level = 'severe'  # 强制提升到严重
        
        # 风险描述
        risk_descriptions = {
            'minimal': '风险极低,状态良好',
            'mild': '轻度风险,建议关注心理健康',
            'moderate': '中度风险,建议咨询心理咨询师',
            'moderately_severe': '中重度风险,强烈建议寻求专业帮助',
            'severe': '严重风险,请立即就医'
        }
        
        return {
            'level': risk_level,
            'score': overall_score,
            'description': risk_descriptions[risk_level],
            'risk_factors': risk_factors
        }
    
    def _analyze_trend(self) -> Dict:
        """分析评分趋势"""
        if len(self.overall_scores_history) < 5:
            return {
                'trend': 'insufficient_data',
                'change_rate': 0.0,
                'stability': 0.5
            }
        
        scores = list(self.overall_scores_history)
        
        # 计算趋势(线性回归斜率)
        x = np.arange(len(scores))
        y = np.array(scores)
        
        if len(x) > 1:
            slope = np.polyfit(x, y, 1)[0]
        else:
            slope = 0.0
        
        # 趋势判断
        if slope > 0.01:
            trend = 'worsening'
        elif slope < -0.01:
            trend = 'improving'
        else:
            trend = 'stable'
        
        # 稳定性(标准差的倒数)
        std = np.std(scores)
        stability = 1.0 / (1.0 + std)
        
        return {
            'trend': trend,
            'change_rate': slope,
            'stability': stability,
            'recent_scores': scores[-10:]
        }
    
    def _generate_recommendations(
        self,
        overall_score: float,
        risk_assessment: Dict,
        phq9_result: Dict,
        trend_analysis: Dict
    ) -> List[str]:
        """生成个性化建议"""
        recommendations = []
        
        risk_level = risk_assessment['level']
        
        # 基于风险等级的建议
        if risk_level == 'minimal':
            recommendations.append('继续保持良好的心理状态')
            recommendations.append('定期进行自我评估')
        elif risk_level == 'mild':
            recommendations.append('关注自己的情绪变化')
            recommendations.append('尝试放松技巧(如冥想、深呼吸)')
            recommendations.append('保持规律的作息和运动')
        elif risk_level == 'moderate':
            recommendations.append('建议咨询心理咨询师')
            recommendations.append('与信任的人分享感受')
            recommendations.append('避免过度压力和疲劳')
        elif risk_level == 'moderately_severe':
            recommendations.append('强烈建议寻求专业心理治疗')
            recommendations.append('考虑药物治疗(需医生评估)')
            recommendations.append('建立支持系统')
        else:  # severe
            recommendations.append('请立即就医,寻求专业帮助')
            recommendations.append('联系心理危机热线: 400-161-9995')
            recommendations.append('不要独自面对,寻求家人朋友支持')
        
        # 基于症状的建议
        symptom_scores = phq9_result['symptom_scores']
        
        if symptom_scores.get('sleep_problems', 0) >= 2:
            recommendations.append('改善睡眠质量:保持规律作息,睡前避免电子设备')
        
        if symptom_scores.get('fatigue', 0) >= 2:
            recommendations.append('适度运动可以改善疲劳感')
        
        if symptom_scores.get('concentration_problems', 0) >= 2:
            recommendations.append('尝试番茄工作法,提高专注力')
        
        # 基于趋势的建议
        if trend_analysis['trend'] == 'worsening':
            recommendations.append('注意:评分呈恶化趋势,建议尽快寻求帮助')
        elif trend_analysis['trend'] == 'improving':
            recommendations.append('很好!状态正在改善,继续保持')
        
        return recommendations
    
    def generate_report(self) -> Dict:
        """生成评估报告"""
        if not self.assessments:
            return {'error': 'No assessments available'}
        
        latest_assessment = self.assessments[-1]
        
        # 统计信息
        avg_visual_score = np.mean(list(self.visual_scores_history)) if self.visual_scores_history else 0
        avg_voice_score = np.mean(list(self.voice_scores_history)) if self.voice_scores_history else 0
        avg_overall_score = np.mean(list(self.overall_scores_history)) if self.overall_scores_history else 0
        avg_phq9_score = np.mean(list(self.phq9_scores_history)) if self.phq9_scores_history else 0
        
        # 症状分布
        symptom_distribution = {}
        for symptom in self.PHQ9_SYMPTOMS:
            if self.symptom_scores_history[symptom]:
                symptom_distribution[symptom] = np.mean(list(self.symptom_scores_history[symptom]))
        
        report = {
            'report_date': datetime.now().isoformat(),
            'assessment_count': self.assessment_count,
            'latest_assessment': latest_assessment,
            'statistics': {
                'avg_visual_score': avg_visual_score,
                'avg_voice_score': avg_voice_score,
                'avg_overall_score': avg_overall_score,
                'avg_phq9_score': avg_phq9_score
            },
            'symptom_distribution': symptom_distribution,
            'trend': latest_assessment['trend'],
            'risk': latest_assessment['risk'],
            'recommendations': latest_assessment['recommendations']
        }
        
        return report
    
    def reset(self):
        """重置评估器"""
        self.visual_scores_history.clear()
        self.voice_scores_history.clear()
        self.overall_scores_history.clear()
        self.phq9_scores_history.clear()
        
        for symptom in self.PHQ9_SYMPTOMS:
            self.symptom_scores_history[symptom].clear()
        
        self.assessments = []
        self.assessment_count = 0
