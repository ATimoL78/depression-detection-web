"""
多模态融合评估器 v2.0
Multimodal Fusion Assessor

功能:
1. 面部表情和语音情感的融合分析
2. 注意力机制加权融合
3. 置信度自适应调整
4. 多维度抑郁症评估
"""

import numpy as np
from typing import Dict, List, Optional
from collections import deque


class MultimodalFusionAssessor:
    """
    多模态融合评估器
    
    融合策略:
    1. 基于置信度的动态加权
    2. 注意力机制
    3. 时序一致性检验
    4. 异常检测
    """
    
    def __init__(
        self,
        face_weight: float = 0.6,
        voice_weight: float = 0.4,
        use_attention: bool = True
    ):
        """
        初始化多模态融合评估器
        
        Args:
            face_weight: 面部模态权重
            voice_weight: 语音模态权重
            use_attention: 是否使用注意力机制
        """
        self.face_weight = face_weight
        self.voice_weight = voice_weight
        self.use_attention = use_attention
        
        # 融合历史
        self.fusion_history = deque(maxlen=100)
        
        # 模态可用性跟踪
        self.face_available_count = 0
        self.voice_available_count = 0
        self.total_frames = 0
        
        # 情感映射
        self.emotion_mapping = {
            'happy': 0,
            'neutral': 1,
            'sad': 2,
            'angry': 3,
            'anxious': 4,
            'surprised': 5,
            'disgusted': 6,
            'fearful': 7
        }
        
        # 抑郁相关情感权重
        self.depression_emotion_weights = {
            'sad': 1.0,
            'anxious': 0.8,
            'neutral': 0.6,  # 持续中性也可能是抑郁信号
            'angry': 0.4,
            'fearful': 0.3,
            'happy': -0.5,  # 负权重表示与抑郁负相关
            'surprised': 0.0,
            'disgusted': 0.2
        }
        
        print("✓ 多模态融合评估器已初始化")
    
    def fuse(
        self,
        face_result: Optional[Dict],
        voice_result: Optional[Dict]
    ) -> Dict:
        """
        融合面部和语音分析结果
        
        Args:
            face_result: 面部分析结果
            voice_result: 语音分析结果
            
        Returns:
            融合后的评估结果
        """
        self.total_frames += 1
        
        # 检查模态可用性
        face_available = face_result is not None and face_result.get('status') == 'success'
        voice_available = voice_result is not None and voice_result.get('status') == 'success'
        
        if face_available:
            self.face_available_count += 1
        if voice_available:
            self.voice_available_count += 1
        
        # 单模态情况
        if not face_available and not voice_available:
            return self._create_empty_result()
        
        if not face_available:
            return self._voice_only_result(voice_result)
        
        if not voice_available:
            return self._face_only_result(face_result)
        
        # 双模态融合
        fusion_result = self._multimodal_fusion(face_result, voice_result)
        
        # 记录历史
        self.fusion_history.append(fusion_result)
        
        return fusion_result
    
    def _multimodal_fusion(
        self,
        face_result: Dict,
        voice_result: Dict
    ) -> Dict:
        """
        多模态融合核心算法
        """
        # 提取情感信息
        face_emotion = face_result.get('emotion', {})
        voice_emotion = voice_result.get('emotion', {})
        
        face_emotion_label = face_emotion.get('emotion', 'neutral')
        face_confidence = face_emotion.get('confidence', 0.5)
        
        voice_emotion_label = voice_emotion.get('emotion', 'neutral')
        voice_confidence = voice_emotion.get('confidence', 0.5)
        
        # 动态权重调整
        if self.use_attention:
            face_weight, voice_weight = self._compute_attention_weights(
                face_confidence, voice_confidence
            )
        else:
            face_weight = self.face_weight
            voice_weight = self.voice_weight
        
        # 情感融合
        fused_emotion, fused_confidence = self._fuse_emotions(
            face_emotion_label, face_confidence, face_weight,
            voice_emotion_label, voice_confidence, voice_weight
        )
        
        # 抑郁指标融合
        depression_score = self._fuse_depression_indicators(
            face_result, voice_result, face_weight, voice_weight
        )
        
        # 综合评估
        assessment = self._comprehensive_assessment(
            fused_emotion, fused_confidence, depression_score,
            face_result, voice_result
        )
        
        return {
            'status': 'success',
            'emotion': {
                'emotion': fused_emotion,
                'confidence': fused_confidence,
                'face_emotion': face_emotion_label,
                'voice_emotion': voice_emotion_label
            },
            'depression_score': depression_score,
            'assessment': assessment,
            'modality_weights': {
                'face': face_weight,
                'voice': voice_weight
            },
            'modality_availability': {
                'face': True,
                'voice': True
            }
        }
    
    def _compute_attention_weights(
        self,
        face_confidence: float,
        voice_confidence: float
    ) -> tuple:
        """
        计算注意力权重
        基于置信度的动态加权
        """
        # Softmax归一化
        face_score = np.exp(face_confidence * 2)
        voice_score = np.exp(voice_confidence * 2)
        
        total_score = face_score + voice_score
        
        face_weight = face_score / total_score
        voice_weight = voice_score / total_score
        
        # 平滑处理,避免极端权重
        alpha = 0.3  # 平滑系数
        face_weight = alpha * self.face_weight + (1 - alpha) * face_weight
        voice_weight = alpha * self.voice_weight + (1 - alpha) * voice_weight
        
        # 归一化
        total = face_weight + voice_weight
        face_weight /= total
        voice_weight /= total
        
        return face_weight, voice_weight
    
    def _fuse_emotions(
        self,
        face_emotion: str,
        face_conf: float,
        face_weight: float,
        voice_emotion: str,
        voice_conf: float,
        voice_weight: float
    ) -> tuple:
        """
        融合情感标签和置信度
        """
        # 如果两个模态情感一致
        if face_emotion == voice_emotion:
            # 置信度加权平均,并提升(一致性奖励)
            fused_conf = (face_conf * face_weight + voice_conf * voice_weight) * 1.2
            fused_conf = min(1.0, fused_conf)
            return face_emotion, fused_conf
        
        # 情感不一致,选择置信度更高的
        face_score = face_conf * face_weight
        voice_score = voice_conf * voice_weight
        
        if face_score > voice_score:
            # 置信度降低(不一致性惩罚)
            fused_conf = face_conf * 0.8
            return face_emotion, fused_conf
        else:
            fused_conf = voice_conf * 0.8
            return voice_emotion, fused_conf
    
    def _fuse_depression_indicators(
        self,
        face_result: Dict,
        voice_result: Dict,
        face_weight: float,
        voice_weight: float
    ) -> float:
        """
        融合抑郁指标
        """
        # 面部抑郁指标
        face_depression = 0.0
        if 'clinical' in face_result:
            clinical = face_result['clinical']
            face_depression = clinical.get('depression_risk', 0.0)
        elif 'depression' in face_result:
            face_depression = face_result['depression'].get('overall_score', 0.0)
        
        # 语音抑郁指标
        voice_depression = 0.0
        if 'depression' in voice_result:
            voice_depression = voice_result['depression'].get('overall_score', 0.0)
        
        # 加权融合
        fused_depression = (
            face_depression * face_weight +
            voice_depression * voice_weight
        )
        
        # 情感贡献
        emotion = face_result.get('emotion', {}).get('emotion', 'neutral')
        emotion_contribution = self.depression_emotion_weights.get(emotion, 0.0)
        
        # 综合评分
        final_score = 0.7 * fused_depression + 0.3 * max(0, emotion_contribution)
        
        return min(1.0, max(0.0, final_score))
    
    def _comprehensive_assessment(
        self,
        emotion: str,
        confidence: float,
        depression_score: float,
        face_result: Dict,
        voice_result: Dict
    ) -> Dict:
        """
        综合评估
        """
        # 风险等级
        if depression_score < 0.3:
            risk_level = 'low'
            risk_label = '低风险'
        elif depression_score < 0.6:
            risk_level = 'medium'
            risk_label = '中等风险'
        else:
            risk_level = 'high'
            risk_label = '高风险'
        
        # 主要特征
        key_features = []
        
        # 面部特征
        if 'au' in face_result:
            au_result = face_result['au']
            active_aus = [au for au, intensity in au_result.get('intensities', {}).items()
                         if intensity > 0.5]
            if active_aus:
                key_features.append(f"面部动作单元: {', '.join(active_aus[:3])}")
        
        # 语音特征
        if 'depression' in voice_result:
            voice_dep = voice_result['depression']
            if voice_dep.get('low_pitch', 0) > 0.5:
                key_features.append("语音: 音调偏低")
            if voice_dep.get('low_energy', 0) > 0.5:
                key_features.append("语音: 能量偏低")
            if voice_dep.get('monotone', 0) > 0.5:
                key_features.append("语音: 语调单一")
        
        # 时序一致性
        consistency_score = self._compute_consistency()
        
        # 建议
        recommendations = self._generate_recommendations(
            risk_level, depression_score, emotion
        )
        
        return {
            'risk_level': risk_level,
            'risk_label': risk_label,
            'depression_score': depression_score,
            'emotion': emotion,
            'confidence': confidence,
            'key_features': key_features,
            'consistency': consistency_score,
            'recommendations': recommendations
        }
    
    def _compute_consistency(self) -> float:
        """
        计算时序一致性
        """
        if len(self.fusion_history) < 5:
            return 0.5
        
        recent_scores = [
            h.get('depression_score', 0.5)
            for h in list(self.fusion_history)[-10:]
        ]
        
        # 标准差越小,一致性越高
        std = np.std(recent_scores)
        consistency = 1.0 / (1.0 + std)
        
        return consistency
    
    def _generate_recommendations(
        self,
        risk_level: str,
        depression_score: float,
        emotion: str
    ) -> List[str]:
        """
        生成建议
        """
        recommendations = []
        
        if risk_level == 'high':
            recommendations.append("建议寻求专业心理咨询")
            recommendations.append("保持规律作息和适度运动")
            recommendations.append("与亲友保持沟通")
        elif risk_level == 'medium':
            recommendations.append("注意情绪变化,适当放松")
            recommendations.append("保持健康的生活方式")
            recommendations.append("如持续不适,建议咨询专业人士")
        else:
            recommendations.append("保持良好的心理状态")
            recommendations.append("继续维持健康的生活习惯")
        
        # 基于情感的个性化建议
        if emotion == 'sad':
            recommendations.append("尝试参与喜欢的活动")
        elif emotion == 'anxious':
            recommendations.append("练习深呼吸和冥想")
        
        return recommendations
    
    def _face_only_result(self, face_result: Dict) -> Dict:
        """仅面部模态的结果"""
        emotion = face_result.get('emotion', {})
        
        depression_score = 0.0
        if 'clinical' in face_result:
            depression_score = face_result['clinical'].get('depression_risk', 0.0)
        
        assessment = self._comprehensive_assessment(
            emotion.get('emotion', 'neutral'),
            emotion.get('confidence', 0.5),
            depression_score,
            face_result,
            {}
        )
        
        return {
            'status': 'success',
            'emotion': emotion,
            'depression_score': depression_score,
            'assessment': assessment,
            'modality_weights': {'face': 1.0, 'voice': 0.0},
            'modality_availability': {'face': True, 'voice': False}
        }
    
    def _voice_only_result(self, voice_result: Dict) -> Dict:
        """仅语音模态的结果"""
        emotion = voice_result.get('emotion', {})
        
        depression_score = 0.0
        if 'depression' in voice_result:
            depression_score = voice_result['depression'].get('overall_score', 0.0)
        
        assessment = self._comprehensive_assessment(
            emotion.get('emotion', 'neutral'),
            emotion.get('confidence', 0.5),
            depression_score,
            {},
            voice_result
        )
        
        return {
            'status': 'success',
            'emotion': emotion,
            'depression_score': depression_score,
            'assessment': assessment,
            'modality_weights': {'face': 0.0, 'voice': 1.0},
            'modality_availability': {'face': False, 'voice': True}
        }
    
    def _create_empty_result(self) -> Dict:
        """创建空结果"""
        return {
            'status': 'no_data',
            'emotion': {'emotion': 'unknown', 'confidence': 0.0},
            'depression_score': 0.0,
            'assessment': {
                'risk_level': 'unknown',
                'risk_label': '无数据',
                'recommendations': ['请确保摄像头和麦克风正常工作']
            },
            'modality_weights': {'face': 0.0, 'voice': 0.0},
            'modality_availability': {'face': False, 'voice': False}
        }
    
    def get_statistics(self) -> Dict:
        """
        获取统计信息
        """
        stats = {
            'total_frames': self.total_frames,
            'face_availability': 0.0,
            'voice_availability': 0.0,
            'avg_depression_score': 0.0
        }
        
        if self.total_frames > 0:
            stats['face_availability'] = self.face_available_count / self.total_frames
            stats['voice_availability'] = self.voice_available_count / self.total_frames
        
        if len(self.fusion_history) > 0:
            scores = [h.get('depression_score', 0.0) for h in self.fusion_history]
            stats['avg_depression_score'] = float(np.mean(scores))
        
        return stats
