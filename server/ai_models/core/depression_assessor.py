"""
抑郁风险评估模块
基于多维度特征综合评估抑郁倾向
"""

import numpy as np
from typing import Dict, List, Optional
from collections import deque
import time
from datetime import datetime


class DepressionRiskAssessor:
    """
    抑郁风险评估器
    
    评估维度:
    1. 情绪特征 (40%): 积极情绪缺失、消极情绪持续、情绪扁平化
    2. 微表情特征 (30%): 真实微笑缺失、悲伤表情频繁、表情反应迟缓
    3. 眼部特征 (20%): 眼神回避、眨眼频率异常、眼睛疲劳
    4. 行为特征 (10%): 面部活动减少、表情僵化
    
    风险等级:
    - low (0-30): 低风险
    - medium (30-60): 中风险
    - high (60-100): 高风险
    """
    
    def __init__(self, window_size: int = 600):
        """
        初始化评估器
        
        Args:
            window_size: 评估窗口大小(帧数),默认600帧(约20秒@30fps)
        """
        self.window_size = window_size
        
        # 数据历史
        self.emotion_history = deque(maxlen=window_size)
        self.au_history = deque(maxlen=window_size)
        self.eye_history = deque(maxlen=window_size)
        
        # 权重配置
        self.weights = {
            'emotion': 0.4,
            'micro_expression': 0.3,
            'eye': 0.2,
            'behavior': 0.1
        }
        
        # 临床阈值
        self.thresholds = {
            'happy_ratio_low': 0.1,      # 积极情绪过低
            'sad_ratio_high': 0.3,        # 悲伤情绪过高
            'neutral_ratio_high': 0.6,    # 中性情绪过高(情感扁平)
            'emotion_variance_low': 0.3,  # 情绪变化过小
            'smile_ratio_low': 0.05,      # 真实微笑过少
            'sadness_expr_high': 0.2,     # 悲伤表情过多
            'au_activation_low': 0.1,     # AU激活过少
            'blink_rate_low': 10,         # 眨眼过少(次/分钟)
            'blink_rate_high': 40,        # 眨眼过多(次/分钟)
            'eye_fatigue_high': 0.3       # 眼睛疲劳过高
        }
        
        # 评估历史
        self.assessment_history = []
        
    def update(
        self,
        emotion_data: Optional[Dict] = None,
        au_data: Optional[Dict] = None,
        eye_data: Optional[Dict] = None
    ):
        """
        更新数据
        
        Args:
            emotion_data: 情绪识别结果
            au_data: AU检测结果
            eye_data: 眼部分析结果
        """
        if emotion_data:
            self.emotion_history.append({
                'emotion': emotion_data.get('emotion'),
                'confidence': emotion_data.get('confidence'),
                'probabilities': emotion_data.get('probabilities', {}),
                'timestamp': time.time()
            })
        
        if au_data:
            self.au_history.append({
                'au_activations': au_data.get('au_activations', {}),
                'micro_expressions': au_data.get('micro_expressions', []),
                'timestamp': time.time()
            })
        
        if eye_data:
            self.eye_history.append({
                'ear': eye_data.get('ear', 0),
                'blink': eye_data.get('blink', False),
                'timestamp': time.time()
            })
    
    def assess(self) -> Dict:
        """
        综合评估抑郁风险
        
        Returns:
            评估结果:
            - risk_score: 风险评分 (0-100)
            - risk_level: 风险等级 ('low', 'medium', 'high')
            - emotion_score: 情绪特征得分
            - micro_expression_score: 微表情特征得分
            - eye_score: 眼部特征得分
            - behavior_score: 行为特征得分
            - details: 详细分析
            - recommendations: 建议
        """
        # 检查数据充足性
        if len(self.emotion_history) < 30:
            return {
                'risk_score': 0,
                'risk_level': 'insufficient_data',
                'message': '数据不足,需要至少30帧数据'
            }
        
        # 计算各维度得分
        emotion_score = self._assess_emotion_features()
        micro_expr_score = self._assess_micro_expression_features()
        eye_score = self._assess_eye_features()
        behavior_score = self._assess_behavior_features()
        
        # 加权综合
        risk_score = (
            emotion_score * self.weights['emotion'] +
            micro_expr_score * self.weights['micro_expression'] +
            eye_score * self.weights['eye'] +
            behavior_score * self.weights['behavior']
        )
        
        # 风险等级
        risk_level = self._classify_risk_level(risk_score)
        
        # 生成详细分析
        details = self._generate_details(
            emotion_score,
            micro_expr_score,
            eye_score,
            behavior_score
        )
        
        # 生成建议
        recommendations = self._generate_recommendations(risk_level, details)
        
        # 保存评估历史
        assessment = {
            'risk_score': risk_score,
            'risk_level': risk_level,
            'emotion_score': emotion_score,
            'micro_expression_score': micro_expr_score,
            'eye_score': eye_score,
            'behavior_score': behavior_score,
            'details': details,
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat(),
            'data_frames': len(self.emotion_history)
        }
        
        self.assessment_history.append(assessment)
        
        return assessment
    
    def _assess_emotion_features(self) -> float:
        """评估情绪特征 (0-100)"""
        if len(self.emotion_history) == 0:
            return 0
        
        # 统计情绪分布
        emotion_counts = {}
        for record in self.emotion_history:
            emotion = record['emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        total = len(self.emotion_history)
        
        # 计算比例
        happy_ratio = emotion_counts.get('happy', 0) / total
        sad_ratio = emotion_counts.get('sad', 0) / total
        neutral_ratio = emotion_counts.get('neutral', 0) / total
        
        # 计算情绪变化幅度
        emotion_variance = self._calculate_emotion_variance()
        
        # 评分逻辑
        score = 0
        
        # 1. 积极情绪缺失 (30分)
        if happy_ratio < self.thresholds['happy_ratio_low']:
            score += 30
        elif happy_ratio < 0.2:
            score += 15
        
        # 2. 消极情绪持续 (25分)
        if sad_ratio > self.thresholds['sad_ratio_high']:
            score += 25
        elif sad_ratio > 0.2:
            score += 12
        
        # 3. 中性情绪过多(情感扁平化) (20分)
        if neutral_ratio > self.thresholds['neutral_ratio_high']:
            score += 20
        elif neutral_ratio > 0.5:
            score += 10
        
        # 4. 情绪变化小(扁平化) (25分)
        if emotion_variance < self.thresholds['emotion_variance_low']:
            score += 25
        elif emotion_variance < 0.5:
            score += 12
        
        return min(score, 100)
    
    def _assess_micro_expression_features(self) -> float:
        """评估微表情特征 (0-100)"""
        if len(self.au_history) == 0:
            return 0
        
        # 统计AU激活频率
        au_activation_counts = {}
        genuine_smile_count = 0
        sadness_expr_count = 0
        total_au_activations = 0
        
        for record in self.au_history:
            au_activations = record['au_activations']
            micro_expressions = record['micro_expressions']
            
            # 统计AU
            for au, activated in au_activations.items():
                if activated:
                    au_activation_counts[au] = au_activation_counts.get(au, 0) + 1
                    total_au_activations += 1
            
            # 统计微表情
            if 'genuine_smile' in micro_expressions:
                genuine_smile_count += 1
            
            if 'sadness' in micro_expressions or 'worry' in micro_expressions:
                sadness_expr_count += 1
        
        total = len(self.au_history)
        
        # 计算比例
        genuine_smile_ratio = genuine_smile_count / total
        sadness_expr_ratio = sadness_expr_count / total
        au_activation_rate = total_au_activations / (total * len(au_activation_counts)) if au_activation_counts else 0
        
        # 评分
        score = 0
        
        # 1. 真实微笑缺失 (40分)
        if genuine_smile_ratio < self.thresholds['smile_ratio_low']:
            score += 40
        elif genuine_smile_ratio < 0.1:
            score += 20
        
        # 2. 悲伤表情频繁 (35分)
        if sadness_expr_ratio > self.thresholds['sadness_expr_high']:
            score += 35
        elif sadness_expr_ratio > 0.1:
            score += 18
        
        # 3. AU激活总频率低(面部活动减少) (25分)
        if au_activation_rate < self.thresholds['au_activation_low']:
            score += 25
        elif au_activation_rate < 0.2:
            score += 12
        
        return min(score, 100)
    
    def _assess_eye_features(self) -> float:
        """评估眼部特征 (0-100)"""
        if len(self.eye_history) == 0:
            return 0
        
        # 计算眨眼频率
        blink_count = sum(1 for record in self.eye_history if record.get('blink', False))
        duration_minutes = (self.eye_history[-1]['timestamp'] - self.eye_history[0]['timestamp']) / 60.0
        blink_rate = blink_count / duration_minutes if duration_minutes > 0 else 0
        
        # 计算平均EAR
        ear_values = [record['ear'] for record in self.eye_history if record['ear'] > 0]
        avg_ear = np.mean(ear_values) if ear_values else 0
        
        # 计算眼睛疲劳指标(低EAR的比例)
        fatigue_count = sum(1 for ear in ear_values if ear < 0.2)
        fatigue_ratio = fatigue_count / len(ear_values) if ear_values else 0
        
        # 评分
        score = 0
        
        # 1. 眨眼频率异常 (40分)
        if blink_rate < self.thresholds['blink_rate_low'] or blink_rate > self.thresholds['blink_rate_high']:
            score += 40
        elif blink_rate < 15 or blink_rate > 35:
            score += 20
        
        # 2. 眼睛疲劳 (35分)
        if fatigue_ratio > self.thresholds['eye_fatigue_high']:
            score += 35
        elif fatigue_ratio > 0.2:
            score += 18
        
        # 3. 眼神活力不足 (25分)
        if avg_ear < 0.15:
            score += 25
        elif avg_ear < 0.2:
            score += 12
        
        return min(score, 100)
    
    def _assess_behavior_features(self) -> float:
        """评估行为特征 (0-100)"""
        # 简化版本:基于AU激活的总体活跃度
        if len(self.au_history) == 0:
            return 0
        
        # 计算面部活动频率
        total_activations = 0
        for record in self.au_history:
            au_activations = record['au_activations']
            total_activations += sum(1 for activated in au_activations.values() if activated)
        
        avg_activations = total_activations / len(self.au_history)
        
        # 评分
        score = 0
        
        # 面部活动减少
        if avg_activations < 1.0:
            score += 60
        elif avg_activations < 2.0:
            score += 30
        
        # 表情僵化(变化少)
        activation_variance = self._calculate_au_variance()
        if activation_variance < 0.5:
            score += 40
        elif activation_variance < 1.0:
            score += 20
        
        return min(score, 100)
    
    def _calculate_emotion_variance(self) -> float:
        """计算情绪方差"""
        if len(self.emotion_history) < 2:
            return 0.0
        
        # 情绪数值映射
        emotion_values = {
            'happy': 1.0,
            'surprise': 0.5,
            'neutral': 0.0,
            'fear': -0.3,
            'disgust': -0.5,
            'angry': -0.7,
            'sad': -1.0
        }
        
        values = [emotion_values.get(r['emotion'], 0) for r in self.emotion_history]
        
        return float(np.var(values))
    
    def _calculate_au_variance(self) -> float:
        """计算AU激活方差"""
        if len(self.au_history) < 2:
            return 0.0
        
        activation_counts = []
        for record in self.au_history:
            count = sum(1 for activated in record['au_activations'].values() if activated)
            activation_counts.append(count)
        
        return float(np.var(activation_counts))
    
    def _classify_risk_level(self, score: float) -> str:
        """分类风险等级"""
        if score < 30:
            return 'low'
        elif score < 60:
            return 'medium'
        else:
            return 'high'
    
    def _generate_details(
        self,
        emotion_score: float,
        micro_expr_score: float,
        eye_score: float,
        behavior_score: float
    ) -> Dict:
        """生成详细分析"""
        # 情绪分析
        emotion_counts = {}
        for record in self.emotion_history:
            emotion = record['emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        total_emotions = len(self.emotion_history)
        emotion_distribution = {e: c / total_emotions for e, c in emotion_counts.items()}
        
        # 微表情分析
        micro_expr_counts = {}
        for record in self.au_history:
            for expr in record['micro_expressions']:
                micro_expr_counts[expr] = micro_expr_counts.get(expr, 0) + 1
        
        # 眼部分析
        blink_count = sum(1 for record in self.eye_history if record.get('blink', False))
        duration_minutes = (self.eye_history[-1]['timestamp'] - self.eye_history[0]['timestamp']) / 60.0 if len(self.eye_history) > 1 else 1
        blink_rate = blink_count / duration_minutes
        
        return {
            'emotion_distribution': emotion_distribution,
            'emotion_score': emotion_score,
            'micro_expression_counts': micro_expr_counts,
            'micro_expression_score': micro_expr_score,
            'blink_rate': blink_rate,
            'eye_score': eye_score,
            'behavior_score': behavior_score
        }
    
    def _generate_recommendations(self, risk_level: str, details: Dict) -> List[str]:
        """生成建议"""
        recommendations = []
        
        if risk_level == 'low':
            recommendations.append("当前情绪状态良好,继续保持积极心态")
            recommendations.append("建议定期进行自我情绪检查")
        
        elif risk_level == 'medium':
            recommendations.append("检测到一些抑郁倾向的迹象,建议关注情绪变化")
            recommendations.append("尝试增加户外活动和社交互动")
            recommendations.append("保持规律作息和充足睡眠")
            recommendations.append("如持续感到不适,建议咨询心理健康专业人士")
        
        else:  # high
            recommendations.append("⚠️ 检测到较明显的抑郁倾向特征")
            recommendations.append("强烈建议尽快咨询心理健康专业人士或精神科医生")
            recommendations.append("寻求家人和朋友的支持")
            recommendations.append("避免独处,保持社交联系")
            recommendations.append("如有自伤或自杀想法,请立即拨打心理危机热线")
        
        # 根据具体特征添加建议
        emotion_dist = details.get('emotion_distribution', {})
        
        if emotion_dist.get('sad', 0) > 0.3:
            recommendations.append("悲伤情绪较多,尝试做一些让自己开心的事情")
        
        if emotion_dist.get('happy', 0) < 0.1:
            recommendations.append("积极情绪较少,建议培养兴趣爱好")
        
        if details.get('blink_rate', 20) < 15:
            recommendations.append("眨眼频率偏低,注意眼部休息")
        
        return recommendations
    
    def get_assessment_history(self) -> List[Dict]:
        """获取评估历史"""
        return self.assessment_history
    
    def reset(self):
        """重置评估器"""
        self.emotion_history.clear()
        self.au_history.clear()
        self.eye_history.clear()
        self.assessment_history.clear()


if __name__ == '__main__':
    """测试抑郁风险评估器"""
    import sys
    import os
    import cv2
    
    # 导入依赖模块
    sys.path.insert(0, os.path.dirname(__file__))
    from face_detector import YuNetFaceDetector
    from landmark_detector import FaceLandmarkDetector, EyeAnalyzer
    from au_detector import AUDetector
    from emotion_recognizer import EmotionRecognizer
    
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
    emotion_recognizer = EmotionRecognizer()
    eye_analyzer = EyeAnalyzer()
    depression_assessor = DepressionRiskAssessor()
    
    # 打开摄像头
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    print("按 'q' 退出")
    print("按 's' 生成评估报告")
    print("按 'r' 重置评估器")
    
    fps_list = []
    frame_count = 0
    
    # 眨眼检测
    blink_detector = {'ear_threshold': 0.2, 'consecutive_frames': 3, 'counter': 0, 'total_blinks': 0}
    
    while True:
        start_time = time.time()
        frame_count += 1
        
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
                
                # 裁剪人脸图像
                face_image = frame[y:y+h, x:x+w]
                
                # 识别情绪
                emotion_result = emotion_recognizer.recognize(face_image, au_result)
                
                # 眼部分析
                left_ear = eye_analyzer.calculate_ear(key_points['left_eye'])
                right_ear = eye_analyzer.calculate_ear(key_points['right_eye'])
                avg_ear = (left_ear + right_ear) / 2.0
                
                # 眨眼检测
                blink_detected = False
                if avg_ear < blink_detector['ear_threshold']:
                    blink_detector['counter'] += 1
                else:
                    if blink_detector['counter'] >= blink_detector['consecutive_frames']:
                        blink_detector['total_blinks'] += 1
                        blink_detected = True
                    blink_detector['counter'] = 0
                
                # 更新评估器
                depression_assessor.update(
                    emotion_data=emotion_result,
                    au_data=au_result,
                    eye_data={'ear': avg_ear, 'blink': blink_detected}
                )
                
                # 显示情绪
                emotion = emotion_result['emotion']
                confidence = emotion_result['confidence']
                emotion_text = f"Emotion: {emotion} ({confidence:.2f})"
                cv2.putText(output, emotion_text, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                
                # 显示数据收集状态
                data_frames = len(depression_assessor.emotion_history)
                data_text = f"Data: {data_frames} frames"
                cv2.putText(output, data_text, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # 计算FPS
        fps = 1.0 / (time.time() - start_time)
        fps_list.append(fps)
        if len(fps_list) > 30:
            fps_list.pop(0)
        avg_fps = sum(fps_list) / len(fps_list)
        
        # 显示信息
        info_text = f"FPS: {avg_fps:.1f} | Faces: {len(faces)}"
        cv2.putText(output, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow('Depression Risk Assessment', output)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            # 生成评估报告
            assessment = depression_assessor.assess()
            
            if assessment.get('risk_level') == 'insufficient_data':
                print(f"\n{assessment['message']}")
            else:
                print("\n" + "="*60)
                print("抑郁风险评估报告")
                print("="*60)
                print(f"评估时间: {assessment['timestamp']}")
                print(f"数据帧数: {assessment['data_frames']}")
                print(f"\n风险评分: {assessment['risk_score']:.1f}/100")
                print(f"风险等级: {assessment['risk_level'].upper()}")
                print(f"\n各维度得分:")
                print(f"  情绪特征: {assessment['emotion_score']:.1f}/100")
                print(f"  微表情特征: {assessment['micro_expression_score']:.1f}/100")
                print(f"  眼部特征: {assessment['eye_score']:.1f}/100")
                print(f"  行为特征: {assessment['behavior_score']:.1f}/100")
                
                details = assessment['details']
                print(f"\n情绪分布:")
                for emo, ratio in details['emotion_distribution'].items():
                    print(f"  {emo}: {ratio:.1%}")
                
                print(f"\n建议:")
                for i, rec in enumerate(assessment['recommendations'], 1):
                    print(f"  {i}. {rec}")
                print("="*60)
        
        elif key == ord('r'):
            depression_assessor.reset()
            print("评估器已重置")
    
    cap.release()
    cv2.destroyAllWindows()
    landmark_detector.close()
    
    print(f"\n平均FPS: {sum(fps_list) / len(fps_list):.1f}")
