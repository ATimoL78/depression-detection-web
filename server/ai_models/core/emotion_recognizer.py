"""
情绪识别模块
基于人脸图像和AU特征的多模态情绪识别
"""

import cv2
import numpy as np
from typing import Dict, List, Optional
from collections import deque
import time


class EmotionRecognizer:
    """
    情绪识别器
    
    支持7种基础情绪:
    - angry: 愤怒
    - disgust: 厌恶
    - fear: 恐惧
    - happy: 快乐
    - sad: 悲伤
    - surprise: 惊讶
    - neutral: 中性
    """
    
    EMOTIONS = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
    
    def __init__(self, model_path: Optional[str] = None, use_au_fusion: bool = True):
        """
        初始化情绪识别器
        
        Args:
            model_path: ONNX模型路径(可选)
            use_au_fusion: 是否使用AU特征融合
        """
        self.model_path = model_path
        self.use_au_fusion = use_au_fusion
        
        # 加载模型(如果提供)
        self.model = None
        if model_path:
            self._load_model(model_path)
        
        # 情绪历史(用于时序平滑)
        self.emotion_history = deque(maxlen=10)
        
        # 性能统计
        self.recognition_times = []
        
    def _load_model(self, model_path: str):
        """加载ONNX模型"""
        try:
            import onnxruntime as ort
            self.model = ort.InferenceSession(
                model_path,
                providers=['CPUExecutionProvider']
            )
            print(f"情绪识别模型加载成功: {model_path}")
        except Exception as e:
            print(f"模型加载失败: {e}")
            print("将使用基于规则的情绪识别")
            self.model = None
    
    def recognize(
        self,
        face_image: np.ndarray,
        au_data: Optional[Dict] = None
    ) -> Dict:
        """
        识别情绪
        
        Args:
            face_image: 人脸图像(BGR格式)
            au_data: AU检测结果(可选,用于融合)
            
        Returns:
            情绪识别结果:
            - emotion: 主要情绪
            - confidence: 置信度
            - probabilities: 所有情绪的概率分布
            - method: 识别方法('model' or 'rule')
        """
        start_time = time.time()
        
        # 方法1: 基于深度学习模型
        if self.model is not None:
            result = self._recognize_by_model(face_image)
        # 方法2: 基于AU规则
        elif au_data is not None:
            result = self._recognize_by_au(au_data)
        # 方法3: 基于简单规则(fallback)
        else:
            result = self._recognize_by_simple_rule(face_image)
        
        # AU特征融合(如果可用)
        if self.use_au_fusion and au_data is not None and result['method'] == 'model':
            result = self._fuse_with_au(result, au_data)
        
        # 时序平滑
        result = self._temporal_smoothing(result)
        
        recognition_time = (time.time() - start_time) * 1000
        self.recognition_times.append(recognition_time)
        if len(self.recognition_times) > 100:
            self.recognition_times.pop(0)
        
        result['recognition_time'] = recognition_time
        
        return result
    
    def _recognize_by_model(self, face_image: np.ndarray) -> Dict:
        """基于深度学习模型识别情绪"""
        # 预处理
        input_tensor = self._preprocess_image(face_image)
        
        # 推理
        outputs = self.model.run(None, {'input': input_tensor})
        probabilities = outputs[0][0]
        
        # 获取主要情绪
        emotion_idx = np.argmax(probabilities)
        emotion = self.EMOTIONS[emotion_idx]
        confidence = float(probabilities[emotion_idx])
        
        return {
            'emotion': emotion,
            'confidence': confidence,
            'probabilities': dict(zip(self.EMOTIONS, probabilities.tolist())),
            'method': 'model'
        }
    
    def _recognize_by_au(self, au_data: Dict) -> Dict:
        """基于AU特征识别情绪"""
        au_activations = au_data.get('au_activations', {})
        micro_expressions = au_data.get('micro_expressions', [])
        
        # 情绪评分
        emotion_scores = {emotion: 0.0 for emotion in self.EMOTIONS}
        
        # 基于微表情映射
        expression_emotion_map = {
            'genuine_smile': 'happy',
            'fake_smile': 'neutral',
            'sadness': 'sad',
            'worry': 'sad',
            'anger': 'angry',
            'disgust': 'disgust',
            'fear': 'fear',
            'surprise': 'surprise'
        }
        
        for expr in micro_expressions:
            mapped_emotion = expression_emotion_map.get(expr)
            if mapped_emotion:
                emotion_scores[mapped_emotion] += 0.3
        
        # 基于AU组合
        # 快乐: AU6 + AU12
        if au_activations.get('AU6') and au_activations.get('AU12'):
            emotion_scores['happy'] += 0.4
        elif au_activations.get('AU12'):
            emotion_scores['happy'] += 0.2
        
        # 悲伤: AU1 + AU4 + AU15
        if au_activations.get('AU1') and au_activations.get('AU15'):
            emotion_scores['sad'] += 0.4
        if au_activations.get('AU4'):
            emotion_scores['sad'] += 0.1
        
        # 愤怒: AU4 + AU7
        if au_activations.get('AU4') and au_activations.get('AU7'):
            emotion_scores['angry'] += 0.4
        
        # 厌恶: AU9 + AU7
        if au_activations.get('AU9') and au_activations.get('AU7'):
            emotion_scores['disgust'] += 0.4
        elif au_activations.get('AU9'):
            emotion_scores['disgust'] += 0.2
        
        # 恐惧: AU1 + AU2 + AU5 + AU20
        fear_count = sum([
            au_activations.get('AU1', False),
            au_activations.get('AU2', False),
            au_activations.get('AU5', False),
            au_activations.get('AU20', False)
        ])
        if fear_count >= 3:
            emotion_scores['fear'] += 0.4
        elif fear_count >= 2:
            emotion_scores['fear'] += 0.2
        
        # 惊讶: AU1 + AU2 + AU5 + AU26
        surprise_count = sum([
            au_activations.get('AU1', False),
            au_activations.get('AU2', False),
            au_activations.get('AU5', False),
            au_activations.get('AU26', False)
        ])
        if surprise_count >= 3:
            emotion_scores['surprise'] += 0.4
        elif surprise_count >= 2:
            emotion_scores['surprise'] += 0.2
        
        # 归一化
        total_score = sum(emotion_scores.values())
        if total_score > 0:
            probabilities = {e: s / total_score for e, s in emotion_scores.items()}
        else:
            # 默认中性
            probabilities = {e: 0.0 for e in self.EMOTIONS}
            probabilities['neutral'] = 1.0
        
        # 获取主要情绪
        emotion = max(probabilities, key=probabilities.get)
        confidence = probabilities[emotion]
        
        return {
            'emotion': emotion,
            'confidence': confidence,
            'probabilities': probabilities,
            'method': 'au'
        }
    
    def _recognize_by_simple_rule(self, face_image: np.ndarray) -> Dict:
        """基于简单规则识别情绪(fallback)"""
        # 简化版本:分析图像亮度和对比度
        gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
        
        # 计算统计特征
        mean_brightness = np.mean(gray)
        std_brightness = np.std(gray)
        
        # 简单规则(仅作为fallback)
        if mean_brightness > 150:
            emotion = 'happy'
        elif mean_brightness < 80:
            emotion = 'sad'
        else:
            emotion = 'neutral'
        
        probabilities = {e: 0.0 for e in self.EMOTIONS}
        probabilities[emotion] = 0.6
        probabilities['neutral'] = 0.4 - probabilities[emotion] * 0.4
        
        return {
            'emotion': emotion,
            'confidence': 0.6,
            'probabilities': probabilities,
            'method': 'simple_rule'
        }
    
    def _fuse_with_au(self, model_result: Dict, au_data: Dict) -> Dict:
        """融合模型结果和AU特征"""
        # 获取AU推断的情绪
        au_result = self._recognize_by_au(au_data)
        
        # 加权融合
        model_weight = 0.7
        au_weight = 0.3
        
        fused_probabilities = {}
        for emotion in self.EMOTIONS:
            model_prob = model_result['probabilities'].get(emotion, 0)
            au_prob = au_result['probabilities'].get(emotion, 0)
            fused_probabilities[emotion] = model_prob * model_weight + au_prob * au_weight
        
        # 获取融合后的主要情绪
        emotion = max(fused_probabilities, key=fused_probabilities.get)
        confidence = fused_probabilities[emotion]
        
        return {
            'emotion': emotion,
            'confidence': confidence,
            'probabilities': fused_probabilities,
            'method': 'fusion'
        }
    
    def _temporal_smoothing(self, result: Dict) -> Dict:
        """时序平滑,减少抖动"""
        self.emotion_history.append(result)
        
        if len(self.emotion_history) < 3:
            return result
        
        # 统计最近N帧的情绪
        recent_emotions = [r['emotion'] for r in self.emotion_history]
        
        # 计数
        emotion_counts = {}
        for emotion in recent_emotions:
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        # 多数投票
        smoothed_emotion = max(emotion_counts, key=emotion_counts.get)
        
        # 如果与当前情绪不同,保留当前结果但标记
        if smoothed_emotion != result['emotion']:
            result['smoothed_emotion'] = smoothed_emotion
        
        return result
    
    def _preprocess_image(self, face_image: np.ndarray, target_size: tuple = (48, 48)) -> np.ndarray:
        """预处理人脸图像"""
        # 转换为灰度图
        if len(face_image.shape) == 3:
            gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
        else:
            gray = face_image
        
        # 调整大小
        resized = cv2.resize(gray, target_size)
        
        # 归一化
        normalized = resized.astype(np.float32) / 255.0
        
        # 添加batch和channel维度
        input_tensor = normalized.reshape(1, 1, target_size[0], target_size[1])
        
        return input_tensor
    
    def get_avg_recognition_time(self) -> float:
        """获取平均识别时间(ms)"""
        if len(self.recognition_times) == 0:
            return 0
        return sum(self.recognition_times) / len(self.recognition_times)


