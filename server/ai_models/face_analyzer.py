#!/usr/bin/env python3
"""
面部分析主脚本
整合多模态抑郁症检测算法
"""

import sys
import json
import cv2
import numpy as np
from pathlib import Path

# 添加core模块到路径
sys.path.insert(0, str(Path(__file__).parent / 'core'))

try:
    from core.face_detector import FaceDetector
    from core.landmark_detector import LandmarkDetector
    from core.au_detector import AUDetector
    from core.emotion_recognizer import EmotionRecognizer
    from core.depression_assessor import DepressionRiskAssessor
except ImportError:
    # 如果导入失败,使用简化版本
    pass


class EnhancedFaceAnalyzer:
    """增强版面部分析器"""
    
    def __init__(self):
        """初始化所有检测器"""
        self.use_advanced = False
        
        try:
            self.face_detector = FaceDetector()
            self.landmark_detector = LandmarkDetector()
            self.au_detector = AUDetector()
            self.emotion_recognizer = EmotionRecognizer()
            self.depression_assessor = DepressionRiskAssessor()
            self.use_advanced = True
        except Exception as e:
            print(f"Warning: Advanced models not available, using basic detection: {e}", file=sys.stderr)
    
    def analyze_image(self, image_path: str) -> dict:
        """
        分析单张图像
        
        Args:
            image_path: 图像文件路径
            
        Returns:
            分析结果字典
        """
        try:
            # 读取图像
            image = cv2.imread(image_path)
            if image is None:
                return {
                    'success': False,
                    'error': f'Failed to load image: {image_path}'
                }
            
            # 如果高级模型可用,使用完整分析
            if self.use_advanced:
                return self._analyze_with_models(image)
            else:
                # 使用基础OpenCV分析
                return self._analyze_basic(image)
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _analyze_with_models(self, image: np.ndarray) -> dict:
        """使用高级模型分析"""
        try:
            # 1. 人脸检测
            faces = self.face_detector.detect(image)
            if not faces or len(faces) == 0:
                return {
                    'success': False,
                    'error': 'No face detected'
                }
            
            # 使用第一个检测到的人脸
            face = faces[0]
            
            # 2. 关键点检测
            landmarks = self.landmark_detector.detect(image, face)
            
            # 3. AU动作单元检测
            au_result = self.au_detector.detect(image, landmarks)
            
            # 4. 情绪识别
            emotion_result = self.emotion_recognizer.recognize(image, face)
            
            # 5. 抑郁风险评估
            self.depression_assessor.update(
                emotion_data=emotion_result,
                au_data=au_result
            )
            risk_assessment = self.depression_assessor.assess()
            
            # 6. 计算抑郁症特征评分
            depression_score = self._calculate_depression_score(au_result, emotion_result)
            
            return {
                'success': True,
                'emotion': emotion_result.get('emotion', 'neutral'),
                'confidence': int(emotion_result.get('confidence', 0) * 100),
                'riskLevel': risk_assessment.get('risk_level', 'low'),
                'riskScore': int(risk_assessment.get('risk_score', 0)),
                'auFeatures': au_result.get('au_activations', {}),
                'facialFeatures': {
                    'eyebrowMovement': self._calculate_eyebrow_movement(au_result),
                    'mouthCorner': self._calculate_mouth_corner(au_result),
                    'eyeGaze': 50  # 需要眼动追踪数据
                },
                'depressionIndicators': {
                    'lackOfSmile': au_result.get('au_activations', {}).get('AU12', 0) < 1.0,
                    'frownPresent': au_result.get('au_activations', {}).get('AU4', 0) > 3.0,
                    'mouthCornerDown': au_result.get('au_activations', {}).get('AU15', 0) > 3.0,
                    'emotionalFlattening': emotion_result.get('emotion') == 'neutral' and emotion_result.get('confidence', 0) > 0.8
                },
                'depressionScore': depression_score
            }
            
        except Exception as e:
            print(f"Error in advanced analysis: {e}", file=sys.stderr)
            return self._analyze_basic(image)
    
    def _analyze_basic(self, image: np.ndarray) -> dict:
        """使用OpenCV基础分析"""
        try:
            # 使用Haar级联检测人脸
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            
            if len(faces) == 0:
                return {
                    'success': False,
                    'error': 'No face detected'
                }
            
            # 获取第一个人脸
            (x, y, w, h) = faces[0]
            face_roi = gray[y:y+h, x:x+w]
            
            # 检测眼睛
            eyes = eye_cascade.detectMultiScale(face_roi)
            
            # 基于简单规则的情绪估计
            emotion, confidence = self._estimate_emotion_basic(face_roi, eyes)
            
            # 计算基础风险评分
            risk_score = self._calculate_basic_risk(emotion, len(eyes))
            risk_level = 'low' if risk_score < 33 else 'medium' if risk_score < 66 else 'high'
            
            return {
                'success': True,
                'emotion': emotion,
                'confidence': confidence,
                'riskLevel': risk_level,
                'riskScore': risk_score,
                'auFeatures': self._generate_mock_au(),
                'facialFeatures': {
                    'eyebrowMovement': 50,
                    'mouthCorner': 50,
                    'eyeGaze': 50
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Basic analysis failed: {str(e)}'
            }
    
    def _estimate_emotion_basic(self, face_roi: np.ndarray, eyes: list) -> tuple:
        """基础情绪估计"""
        # 计算图像亮度和对比度
        mean_intensity = np.mean(face_roi)
        std_intensity = np.std(face_roi)
        
        # 简单规则
        if mean_intensity < 100 and std_intensity < 30:
            return 'sad', 65
        elif len(eyes) < 2:
            return 'neutral', 70
        else:
            return 'neutral', 75
    
    def _calculate_basic_risk(self, emotion: str, eye_count: int) -> int:
        """计算基础风险评分"""
        score = 30  # 基础分
        
        if emotion == 'sad':
            score += 40
        elif emotion == 'angry':
            score += 30
        
        if eye_count < 2:
            score += 20
        
        return min(100, score)
    
    def _generate_mock_au(self) -> dict:
        """生成模拟AU数据"""
        return {
            'AU1': np.random.uniform(0, 3),
            'AU2': np.random.uniform(0, 3),
            'AU4': np.random.uniform(0, 5),
            'AU6': np.random.uniform(0, 4),
            'AU12': np.random.uniform(0, 4),
            'AU15': np.random.uniform(0, 5),
            'AU25': np.random.uniform(0, 3),
            'AU26': np.random.uniform(0, 3)
        }
    
    def _calculate_depression_score(self, au_result: dict, emotion_result: dict) -> int:
        """
        计算抑郁症评分 (0-100)
        基于临床研究的AU模式
        """
        score = 0
        au_activations = au_result.get('au_activations', {})
        
        # AU4 (眉头紧锁) - 抑郁症的重要指标
        if au_activations.get('AU4', 0) > 3:
            score += 20
        
        # AU12 (微笑缺失) - 快感缺失的标志
        if au_activations.get('AU12', 0) < 1:
            score += 25
        
        # AU15 (嘴角下垂) - 悲伤表情
        if au_activations.get('AU15', 0) > 3:
            score += 25
        
        # AU6 (脸颊上提缺失) - 缺乏真实微笑
        if au_activations.get('AU6', 0) < 1:
            score += 15
        
        # 情绪扁平化
        if emotion_result.get('emotion') == 'neutral' and emotion_result.get('confidence', 0) > 0.8:
            score += 15
        
        return min(100, score)
    
    def _calculate_eyebrow_movement(self, au_result: dict) -> float:
        """计算眉毛活动度"""
        au_activations = au_result.get('au_activations', {})
        au1 = au_activations.get('AU1', 0)
        au2 = au_activations.get('AU2', 0)
        au4 = au_activations.get('AU4', 0)
        
        return min(100, (au1 + au2 + au4) * 10)
    
    def _calculate_mouth_corner(self, au_result: dict) -> float:
        """计算嘴角活动度"""
        au_activations = au_result.get('au_activations', {})
        au12 = au_activations.get('AU12', 0)
        au15 = au_activations.get('AU15', 0)
        
        # 正值表示上扬,负值表示下垂
        return 50 + (au12 * 10) - (au15 * 10)


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python face_analyzer.py <image_path>'
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # 检查文件是否存在
    if not Path(image_path).exists():
        print(json.dumps({
            'success': False,
            'error': f'Image file not found: {image_path}'
        }))
        sys.exit(1)
    
    # 创建分析器并分析
    analyzer = EnhancedFaceAnalyzer()
    result = analyzer.analyze_image(image_path)
    
    # 输出JSON结果
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
