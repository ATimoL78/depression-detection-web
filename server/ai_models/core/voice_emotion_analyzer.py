"""
语音情感分析模块
集成语音识别和情感分析,用于抑郁症检测
"""

import numpy as np
import pyaudio
import wave
import threading
import queue
import time
from collections import deque
from typing import Dict, Optional, List, Tuple
import os
import tempfile


class VoiceEmotionAnalyzer:
    """
    语音情感分析器
    
    功能:
    1. 实时语音录制
    2. 语音转文本
    3. 语音情感特征提取
    4. 抑郁相关语音特征分析
    
    抑郁相关语音特征:
    - 语速变慢
    - 音调降低
    - 音量减小
    - 停顿增多
    - 语气平淡
    """
    
    def __init__(
        self,
        sample_rate: int = 16000,
        chunk_size: int = 1024,
        channels: int = 1,
        record_seconds: int = 5
    ):
        """
        初始化语音情感分析器
        
        Args:
            sample_rate: 采样率
            chunk_size: 音频块大小
            channels: 声道数
            record_seconds: 录音时长
        """
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.channels = channels
        self.record_seconds = record_seconds
        
        # PyAudio实例
        self.audio = pyaudio.PyAudio()
        
        # 录音控制
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.record_thread = None
        
        # 语音特征历史
        self.pitch_history = deque(maxlen=100)
        self.energy_history = deque(maxlen=100)
        self.speech_rate_history = deque(maxlen=100)
        self.pause_ratio_history = deque(maxlen=100)
        
        # 情感标签
        self.emotion_labels = ['neutral', 'happy', 'sad', 'angry', 'anxious']
        
        print("✓ 语音情感分析器已初始化")
    
    def start_recording(self):
        """开始录音"""
        if self.is_recording:
            return
        
        self.is_recording = True
        self.record_thread = threading.Thread(target=self._record_audio, daemon=True)
        self.record_thread.start()
        print("✓ 开始录音")
    
    def stop_recording(self):
        """停止录音"""
        self.is_recording = False
        if self.record_thread:
            self.record_thread.join(timeout=2)
        print("✓ 停止录音")
    
    def _record_audio(self):
        """录音线程"""
        try:
            stream = self.audio.open(
                format=pyaudio.paInt16,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.chunk_size
            )
            
            while self.is_recording:
                try:
                    data = stream.read(self.chunk_size, exception_on_overflow=False)
                    self.audio_queue.put(data)
                except Exception as e:
                    print(f"录音错误: {e}")
                    break
            
            stream.stop_stream()
            stream.close()
        
        except Exception as e:
            print(f"无法打开音频设备: {e}")
            self.is_recording = False
    
    def analyze_audio_chunk(self, audio_data: bytes) -> Dict:
        """
        分析音频块
        
        Args:
            audio_data: 音频数据
            
        Returns:
            语音特征字典
        """
        # 转换为numpy数组
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        
        # 提取特征
        features = {}
        
        # 1. 能量 (音量)
        energy = np.sqrt(np.mean(audio_array ** 2))
        features['energy'] = float(energy)
        self.energy_history.append(energy)
        
        # 2. 过零率 (语音活动检测)
        zero_crossings = np.sum(np.abs(np.diff(np.sign(audio_array)))) / 2
        features['zero_crossing_rate'] = float(zero_crossings / len(audio_array))
        
        # 3. 基频估计 (音调)
        pitch = self._estimate_pitch(audio_array)
        features['pitch'] = pitch
        if pitch > 0:
            self.pitch_history.append(pitch)
        
        # 4. 语音活动检测
        is_speech = energy > 500  # 简单阈值
        features['is_speech'] = is_speech
        
        return features
    
    def _estimate_pitch(self, audio_array: np.ndarray) -> float:
        """
        估计基频(音调)
        使用自相关方法
        """
        # 归一化
        audio_array = audio_array / (np.max(np.abs(audio_array)) + 1e-6)
        
        # 自相关
        corr = np.correlate(audio_array, audio_array, mode='full')
        corr = corr[len(corr)//2:]
        
        # 寻找第一个峰值
        min_period = int(self.sample_rate / 500)  # 最高500Hz
        max_period = int(self.sample_rate / 50)   # 最低50Hz
        
        if len(corr) < max_period:
            return 0.0
        
        # 在有效范围内寻找最大值
        peak_idx = np.argmax(corr[min_period:max_period]) + min_period
        
        if peak_idx > 0:
            pitch = self.sample_rate / peak_idx
            return float(pitch)
        
        return 0.0
    
    def get_depression_indicators(self) -> Dict:
        """
        获取抑郁相关语音指标
        
        Returns:
            抑郁指标字典
        """
        indicators = {
            'low_pitch': 0.0,      # 音调降低
            'low_energy': 0.0,     # 音量减小
            'slow_speech': 0.0,    # 语速变慢
            'high_pause': 0.0,     # 停顿增多
            'overall_score': 0.0   # 综合评分
        }
        
        # 需要足够的历史数据
        if len(self.pitch_history) < 10 or len(self.energy_history) < 10:
            return indicators
        
        # 1. 音调分析
        avg_pitch = np.mean(self.pitch_history)
        # 正常语音基频: 男性85-180Hz, 女性165-255Hz
        # 抑郁时音调降低
        if avg_pitch < 150:  # 偏低
            indicators['low_pitch'] = min(1.0, (150 - avg_pitch) / 50)
        
        # 2. 能量分析
        avg_energy = np.mean(self.energy_history)
        # 抑郁时音量减小
        if avg_energy < 1000:  # 偏低
            indicators['low_energy'] = min(1.0, (1000 - avg_energy) / 1000)
        
        # 3. 语速分析 (需要更多数据)
        if len(self.speech_rate_history) > 0:
            avg_rate = np.mean(self.speech_rate_history)
            # 正常语速: 150-200词/分钟
            # 抑郁时语速变慢
            if avg_rate < 150:
                indicators['slow_speech'] = min(1.0, (150 - avg_rate) / 50)
        
        # 4. 停顿分析
        if len(self.pause_ratio_history) > 0:
            avg_pause = np.mean(self.pause_ratio_history)
            # 抑郁时停顿增多
            if avg_pause > 0.3:
                indicators['high_pause'] = min(1.0, (avg_pause - 0.3) / 0.3)
        
        # 综合评分
        indicators['overall_score'] = np.mean([
            indicators['low_pitch'],
            indicators['low_energy'],
            indicators['slow_speech'],
            indicators['high_pause']
        ])
        
        return indicators
    
    def transcribe_audio(self, audio_file: str) -> str:
        """
        语音转文本
        使用manus-speech-to-text工具
        
        Args:
            audio_file: 音频文件路径
            
        Returns:
            转录文本
        """
        try:
            import subprocess
            result = subprocess.run(
                ['manus-speech-to-text', audio_file],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                print(f"转录失败: {result.stderr}")
                return ""
        
        except Exception as e:
            print(f"转录错误: {e}")
            return ""
    
    def analyze_text_sentiment(self, text: str) -> Dict:
        """
        分析文本情感
        检测抑郁相关语言特征
        
        Args:
            text: 文本内容
            
        Returns:
            情感分析结果
        """
        # 抑郁相关关键词
        depression_keywords = {
            'negative': ['累', '疲惫', '无聊', '无趣', '没意思', '没劲', '烦', '难受'],
            'hopeless': ['没希望', '没用', '算了', '放弃', '无所谓', '不想'],
            'isolation': ['孤独', '一个人', '没人', '不想说', '不想见'],
            'sleep': ['失眠', '睡不着', '睡不好', '做梦', '早醒'],
            'appetite': ['不想吃', '没胃口', '吃不下'],
        }
        
        # 统计关键词
        keyword_counts = {category: 0 for category in depression_keywords}
        
        for category, keywords in depression_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    keyword_counts[category] += 1
        
        # 计算抑郁评分
        total_keywords = sum(keyword_counts.values())
        depression_score = min(1.0, total_keywords / 5)  # 归一化到0-1
        
        return {
            'text': text,
            'keyword_counts': keyword_counts,
            'total_keywords': total_keywords,
            'depression_score': depression_score,
            'sentiment': 'depressed' if depression_score > 0.5 else 'neutral'
        }
    
    def save_audio_buffer(self, duration: int = 5) -> Optional[str]:
        """
        保存音频缓冲区到文件
        
        Args:
            duration: 录音时长(秒)
            
        Returns:
            音频文件路径
        """
        if not self.is_recording:
            return None
        
        frames = []
        num_chunks = int(self.sample_rate / self.chunk_size * duration)
        
        for _ in range(num_chunks):
            try:
                data = self.audio_queue.get(timeout=1)
                frames.append(data)
            except queue.Empty:
                break
        
        if not frames:
            return None
        
        # 保存到临时文件
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_path = temp_file.name
        temp_file.close()
        
        try:
            wf = wave.open(temp_path, 'wb')
            wf.setnchannels(self.channels)
            wf.setsampwidth(self.audio.get_sample_size(pyaudio.paInt16))
            wf.setframerate(self.sample_rate)
            wf.writeframes(b''.join(frames))
            wf.close()
            
            return temp_path
        
        except Exception as e:
            print(f"保存音频失败: {e}")
            return None
    
    def get_realtime_features(self) -> Optional[Dict]:
        """
        获取实时语音特征
        
        Returns:
            语音特征字典
        """
        if self.audio_queue.empty():
            return None
        
        try:
            # 获取最新的音频块
            audio_data = self.audio_queue.get_nowait()
            features = self.analyze_audio_chunk(audio_data)
            return features
        
        except queue.Empty:
            return None
    
    def cleanup(self):
        """清理资源"""
        self.stop_recording()
        self.audio.terminate()
        print("✓ 语音分析器已清理")


class VoiceDepressionAssessor:
    """
    基于语音的抑郁评估器
    综合语音特征和文本内容
    """
    
    def __init__(self):
        """初始化评估器"""
        self.voice_analyzer = VoiceEmotionAnalyzer()
        
        # 评估历史
        self.assessment_history = deque(maxlen=50)
        
    def start(self):
        """开始评估"""
        self.voice_analyzer.start_recording()
    
    def stop(self):
        """停止评估"""
        self.voice_analyzer.stop_recording()
    
    def assess(self, duration: int = 5) -> Dict:
        """
        执行一次评估
        
        Args:
            duration: 评估时长(秒)
            
        Returns:
            评估结果
        """
        # 1. 保存音频
        audio_file = self.voice_analyzer.save_audio_buffer(duration)
        
        if not audio_file:
            return {
                'success': False,
                'message': '未检测到语音'
            }
        
        # 2. 语音转文本
        text = self.voice_analyzer.transcribe_audio(audio_file)
        
        # 3. 文本情感分析
        text_sentiment = self.voice_analyzer.analyze_text_sentiment(text)
        
        # 4. 语音特征分析
        voice_indicators = self.voice_analyzer.get_depression_indicators()
        
        # 5. 综合评分
        # 语音特征权重: 60%, 文本内容权重: 40%
        overall_score = (
            voice_indicators['overall_score'] * 0.6 +
            text_sentiment['depression_score'] * 0.4
        )
        
        result = {
            'success': True,
            'timestamp': time.time(),
            'audio_file': audio_file,
            'text': text,
            'text_sentiment': text_sentiment,
            'voice_indicators': voice_indicators,
            'overall_score': overall_score,
            'risk_level': self._get_risk_level(overall_score)
        }
        
        # 记录历史
        self.assessment_history.append(result)
        
        # 清理临时文件
        try:
            os.remove(audio_file)
        except:
            pass
        
        return result
    
    def _get_risk_level(self, score: float) -> str:
        """获取风险等级"""
        if score < 0.3:
            return 'low'
        elif score < 0.6:
            return 'medium'
        else:
            return 'high'
    
    def get_trend_analysis(self) -> Dict:
        """
        获取趋势分析
        
        Returns:
            趋势分析结果
        """
        if len(self.assessment_history) < 3:
            return {
                'available': False,
                'message': '数据不足'
            }
        
        # 提取评分
        scores = [a['overall_score'] for a in self.assessment_history]
        
        # 计算趋势
        recent_avg = np.mean(scores[-5:])
        overall_avg = np.mean(scores)
        trend = 'increasing' if recent_avg > overall_avg else 'decreasing'
        
        return {
            'available': True,
            'recent_avg': recent_avg,
            'overall_avg': overall_avg,
            'trend': trend,
            'assessment_count': len(self.assessment_history)
        }
    
    def cleanup(self):
        """清理资源"""
        self.voice_analyzer.cleanup()
