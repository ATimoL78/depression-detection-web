"""
PHQ-9临床标准评估模块
基于DSM-5抑郁症诊断标准的Patient Health Questionnaire-9
"""

import numpy as np
from typing import Dict, List, Optional
from collections import deque
from datetime import datetime
import time


class PHQ9Assessor:
    """
    PHQ-9评估器
    
    PHQ-9是基于DSM-5抑郁症诊断标准的9项问卷:
    1. 兴趣或乐趣缺失
    2. 情绪低落、沮丧或绝望
    3. 入睡困难、睡眠不安或睡眠过多
    4. 疲倦或没有活力
    5. 食欲不振或吃太多
    6. 对自己感到失望、觉得自己很失败或让自己或家人失望
    7. 注意力不集中
    8. 动作或说话速度缓慢或焦躁不安
    9. 有不如死掉或伤害自己的念头
    
    每项评分0-3分:
    - 0: 完全不会
    - 1: 有几天
    - 2: 一半以上的天数
    - 3: 几乎每天
    
    总分解释:
    - 0-4: 无抑郁症状
    - 5-9: 轻度抑郁
    - 10-14: 中度抑郁
    - 15-19: 中重度抑郁
    - 20-27: 重度抑郁
    """
    
    def __init__(self, observation_window: int = 1800):  # 60秒 @ 30fps
        """
        初始化PHQ-9评估器
        
        Args:
            observation_window: 观察窗口大小(帧数)
        """
        self.observation_window = observation_window
        
        # PHQ-9症状到视觉特征的映射
        self.symptom_mappings = {
            'PHQ1_anhedonia': {  # 兴趣或乐趣缺失
                'description': '兴趣或乐趣缺失',
                'visual_indicators': ['happy_emotion_low', 'smile_frequency_low', 'flat_affect']
            },
            'PHQ2_depressed_mood': {  # 情绪低落
                'description': '情绪低落、沮丧或绝望',
                'visual_indicators': ['sad_emotion_high', 'negative_emotion_persistent', 'downturned_mouth']
            },
            'PHQ3_sleep': {  # 睡眠问题
                'description': '睡眠问题',
                'visual_indicators': ['eye_fatigue', 'dark_circles', 'reduced_alertness']
            },
            'PHQ4_fatigue': {  # 疲倦
                'description': '疲倦或没有活力',
                'visual_indicators': ['reduced_facial_activity', 'slow_expression_change', 'droopy_eyelids']
            },
            'PHQ5_appetite': {  # 食欲改变
                'description': '食欲改变',
                'visual_indicators': ['facial_weight_change', 'cheek_hollowness']
            },
            'PHQ6_guilt': {  # 自我评价低
                'description': '自我评价低、内疚',
                'visual_indicators': ['gaze_avoidance', 'downcast_eyes', 'shame_expression']
            },
            'PHQ7_concentration': {  # 注意力不集中
                'description': '注意力不集中',
                'visual_indicators': ['unfocused_gaze', 'frequent_blinking', 'distracted_look']
            },
            'PHQ8_psychomotor': {  # 精神运动改变
                'description': '动作或说话缓慢/焦躁',
                'visual_indicators': ['slow_expression_response', 'reduced_micro_expressions', 'agitation_signs']
            },
            'PHQ9_suicidal': {  # 自杀想法
                'description': '自杀想法',
                'visual_indicators': ['extreme_sadness', 'hopeless_expression', 'blank_stare']
            }
        }
        
        # 数据历史
        self.emotion_history = deque(maxlen=observation_window)
        self.au_history = deque(maxlen=observation_window)
        self.eye_history = deque(maxlen=observation_window)
        self.temporal_features = deque(maxlen=observation_window)
        
        # 评估历史
        self.assessment_history = []
    
    def update(
        self,
        emotion_data: Optional[Dict] = None,
        au_data: Optional[Dict] = None,
        eye_data: Optional[Dict] = None,
        temporal_data: Optional[Dict] = None
    ):
        """
        更新观察数据
        
        Args:
            emotion_data: 情绪识别结果
            au_data: AU检测结果
            eye_data: 眼部分析结果
            temporal_data: 时序特征
        """
        if emotion_data:
            self.emotion_history.append({
                **emotion_data,
                'timestamp': time.time()
            })
        
        if au_data:
            self.au_history.append({
                **au_data,
                'timestamp': time.time()
            })
        
        if eye_data:
            self.eye_history.append({
                **eye_data,
                'timestamp': time.time()
            })
        
        if temporal_data:
            self.temporal_features.append({
                **temporal_data,
                'timestamp': time.time()
            })
    
    def assess(self) -> Dict:
        """
        进行PHQ-9评估
        
        Returns:
            PHQ-9评估结果:
            - phq9_total_score: 总分 (0-27)
            - phq9_severity: 严重程度
            - phq9_items: 各项得分
            - clinical_recommendation: 临床建议
            - confidence: 评估置信度
        """
        # 检查数据充足性
        if len(self.emotion_history) < 300:  # 至少10秒数据
            return {
                'status': 'insufficient_data',
                'message': '数据不足,需要至少10秒的观察数据'
            }
        
        # 计算各项PHQ-9得分
        phq9_items = {}
        
        phq9_items['PHQ1'] = self._assess_anhedonia()
        phq9_items['PHQ2'] = self._assess_depressed_mood()
        phq9_items['PHQ3'] = self._assess_sleep_problems()
        phq9_items['PHQ4'] = self._assess_fatigue()
        phq9_items['PHQ5'] = self._assess_appetite_change()
        phq9_items['PHQ6'] = self._assess_guilt()
        phq9_items['PHQ7'] = self._assess_concentration()
        phq9_items['PHQ8'] = self._assess_psychomotor()
        phq9_items['PHQ9'] = self._assess_suicidal_ideation()
        
        # 计算总分
        phq9_total_score = sum(phq9_items.values())
        
        # 严重程度分类
        phq9_severity = self._classify_severity(phq9_total_score)
        
        # 临床建议
        clinical_recommendation = self._generate_clinical_recommendation(
            phq9_total_score,
            phq9_severity,
            phq9_items
        )
        
        # 评估置信度
        confidence = self._calculate_confidence()
        
        # 保存评估历史
        assessment = {
            'phq9_total_score': phq9_total_score,
            'phq9_severity': phq9_severity,
            'phq9_items': phq9_items,
            'clinical_recommendation': clinical_recommendation,
            'confidence': confidence,
            'timestamp': datetime.now().isoformat(),
            'observation_frames': len(self.emotion_history)
        }
        
        self.assessment_history.append(assessment)
        
        return assessment
    
    def _assess_anhedonia(self) -> int:
        """评估PHQ1: 兴趣或乐趣缺失"""
        # 指标: 快乐情绪比例、微笑频率
        
        happy_count = sum(1 for r in self.emotion_history if r.get('emotion') == 'happy')
        happy_ratio = happy_count / len(self.emotion_history)
        
        # 统计真实微笑
        genuine_smile_count = sum(
            1 for r in self.au_history
            if 'genuine_smile' in r.get('micro_expressions', [])
        )
        smile_ratio = genuine_smile_count / len(self.au_history) if self.au_history else 0
        
        # 评分逻辑
        if happy_ratio < 0.05 and smile_ratio < 0.02:
            return 3  # 几乎每天
        elif happy_ratio < 0.10 and smile_ratio < 0.05:
            return 2  # 一半以上天数
        elif happy_ratio < 0.15 and smile_ratio < 0.10:
            return 1  # 有几天
        else:
            return 0  # 完全不会
    
    def _assess_depressed_mood(self) -> int:
        """评估PHQ2: 情绪低落"""
        # 指标: 悲伤情绪比例、消极情绪持续时间
        
        sad_count = sum(1 for r in self.emotion_history if r.get('emotion') == 'sad')
        sad_ratio = sad_count / len(self.emotion_history)
        
        # 消极情绪比例
        negative_emotions = ['sad', 'angry', 'fear', 'disgust']
        negative_count = sum(
            1 for r in self.emotion_history
            if r.get('emotion') in negative_emotions
        )
        negative_ratio = negative_count / len(self.emotion_history)
        
        # 评分
        if sad_ratio > 0.40 or negative_ratio > 0.60:
            return 3
        elif sad_ratio > 0.25 or negative_ratio > 0.45:
            return 2
        elif sad_ratio > 0.15 or negative_ratio > 0.30:
            return 1
        else:
            return 0
    
    def _assess_sleep_problems(self) -> int:
        """评估PHQ3: 睡眠问题"""
        # 指标: 眼睛疲劳、眨眼频率异常
        
        if not self.eye_history:
            return 0
        
        # 眼睛疲劳 (低EAR比例)
        low_ear_count = sum(1 for r in self.eye_history if r.get('ear', 1.0) < 0.18)
        fatigue_ratio = low_ear_count / len(self.eye_history)
        
        # 眨眼频率
        blink_count = sum(1 for r in self.eye_history if r.get('blink', False))
        duration_minutes = (self.eye_history[-1]['timestamp'] - self.eye_history[0]['timestamp']) / 60.0
        blink_rate = blink_count / duration_minutes if duration_minutes > 0 else 20
        
        # 评分
        if fatigue_ratio > 0.40 or blink_rate < 10 or blink_rate > 45:
            return 3
        elif fatigue_ratio > 0.30 or blink_rate < 12 or blink_rate > 40:
            return 2
        elif fatigue_ratio > 0.20 or blink_rate < 15 or blink_rate > 35:
            return 1
        else:
            return 0
    
    def _assess_fatigue(self) -> int:
        """评估PHQ4: 疲倦或没有活力"""
        # 指标: 面部活动减少、表情变化缓慢
        
        # AU激活频率
        if self.au_history:
            total_activations = sum(
                sum(1 for v in r.get('au_activations', {}).values() if v)
                for r in self.au_history
            )
            avg_activations = total_activations / len(self.au_history)
        else:
            avg_activations = 2.0
        
        # 时序特征: 表情变化率
        if self.temporal_features:
            change_rate = self.temporal_features[-1].get('emotion_change_rate', 0.2)
        else:
            change_rate = 0.2
        
        # 评分
        if avg_activations < 0.8 and change_rate < 0.05:
            return 3
        elif avg_activations < 1.2 and change_rate < 0.10:
            return 2
        elif avg_activations < 1.5 and change_rate < 0.15:
            return 1
        else:
            return 0
    
    def _assess_appetite_change(self) -> int:
        """评估PHQ5: 食欲改变"""
        # 注意: 仅通过面部特征难以准确评估,给予保守评分
        # 实际应用中需要结合体重变化等其他数据
        
        # 暂时返回0,未来可以添加面部消瘦/浮肿检测
        return 0
    
    def _assess_guilt(self) -> int:
        """评估PHQ6: 自我评价低、内疚"""
        # 指标: 眼神回避、悲伤表情中的AU1+AU4组合
        
        # 统计悲伤+眉毛下压的组合 (内疚表情)
        guilt_expression_count = 0
        for r in self.au_history:
            au_act = r.get('au_activations', {})
            if au_act.get('AU1') and au_act.get('AU4'):
                guilt_expression_count += 1
        
        guilt_ratio = guilt_expression_count / len(self.au_history) if self.au_history else 0
        
        # 评分
        if guilt_ratio > 0.25:
            return 3
        elif guilt_ratio > 0.15:
            return 2
        elif guilt_ratio > 0.08:
            return 1
        else:
            return 0
    
    def _assess_concentration(self) -> int:
        """评估PHQ7: 注意力不集中"""
        # 指标: 眼神涣散、频繁眨眼
        
        if not self.eye_history:
            return 0
        
        # 眨眼频率过高可能表示注意力不集中
        blink_count = sum(1 for r in self.eye_history if r.get('blink', False))
        duration_minutes = (self.eye_history[-1]['timestamp'] - self.eye_history[0]['timestamp']) / 60.0
        blink_rate = blink_count / duration_minutes if duration_minutes > 0 else 20
        
        # 评分
        if blink_rate > 50:
            return 3
        elif blink_rate > 42:
            return 2
        elif blink_rate > 35:
            return 1
        else:
            return 0
    
    def _assess_psychomotor(self) -> int:
        """评估PHQ8: 精神运动改变"""
        # 指标: 表情反应迟缓、微表情减少
        
        # 时序特征
        if self.temporal_features:
            change_rate = self.temporal_features[-1].get('emotion_change_rate', 0.2)
            micro_expr_rate = self.temporal_features[-1].get('micro_expression_rate', 0.2)
        else:
            change_rate = 0.2
            micro_expr_rate = 0.2
        
        # 评分
        if change_rate < 0.05 and micro_expr_rate < 0.05:
            return 3
        elif change_rate < 0.10 and micro_expr_rate < 0.10:
            return 2
        elif change_rate < 0.15 and micro_expr_rate < 0.15:
            return 1
        else:
            return 0
    
    def _assess_suicidal_ideation(self) -> int:
        """评估PHQ9: 自杀想法"""
        # 注意: 这是最严重的症状,需要极其谨慎
        # 仅通过面部表情难以准确判断,给予保守评分
        
        # 指标: 极度悲伤、绝望表情
        extreme_sad_count = sum(
            1 for r in self.emotion_history
            if r.get('emotion') == 'sad' and r.get('confidence', 0) > 0.9
        )
        extreme_sad_ratio = extreme_sad_count / len(self.emotion_history)
        
        # 极其保守的评分
        if extreme_sad_ratio > 0.60:
            return 1  # 最多给1分,需要专业评估
        else:
            return 0
    
    def _classify_severity(self, total_score: int) -> str:
        """分类严重程度"""
        if total_score <= 4:
            return 'none'
        elif total_score <= 9:
            return 'mild'
        elif total_score <= 14:
            return 'moderate'
        elif total_score <= 19:
            return 'moderately_severe'
        else:
            return 'severe'
    
    def _generate_clinical_recommendation(
        self,
        total_score: int,
        severity: str,
        items: Dict
    ) -> List[str]:
        """生成临床建议"""
        recommendations = []
        
        if severity == 'none':
            recommendations.append("当前未检测到明显的抑郁症状")
            recommendations.append("建议继续保持良好的心理健康习惯")
        
        elif severity == 'mild':
            recommendations.append("检测到轻度抑郁症状")
            recommendations.append("建议进行自我监测和生活方式调整")
            recommendations.append("增加户外活动和社交互动")
            recommendations.append("保持规律作息和充足睡眠")
            recommendations.append("如症状持续2周以上,建议咨询心理健康专业人士")
        
        elif severity == 'moderate':
            recommendations.append("检测到中度抑郁症状")
            recommendations.append("强烈建议咨询心理健康专业人士或精神科医生")
            recommendations.append("可能需要心理治疗(如认知行为疗法)")
            recommendations.append("保持与家人和朋友的联系")
            recommendations.append("避免独处,寻求社会支持")
        
        elif severity == 'moderately_severe':
            recommendations.append("⚠️ 检测到中重度抑郁症状")
            recommendations.append("请尽快咨询精神科医生进行专业评估")
            recommendations.append("可能需要药物治疗结合心理治疗")
            recommendations.append("建议家人陪同就医")
            recommendations.append("密切关注自身状态,避免独处")
        
        else:  # severe
            recommendations.append("⚠️⚠️ 检测到重度抑郁症状")
            recommendations.append("请立即寻求专业医疗帮助")
            recommendations.append("建议立即联系精神科医生或前往医院")
            recommendations.append("需要家人或朋友陪伴和支持")
            recommendations.append("如有自伤或自杀想法,请立即拨打心理危机热线")
            recommendations.append("心理危机热线: 010-82951332 (北京)")
        
        # 根据具体症状添加建议
        if items.get('PHQ3', 0) >= 2:
            recommendations.append("睡眠问题较严重,建议改善睡眠卫生")
        
        if items.get('PHQ4', 0) >= 2:
            recommendations.append("疲劳感明显,注意休息和营养")
        
        if items.get('PHQ9', 0) >= 1:
            recommendations.append("⚠️ 检测到可能的自杀想法,请立即寻求专业帮助")
        
        return recommendations
    
    def _calculate_confidence(self) -> float:
        """计算评估置信度"""
        # 基于数据量和质量
        
        data_frames = len(self.emotion_history)
        
        # 数据量因子
        if data_frames < 300:
            data_factor = data_frames / 300.0
        elif data_frames < 1800:
            data_factor = 0.5 + (data_frames - 300) / 1500.0 * 0.3
        else:
            data_factor = 0.8 + min((data_frames - 1800) / 1800.0 * 0.2, 0.2)
        
        # 数据质量因子 (基于平均置信度)
        if self.emotion_history:
            avg_confidence = np.mean([r.get('confidence', 0.5) for r in self.emotion_history])
            quality_factor = avg_confidence
        else:
            quality_factor = 0.5
        
        # 综合置信度
        confidence = (data_factor * 0.6 + quality_factor * 0.4)
        
        return float(confidence)
    
    def get_phq9_report(self) -> str:
        """生成PHQ-9报告文本"""
        if not self.assessment_history:
            return "尚未进行评估"
        
        assessment = self.assessment_history[-1]
        
        report = []
        report.append("="*60)
        report.append("PHQ-9抑郁症评估报告")
        report.append("="*60)
        report.append(f"评估时间: {assessment['timestamp']}")
        report.append(f"观察帧数: {assessment['observation_frames']}")
        report.append(f"评估置信度: {assessment['confidence']:.1%}")
        report.append("")
        report.append(f"PHQ-9总分: {assessment['phq9_total_score']}/27")
        report.append(f"严重程度: {self._severity_to_chinese(assessment['phq9_severity'])}")
        report.append("")
        report.append("各项得分:")
        
        items = assessment['phq9_items']
        item_names = {
            'PHQ1': '1. 兴趣或乐趣缺失',
            'PHQ2': '2. 情绪低落、沮丧或绝望',
            'PHQ3': '3. 睡眠问题',
            'PHQ4': '4. 疲倦或没有活力',
            'PHQ5': '5. 食欲改变',
            'PHQ6': '6. 自我评价低、内疚',
            'PHQ7': '7. 注意力不集中',
            'PHQ8': '8. 精神运动改变',
            'PHQ9': '9. 自杀想法'
        }
        
        for key in sorted(items.keys()):
            score = items[key]
            name = item_names.get(key, key)
            report.append(f"  {name}: {score}/3")
        
        report.append("")
        report.append("临床建议:")
        for i, rec in enumerate(assessment['clinical_recommendation'], 1):
            report.append(f"  {i}. {rec}")
        
        report.append("")
        report.append("="*60)
        report.append("⚠️ 重要声明:")
        report.append("本评估仅供参考,不能替代专业医疗诊断。")
        report.append("如有心理健康问题,请咨询专业医疗机构。")
        report.append("="*60)
        
        return "\n".join(report)
    
    def _severity_to_chinese(self, severity: str) -> str:
        """严重程度英文转中文"""
        mapping = {
            'none': '无抑郁症状',
            'mild': '轻度抑郁',
            'moderate': '中度抑郁',
            'moderately_severe': '中重度抑郁',
            'severe': '重度抑郁'
        }
        return mapping.get(severity, severity)
    
    def reset(self):
        """重置评估器"""
        self.emotion_history.clear()
        self.au_history.clear()
        self.eye_history.clear()
        self.temporal_features.clear()