class EmotionAnalyzer:
    """情绪分析器(时序分析)"""
    
    def __init__(self, window_size: int = 300):
        """
        初始化情绪分析器
        
        Args:
            window_size: 分析窗口大小(帧数)
        """
        self.window_size = window_size
        self.emotion_history = deque(maxlen=window_size)
        
    def add_emotion(self, emotion_result: Dict):
        """添加情绪结果"""
        self.emotion_history.append({
            'emotion': emotion_result['emotion'],
            'confidence': emotion_result['confidence'],
            'timestamp': time.time()
        })
    
    def analyze(self) -> Dict:
        """分析情绪时序特征"""
        if len(self.emotion_history) == 0:
            return {}
        
        # 统计情绪分布
        emotion_counts = {}
        for record in self.emotion_history:
            emotion = record['emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        total = len(self.emotion_history)
        emotion_distribution = {e: c / total for e, c in emotion_counts.items()}
        
        # 计算积极/消极情绪比例
        positive_emotions = ['happy', 'surprise']
        negative_emotions = ['sad', 'angry', 'fear', 'disgust']
        
        positive_ratio = sum(emotion_distribution.get(e, 0) for e in positive_emotions)
        negative_ratio = sum(emotion_distribution.get(e, 0) for e in negative_emotions)
        neutral_ratio = emotion_distribution.get('neutral', 0)
        
        # 计算情绪变化率
        emotion_changes = 0
        for i in range(1, len(self.emotion_history)):
            if self.emotion_history[i]['emotion'] != self.emotion_history[i-1]['emotion']:
                emotion_changes += 1
        
        change_rate = emotion_changes / total if total > 1 else 0
        
        # 计算情绪稳定性(方差)
        emotion_variance = self._calculate_emotion_variance()
        
        # 主导情绪
        dominant_emotion = max(emotion_distribution, key=emotion_distribution.get)
        
        return {
            'emotion_distribution': emotion_distribution,
            'positive_ratio': positive_ratio,
            'negative_ratio': negative_ratio,
            'neutral_ratio': neutral_ratio,
            'change_rate': change_rate,
            'emotion_variance': emotion_variance,
            'dominant_emotion': dominant_emotion,
            'total_frames': total
        }
    
    def _calculate_emotion_variance(self) -> float:
        """计算情绪方差(稳定性指标)"""
        if len(self.emotion_history) < 2:
            return 0.0
        
        # 将情绪映射为数值
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


if __name__ == '__main__':
    """测试情绪识别器"""
    import sys
    import os
    
    # 导入依赖模块
    sys.path.insert(0, os.path.dirname(__file__))
    from face_detector import YuNetFaceDetector
    from landmark_detector import FaceLandmarkDetector
    from au_detector import AUDetector
    
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
    emotion_recognizer = EmotionRecognizer()  # 使用基于AU的识别
    emotion_analyzer = EmotionAnalyzer()
    
    # 打开摄像头
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    print("按 'q' 退出")
    print("按 'a' 查看情绪分析")
    
    fps_list = []
    
    while True:
        start_time = time.time()
        
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
                
                # 添加到分析器
                emotion_analyzer.add_emotion(emotion_result)
                
                # 显示情绪
                emotion = emotion_result['emotion']
                confidence = emotion_result['confidence']
                method = emotion_result['method']
                
                emotion_text = f"Emotion: {emotion} ({confidence:.2f}) [{method}]"
                cv2.putText(output, emotion_text, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                
                # 显示情绪概率分布
                y_offset = 120
                for emo, prob in emotion_result['probabilities'].items():
                    if prob > 0.05:
                        prob_text = f"{emo}: {prob:.2f}"
                        cv2.putText(output, prob_text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                        y_offset += 20
        
        # 计算FPS
        fps = 1.0 / (time.time() - start_time)
        fps_list.append(fps)
        if len(fps_list) > 30:
            fps_list.pop(0)
        avg_fps = sum(fps_list) / len(fps_list)
        
        # 显示信息
        info_text = f"FPS: {avg_fps:.1f} | Faces: {len(faces)}"
        cv2.putText(output, info_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow('Emotion Recognition', output)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('a'):
            # 显示情绪分析
            analysis = emotion_analyzer.analyze()
            print("\n=== 情绪分析 ===")
            print(f"总帧数: {analysis.get('total_frames', 0)}")
            print(f"主导情绪: {analysis.get('dominant_emotion', 'N/A')}")
            print(f"积极情绪比例: {analysis.get('positive_ratio', 0):.2%}")
            print(f"消极情绪比例: {analysis.get('negative_ratio', 0):.2%}")
            print(f"中性情绪比例: {analysis.get('neutral_ratio', 0):.2%}")
            print(f"情绪变化率: {analysis.get('change_rate', 0):.2%}")
            print(f"情绪稳定性: {analysis.get('emotion_variance', 0):.3f}")
            print("\n情绪分布:")
            for emo, ratio in analysis.get('emotion_distribution', {}).items():
                print(f"  {emo}: {ratio:.2%}")
    
    cap.release()
    cv2.destroyAllWindows()
    landmark_detector.close()
    
    print(f"\n平均FPS: {sum(fps_list) / len(fps_list):.1f}")
    print(f"平均情绪识别时间: {emotion_recognizer.get_avg_recognition_time():.1f}ms")
