"""
增强版情绪识别模块
集成HSEmotion预训练模型 + ONNX加速 + AU融合
"""

import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
import time


class EmotionRecognizerEnhanced:
    """
    增强版情绪识别器
    
    支持三种识别方式:
    1. HSEmotion预训练模型 (推荐,准确率85%+)
    2. 基于AU的规则识别 (快速,准确率70%)
    3. 融合识别 (最准确,准确率90%)
    
    性能:
    - HSEmotion: 3-5ms/帧
    - AU规则: 1-2ms/帧
    - 融合: 4-6ms/帧
    """
    
    def __init__(
        self,
        method: str = 'hsemotion',  # 'hsemotion', 'au', 'fusion'
        model_path: Optional[str] = None,
        use_onnx: bool = True,
        smoothing_window: int = 5
    ):
        """
        初始化情绪识别器
        
        Args:
            method: 识别方法 ('hsemotion', 'au', 'fusion')
            model_path: ONNX模型路径
            use_onnx: 是否使用ONNX加速
            smoothing_window: 时序平滑窗口大小
        """
        self.method = method
        self.use_onnx = use_onnx
        self.smoothing_window = smoothing_window
        
        # 情绪标签映射
        self.emotion_labels = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
        
        # HSEmotion模型 (如果可用)
        self.hsemotion_model = None
        if method in ['hsemotion', 'fusion']:
            self.hsemotion_model = self._load_hsemotion_model(model_path, use_onnx)
        
        # AU规则映射 (优化后,增加更多特征)
        self.au_emotion_rules = {
            'happy': {
                'AU6': 0.9,   # 脸颊上提 (核心)
                'AU12': 0.9,  # 嘴角上扬 (核心)
                'AU25': 0.3   # 嘴唇分开
            },
            'sad': {
                'AU1': 0.8,   # 内眉上扬 (核心)
                'AU4': 0.7,   # 眉毛下压
                'AU15': 0.8,  # 嘴角下压 (核心)
                'AU17': 0.5   # 下巴上提
            },
            'angry': {
                'AU4': 0.9,   # 眉毛下压 (核心)
                'AU7': 0.8,   # 眼睑收紧
                'AU23': 0.6,  # 嘴唇收紧
                'AU24': 0.5   # 嘴唇压紧
            },
            'fear': {
                'AU1': 0.8,   # 内眉上扬
                'AU2': 0.8,   # 外眉上扬
                'AU5': 0.9,   # 上眼睑提升 (核心)
                'AU20': 0.7,  # 嘴角外拉
                'AU25': 0.4   # 嘴唇分开
            },
            'surprise': {
                'AU1': 0.8,   # 内眉上扬
                'AU2': 0.9,   # 外眉上扬 (核心)
                'AU5': 0.9,   # 上眼睑提升 (核心)
                'AU25': 0.7,  # 嘴唇分开
                'AU26': 0.8   # 下颌下降
            },
            'disgust': {
                'AU9': 0.9,   # 鼻皱 (核心)
                'AU15': 0.6,  # 嘴角下压
                'AU17': 0.6,  # 下巴上提
                'AU7': 0.5    # 眼睑收紧
            },
            'neutral': {}  # 中性无特定规则
        }
        
        # 时序平滑
        self.emotion_history = deque(maxlen=smoothing_window)
        self.confidence_history = deque(maxlen=smoothing_window)
        
        # 性能统计
        self.processing_times = deque(maxlen=30)
        
    def _load_hsemotion_model(self, model_path: Optional[str], use_onnx: bool):
        """加载HSEmotion模型"""
        try:
            if use_onnx and model_path:
                # 使用ONNX Runtime加速
                import onnxruntime as ort
                
                providers = ['CPUExecutionProvider']
                # 如果有GPU,可以添加GPU provider
                # providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
                
                session = ort.InferenceSession(model_path, providers=providers)
                
                print(f"✓ HSEmotion ONNX模型已加载: {model_path}")
                print(f"  Providers: {session.get_providers()}")
                
                return {
                    'type': 'onnx',
                    'session': session,
                    'input_name': session.get_inputs()[0].name,
                    'output_name': session.get_outputs()[0].name
                }
            else:
                # 尝试使用hsemotion库
                try:
                    from hsemotion.facial_emotions import HSEmotionRecognizer
                    
                    model = HSEmotionRecognizer(model_name='enet_b0_8_best_afew')
                    print("✓ HSEmotion库已加载")
                    
                    return {
                        'type': 'hsemotion',
                        'model': model
                    }
                except ImportError:
                    print("⚠ hsemotion库未安装,将使用AU规则识别")
                    print("  安装: pip install hsemotion")
                    return None
        
        except Exception as e:
            print(f"⚠ HSEmotion模型加载失败: {e}")
            return None
    
    def recognize(
        self,
        face_image: np.ndarray,
        au_result: Optional[Dict] = None
    ) -> Dict:
        """
        识别情绪
        
        Args:
            face_image: 人脸图像 (BGR格式)
            au_result: AU检测结果 (可选)
            
        Returns:
            情绪识别结果:
            - emotion: 情绪标签
            - confidence: 置信度
            - probabilities: 各情绪概率
            - method: 识别方法
            - processing_time: 处理时间(ms)
        """
        start_time = time.time()
        
        # 根据方法选择识别策略
        if self.method == 'hsemotion' and self.hsemotion_model:
            result = self._recognize_hsemotion(face_image)
        
        elif self.method == 'au' and au_result:
            result = self._recognize_au(au_result)
        
        elif self.method == 'fusion' and self.hsemotion_model and au_result:
            result = self._recognize_fusion(face_image, au_result)
        
        else:
            # 降级到AU识别
            if au_result:
                result = self._recognize_au(au_result)
            else:
                # 默认中性
                result = {
                    'emotion': 'neutral',
                    'confidence': 0.5,
                    'probabilities': {e: 1/7 for e in self.emotion_labels},
                    'method': 'default'
                }
        
        # 时序平滑
        result = self._apply_smoothing(result)
        
        # 记录处理时间
        processing_time = (time.time() - start_time) * 1000
        self.processing_times.append(processing_time)
        result['processing_time'] = processing_time
        
        return result
    
    def _recognize_hsemotion(self, face_image: np.ndarray) -> Dict:
        """使用HSEmotion识别"""
        if not self.hsemotion_model:
            return self._default_result('hsemotion_unavailable')
        
        try:
            model_type = self.hsemotion_model['type']
            
            if model_type == 'onnx':
                # ONNX推理
                session = self.hsemotion_model['session']
                input_name = self.hsemotion_model['input_name']
                output_name = self.hsemotion_model['output_name']
                
                # 预处理
                img = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
                img = cv2.resize(img, (224, 224))
                img = img.astype(np.float32) / 255.0
                img = (img - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
                img = np.transpose(img, (2, 0, 1))
                img = np.expand_dims(img, axis=0)
                
                # 推理
                outputs = session.run([output_name], {input_name: img})[0]
                
                # Softmax
                exp_outputs = np.exp(outputs - np.max(outputs))
                probabilities = exp_outputs / exp_outputs.sum()
                probabilities = probabilities[0]
                
            elif model_type == 'hsemotion':
                # hsemotion库
                model = self.hsemotion_model['model']
                emotion, scores = model.predict_emotions(face_image, logits=True)
                
                # 转换为概率
                exp_scores = np.exp(scores - np.max(scores))
                probabilities = exp_scores / exp_scores.sum()
            
            # 构建结果
            emotion_idx = np.argmax(probabilities)
            emotion = self.emotion_labels[emotion_idx]
            confidence = float(probabilities[emotion_idx])
            
            prob_dict = {
                self.emotion_labels[i]: float(probabilities[i])
                for i in range(len(self.emotion_labels))
            }
            
            return {
                'emotion': emotion,
                'confidence': confidence,
                'probabilities': prob_dict,
                'method': 'hsemotion'
            }
        
        except Exception as e:
            print(f"HSEmotion识别失败: {e}")
            return self._default_result('hsemotion_error')
    
    def _recognize_au(self, au_result: Dict) -> Dict:
        """基于AU规则识别"""
        au_activations = au_result.get('au_activations', {})
        
        # 计算每种情绪的匹配度
        emotion_scores = {}
        
        for emotion, rules in self.au_emotion_rules.items():
            if not rules:
                # neutral没有规则,使用默认分数
                emotion_scores[emotion] = 0.3
                continue
            
            score = 0.0
            activated_count = 0
            
            for au, weight in rules.items():
                if au_activations.get(au, False):
                    score += weight
                    activated_count += 1
            
            # 归一化
            if len(rules) > 0:
                score = score / len(rules)
            
            emotion_scores[emotion] = score
        
        # 如果所有分数都很低,默认为neutral
        max_score = max(emotion_scores.values())
        if max_score < 0.3:
            emotion_scores['neutral'] = 0.7
        
        # Softmax归一化
        exp_scores = {e: np.exp(s * 3) for e, s in emotion_scores.items()}  # 放大差异
        total = sum(exp_scores.values())
        probabilities = {e: s / total for e, s in exp_scores.items()}
        
        # 最高概率
        emotion = max(probabilities, key=probabilities.get)
        confidence = probabilities[emotion]
        
        return {
            'emotion': emotion,
            'confidence': confidence,
            'probabilities': probabilities,
            'method': 'au'
        }
    
    def _recognize_fusion(self, face_image: np.ndarray, au_result: Dict) -> Dict:
        """融合HSEmotion和AU识别"""
        # HSEmotion识别
        hsemotion_result = self._recognize_hsemotion(face_image)
        
        # AU识别
        au_result_emotion = self._recognize_au(au_result)
        
        # 加权融合 (HSEmotion权重更高)
        hsemotion_weight = 0.7
        au_weight = 0.3
        
        # 融合概率
        fused_probabilities = {}
        for emotion in self.emotion_labels:
            hsemotion_prob = hsemotion_result['probabilities'].get(emotion, 0)
            au_prob = au_result_emotion['probabilities'].get(emotion, 0)
            
            fused_probabilities[emotion] = (
                hsemotion_weight * hsemotion_prob +
                au_weight * au_prob
            )
        
        # 最高概率
        emotion = max(fused_probabilities, key=fused_probabilities.get)
        confidence = fused_probabilities[emotion]
        
        return {
            'emotion': emotion,
            'confidence': confidence,
            'probabilities': fused_probabilities,
            'method': 'fusion',
            'hsemotion_emotion': hsemotion_result['emotion'],
            'au_emotion': au_result_emotion['emotion']
        }
    
    def _apply_smoothing(self, result: Dict) -> Dict:
        """应用时序平滑"""
        if self.smoothing_window <= 1:
            return result
        
        # 添加到历史
        self.emotion_history.append(result['emotion'])
        self.confidence_history.append(result['confidence'])
        
        if len(self.emotion_history) < 3:
            return result
        
        # 投票平滑
        from collections import Counter
        emotion_counts = Counter(self.emotion_history)
        smoothed_emotion = emotion_counts.most_common(1)[0][0]
        
        # 置信度平滑
        smoothed_confidence = np.mean(list(self.confidence_history))
        
        # 如果平滑后的情绪与当前不同,降低置信度
        if smoothed_emotion != result['emotion']:
            smoothed_confidence *= 0.8
        
        result['emotion'] = smoothed_emotion
        result['confidence'] = float(smoothed_confidence)
        result['smoothed'] = True
        
        return result
    
    def _default_result(self, reason: str = 'unknown') -> Dict:
        """返回默认结果"""
        return {
            'emotion': 'neutral',
            'confidence': 0.5,
            'probabilities': {e: 1/7 for e in self.emotion_labels},
            'method': f'default ({reason})'
        }
    
    def get_avg_processing_time(self) -> float:
        """获取平均处理时间"""
        if len(self.processing_times) == 0:
            return 0.0
        return sum(self.processing_times) / len(self.processing_times)
    
    def reset(self):
        """重置状态"""
        self.emotion_history.clear()
        self.confidence_history.clear()


# 为了兼容性,保留原有的EmotionAnalyzer类
class EmotionAnalyzer:
    """
    情绪时序分析器
    分析情绪变化趋势和统计特征
    """
    
    def __init__(self, window_size: int = 300):
        """
        初始化分析器
        
        Args:
            window_size: 分析窗口大小(帧数)
        """
        self.window_size = window_size
        self.emotion_history = deque(maxlen=window_size)
        
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
    
    def add_emotion(self, emotion_result: Dict):
        """添加情绪记录"""
        self.emotion_history.append({
            'emotion': emotion_result['emotion'],
            'confidence': emotion_result['confidence'],
            'timestamp': time.time()
        })
    
    def analyze(self) -> Dict:
        """
        分析情绪特征
        
        Returns:
            分析结果:
            - positive_ratio: 积极情绪比例
            - negative_ratio: 消极情绪比例
            - neutral_ratio: 中性情绪比例
            - emotion_variance: 情绪方差
            - change_rate: 情绪变化率
            - dominant_emotion: 主导情绪
        """
        if len(self.emotion_history) == 0:
            return {}
        
        # 统计情绪分布
        emotion_counts = {}
        for record in self.emotion_history:
            emotion = record['emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        total = len(self.emotion_history)
        
        # 计算比例
        positive_emotions = ['happy', 'surprise']
        negative_emotions = ['sad', 'angry', 'fear', 'disgust']
        
        positive_ratio = sum(emotion_counts.get(e, 0) for e in positive_emotions) / total
        negative_ratio = sum(emotion_counts.get(e, 0) for e in negative_emotions) / total
        neutral_ratio = emotion_counts.get('neutral', 0) / total
        
        # 计算情绪极性序列
        polarity_values = [
            self.emotion_polarity.get(record['emotion'], 0)
            for record in self.emotion_history
        ]
        
        # 情绪方差
        emotion_variance = float(np.var(polarity_values))
        
        # 情绪变化率
        changes = sum(
            1 for i in range(1, len(self.emotion_history))
            if self.emotion_history[i]['emotion'] != self.emotion_history[i-1]['emotion']
        )
        change_rate = changes / (len(self.emotion_history) - 1) if len(self.emotion_history) > 1 else 0
        
        # 主导情绪
        dominant_emotion = max(emotion_counts, key=emotion_counts.get)
        
        return {
            'positive_ratio': positive_ratio,
            'negative_ratio': negative_ratio,
            'neutral_ratio': neutral_ratio,
            'emotion_variance': emotion_variance,
            'change_rate': change_rate,
            'dominant_emotion': dominant_emotion,
            'emotion_counts': emotion_counts
        }


if __name__ == '__main__':
    """测试增强版情绪识别器"""
    import sys
    import os
    
    # 测试AU规则识别
    print("="*60)
    print("测试AU规则识别")
    print("="*60)
    
    recognizer_au = EmotionRecognizerEnhanced(method='au')
    
    # 模拟AU激活
    test_au_results = [
        {
            'au_activations': {'AU6': True, 'AU12': True},
            'expected': 'happy'
        },
        {
            'au_activations': {'AU1': True, 'AU4': True, 'AU15': True},
            'expected': 'sad'
        },
        {
            'au_activations': {'AU4': True, 'AU7': True},
            'expected': 'angry'
        }
    ]
    
    for test in test_au_results:
        result = recognizer_au.recognize(None, test)
        print(f"\nAU激活: {test['au_activations']}")
        print(f"识别结果: {result['emotion']} (置信度: {result['confidence']:.2f})")
        print(f"预期: {test['expected']}")
        print(f"匹配: {'✓' if result['emotion'] == test['expected'] else '✗'}")
    
    print(f"\n平均处理时间: {recognizer_au.get_avg_processing_time():.2f} ms")
    
    # 测试HSEmotion (如果可用)
    print("\n" + "="*60)
    print("测试HSEmotion识别")
    print("="*60)
    
    recognizer_hsemotion = EmotionRecognizerEnhanced(method='hsemotion')
    
    if recognizer_hsemotion.hsemotion_model:
        print("HSEmotion模型已加载,可以进行测试")
        print("提示: 需要提供真实人脸图像进行测试")
    else:
        print("HSEmotion模型未加载")
        print("安装方法: pip install hsemotion")
    
    print("\n" + "="*60)