if __name__ == '__main__':
    """测试PHQ-9评估器"""
    print("="*60)
    print("PHQ-9评估器测试")
    print("="*60)
    
    # 创建评估器
    assessor = PHQ9Assessor()
    
    # 模拟抑郁症患者数据
    print("\n模拟抑郁症患者数据...")
    
    for i in range(600):  # 20秒 @ 30fps
        # 主要是悲伤情绪
        if i % 10 < 8:
            emotion = 'sad'
            confidence = 0.85
        elif i % 10 < 9:
            emotion = 'neutral'
            confidence = 0.75
        else:
            emotion = 'happy'
            confidence = 0.60
        
        assessor.update(
            emotion_data={
                'emotion': emotion,
                'confidence': confidence
            },
            au_data={
                'au_activations': {
                    'AU1': True if i % 5 < 3 else False,
                    'AU4': True if i % 5 < 3 else False,
                    'AU15': True if i % 7 < 4 else False
                },
                'micro_expressions': []
            },
            eye_data={
                'ear': 0.16 if i % 10 < 6 else 0.22,
                'blink': i % 30 == 0
            },
            temporal_data={
                'emotion_change_rate': 0.08,
                'micro_expression_rate': 0.05
            }
        )
    
    # 进行评估
    assessment = assessor.assess()
    
    # 打印报告
    print("\n" + assessor.get_phq9_report())
    
    print("\n" + "="*60)
