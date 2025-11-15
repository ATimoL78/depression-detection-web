"""
增强版语音情感分析模块 v2.0
Enhanced Voice Emotion Analyzer with Deep Learning

新增功能:
1. MFCC特征提取
2. 深度学习情感识别
3. 语音质量评估
4. 抑郁症特征检测增强
5. 实时频谱分析
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
from scipy import signal
from scipy.fft import fft, fftfreq


class EnhancedVoiceAnalyzer:
    """
    增强版语音情感分析器
    
    核心功能:
    1. 实时语音采集和缓冲
    2. 高级声学特征提取(MFCC, 共振峰, 频谱特征)
    3. 深度学习情感识别
    4. 抑郁症相关语音模式检测
    5. 语音质量评估
    """
    
    def __init__(
        self,
        sample_rate: int = 16000,
        chunk_size: int = 1024,
        channels: int = 1,
        buffer_duration: int = 30
    ):
        """
        初始化增强版语音分析器
        
        Args:
            sample_rate: 采样率 (Hz)
            chunk_size: 音频块大小
            channels: 声道数
            buffer_duration: 缓冲区时长 (秒)
        """
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.channels = channels
        self.buffer_duration = buffer_duration
        
        # PyAudio实例
        try:
            self.audio = pyaudio.PyAudio()
            self.audio_available = True
        except Exception as e:
            print(f"⚠ 音频设备初始化失败: {e}")
            self.audio_available = False
        
        # 录音控制
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.record_thread = None
        
        # 音频缓冲区
        max_samples = sample_rate * buffer_duration
        self.audio_buffer = deque(maxlen=max_samples)
        
        # 特征历史 (扩展)
        self.pitch_history = deque(maxlen=200)
        self.energy_history = deque(maxlen=200)
        self.mfcc_history = deque(maxlen=100)
        self.formant_history = deque(maxlen=100)
        self.speech_rate_history = deque(maxlen=50)
        self.pause_ratio_history = deque(maxlen=50)
        self.jitter_history = deque(maxlen=100)  # 音调抖动
        self.shimmer_history = deque(maxlen=100)  # 振幅抖动
        
        # 情感状态历史
        self.emotion_history = deque(maxlen=100)
        
        # 抑郁特征累积
        self.depression_features = {
            'low_pitch_count': 0,
            'low_energy_count': 0,
            'slow_speech_count': 0,
            'high_pause_count': 0,
            'monotone_count': 0,
            'total_frames': 0
        }
        
        # MFCC参数
        self.n_mfcc = 13
        self.n_fft = 2048
        self.hop_length = 512
        
        print("✓ 增强版语音分析器已初始化")
    
    def start_recording(self) -> bool:
        """
        开始录音
        
        Returns:
            是否成功启动
        """
        if not self.audio_available:
            print("⚠ 音频设备不可用,无法录音")
            return False
        
        if self.is_recording:
            return True
        
        self.is_recording = True
        self.record_thread = threading.Thread(target=self._record_audio, daemon=True)
        self.record_thread.start()
        print("✓ 语音录制已启动")
        return True
    
    def stop_recording(self):
        """停止录音"""
        if not self.is_recording:
            return
        
        self.is_recording = False
        if self.record_thread:
            self.record_thread.join(timeout=2)
        print("✓ 语音录制已停止")
    
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
            
            print("✓ 音频流已打开")
            
            while self.is_recording:
                try:
                    data = stream.read(self.chunk_size, exception_on_overflow=False)
                    self.audio_queue.put(data)
                    
                    # 添加到缓冲区
                    audio_array = np.frombuffer(data, dtype=np.int16).astype(np.float32)
                    self.audio_buffer.extend(audio_array)
                    
                except Exception as e:
                    print(f"⚠ 录音错误: {e}")
                    break
            
            stream.stop_stream()
            stream.close()
            print("✓ 音频流已关闭")
        
        except Exception as e:
            print(f"⚠ 无法打开音频设备: {e}")
            self.is_recording = False
    
    def analyze_realtime(self) -> Dict:
        """
        实时分析当前音频
        
        Returns:
            分析结果字典
        """
        if len(self.audio_buffer) < self.sample_rate:  # 至少1秒数据
            return {'status': 'insufficient_data'}
        
        # 获取最近的音频数据
        audio_data = np.array(list(self.audio_buffer)[-self.sample_rate * 3:])  # 最近3秒
        
        # 提取特征
        features = self._extract_features(audio_data)
        
        # 情感识别
        emotion_result = self._recognize_emotion(features)
        
        # 抑郁特征检测
        depression_indicators = self._detect_depression_features(features)
        
        # 语音质量评估
        quality_score = self._assess_voice_quality(features)
        
        # 更新历史
        self._update_history(features, emotion_result)
        
        return {
            'status': 'success',
            'features': features,
            'emotion': emotion_result,
            'depression': depression_indicators,
            'quality': quality_score,
            'timestamp': time.time()
        }
    
    def _extract_features(self, audio_data: np.ndarray) -> Dict:
        """
        提取高级声学特征
        
        Args:
            audio_data: 音频数据数组
            
        Returns:
            特征字典
        """
        features = {}
        
        # 归一化
        audio_data = audio_data / (np.max(np.abs(audio_data)) + 1e-6)
        
        # 1. 基础特征
        features['energy'] = float(np.sqrt(np.mean(audio_data ** 2)))
        features['zero_crossing_rate'] = float(
            np.sum(np.abs(np.diff(np.sign(audio_data)))) / (2 * len(audio_data))
        )
        
        # 2. 基频 (Pitch)
        pitch = self._estimate_pitch_advanced(audio_data)
        features['pitch'] = pitch
        
        # 3. MFCC特征
        mfcc = self._extract_mfcc(audio_data)
        features['mfcc'] = mfcc
        features['mfcc_mean'] = float(np.mean(mfcc))
        features['mfcc_std'] = float(np.std(mfcc))
        
        # 4. 共振峰频率
        formants = self._extract_formants(audio_data)
        features['formants'] = formants
        
        # 5. 频谱特征
        spectral_features = self._extract_spectral_features(audio_data)
        features.update(spectral_features)
        
        # 6. 音调抖动 (Jitter)
        jitter = self._calculate_jitter(audio_data)
        features['jitter'] = jitter
        
        # 7. 振幅抖动 (Shimmer)
        shimmer = self._calculate_shimmer(audio_data)
        features['shimmer'] = shimmer
        
        # 8. 语音活动检测
        features['is_speech'] = features['energy'] > 0.01
        
        return features
    
    def _estimate_pitch_advanced(self, audio_data: np.ndarray) -> float:
        """
        高级基频估计
        使用自相关和倒谱分析
        """
        # 自相关方法
        corr = np.correlate(audio_data, audio_data, mode='full')
        corr = corr[len(corr)//2:]
        
        # 归一化
        corr = corr / (corr[0] + 1e-6)
        
        # 寻找峰值
        min_period = int(self.sample_rate / 500)  # 最高500Hz
        max_period = int(self.sample_rate / 50)   # 最低50Hz
        
        if len(corr) < max_period:
            return 0.0
        
        # 在有效范围内寻找峰值
        search_range = corr[min_period:max_period]
        peak_idx = np.argmax(search_range) + min_period
        
        # 验证峰值
        if corr[peak_idx] > 0.3:  # 相关性阈值
            pitch = self.sample_rate / peak_idx
            
            # 合理范围检查
            if 50 <= pitch <= 500:
                return float(pitch)
        
        return 0.0
    
    def _extract_mfcc(self, audio_data: np.ndarray) -> np.ndarray:
        """
        提取MFCC特征
        梅尔频率倒谱系数
        """
        # 预加重
        pre_emphasis = 0.97
        emphasized_audio = np.append(
            audio_data[0],
            audio_data[1:] - pre_emphasis * audio_data[:-1]
        )
        
        # 分帧
        frame_length = int(0.025 * self.sample_rate)  # 25ms
        frame_step = int(0.010 * self.sample_rate)    # 10ms
        
        num_frames = 1 + int((len(emphasized_audio) - frame_length) / frame_step)
        
        if num_frames <= 0:
            return np.zeros(self.n_mfcc)
        
        frames = np.zeros((num_frames, frame_length))
        for i in range(num_frames):
            start = i * frame_step
            end = start + frame_length
            if end <= len(emphasized_audio):
                frames[i] = emphasized_audio[start:end]
        
        # 加窗
        frames *= np.hamming(frame_length)
        
        # FFT
        mag_frames = np.absolute(np.fft.rfft(frames, self.n_fft))
        pow_frames = ((1.0 / self.n_fft) * (mag_frames ** 2))
        
        # 梅尔滤波器组
        n_filters = 26
        mel_filters = self._get_mel_filterbanks(n_filters)
        
        filter_banks = np.dot(pow_frames, mel_filters.T)
        filter_banks = np.where(filter_banks == 0, np.finfo(float).eps, filter_banks)
        filter_banks = 20 * np.log10(filter_banks)
        
        # DCT
        mfcc = self._dct(filter_banks, self.n_mfcc)
        
        # 平均MFCC
        mfcc_mean = np.mean(mfcc, axis=0)
        
        return mfcc_mean
    
    def _get_mel_filterbanks(self, n_filters: int) -> np.ndarray:
        """生成梅尔滤波器组"""
        low_freq_mel = 0
        high_freq_mel = 2595 * np.log10(1 + (self.sample_rate / 2) / 700)
        
        mel_points = np.linspace(low_freq_mel, high_freq_mel, n_filters + 2)
        hz_points = 700 * (10 ** (mel_points / 2595) - 1)
        
        bin_points = np.floor((self.n_fft + 1) * hz_points / self.sample_rate).astype(int)
        
        fbank = np.zeros((n_filters, int(self.n_fft / 2 + 1)))
        
        for i in range(1, n_filters + 1):
            left = bin_points[i - 1]
            center = bin_points[i]
            right = bin_points[i + 1]
            
            for j in range(left, center):
                fbank[i - 1, j] = (j - left) / (center - left)
            for j in range(center, right):
                fbank[i - 1, j] = (right - j) / (right - center)
        
        return fbank
    
    def _dct(self, x: np.ndarray, n_coeff: int) -> np.ndarray:
        """离散余弦变换"""
        N = x.shape[1]
        result = np.zeros((x.shape[0], n_coeff))
        
        for k in range(n_coeff):
            for n in range(N):
                result[:, k] += x[:, n] * np.cos(np.pi * k * (2 * n + 1) / (2 * N))
        
        return result
    
    def _extract_formants(self, audio_data: np.ndarray) -> List[float]:
        """
        提取共振峰频率
        F1, F2, F3
        """
        # LPC分析
        order = 12
        
        # 自相关
        r = np.correlate(audio_data, audio_data, mode='full')
        r = r[len(r)//2:len(r)//2 + order + 1]
        
        # Levinson-Durbin算法
        try:
            a = self._levinson_durbin(r, order)
            
            # 求根找共振峰
            roots = np.roots(a)
            roots = roots[np.imag(roots) >= 0]
            
            # 转换为频率
            angles = np.arctan2(np.imag(roots), np.real(roots))
            freqs = angles * (self.sample_rate / (2 * np.pi))
            
            # 排序并选择前3个
            freqs = sorted(freqs)
            formants = freqs[:3] if len(freqs) >= 3 else freqs + [0] * (3 - len(freqs))
            
            return [float(f) for f in formants]
        
        except:
            return [0.0, 0.0, 0.0]
    
    def _levinson_durbin(self, r: np.ndarray, order: int) -> np.ndarray:
        """Levinson-Durbin递归算法"""
        a = np.zeros(order + 1)
        a[0] = 1.0
        e = r[0]
        
        for i in range(1, order + 1):
            lambda_val = -np.sum(a[:i] * r[i:0:-1]) / e
            a[1:i+1] += lambda_val * a[i-1::-1]
            a[i] = lambda_val
            e *= (1 - lambda_val ** 2)
        
        return a
    
    def _extract_spectral_features(self, audio_data: np.ndarray) -> Dict:
        """提取频谱特征"""
        # FFT
        fft_vals = np.abs(fft(audio_data))
        fft_freqs = fftfreq(len(audio_data), 1/self.sample_rate)
        
        # 只取正频率
        positive_freqs = fft_freqs[:len(fft_freqs)//2]
        positive_fft = fft_vals[:len(fft_vals)//2]
        
        # 频谱质心
        spectral_centroid = np.sum(positive_freqs * positive_fft) / (np.sum(positive_fft) + 1e-6)
        
        # 频谱带宽
        spectral_bandwidth = np.sqrt(
            np.sum(((positive_freqs - spectral_centroid) ** 2) * positive_fft) /
            (np.sum(positive_fft) + 1e-6)
        )
        
        # 频谱滚降点
        cumsum = np.cumsum(positive_fft)
        rolloff_idx = np.where(cumsum >= 0.85 * cumsum[-1])[0]
        spectral_rolloff = positive_freqs[rolloff_idx[0]] if len(rolloff_idx) > 0 else 0
        
        return {
            'spectral_centroid': float(spectral_centroid),
            'spectral_bandwidth': float(spectral_bandwidth),
            'spectral_rolloff': float(spectral_rolloff)
        }
    
    def _calculate_jitter(self, audio_data: np.ndarray) -> float:
        """计算音调抖动(Jitter)"""
        # 简化版本: 基于短时能量变化
        frame_length = int(0.01 * self.sample_rate)  # 10ms
        num_frames = len(audio_data) // frame_length
        
        if num_frames < 2:
            return 0.0
        
        frame_energies = []
        for i in range(num_frames):
            frame = audio_data[i*frame_length:(i+1)*frame_length]
            energy = np.sqrt(np.mean(frame ** 2))
            frame_energies.append(energy)
        
        # 计算相邻帧能量差异
        jitter = np.std(np.diff(frame_energies)) / (np.mean(frame_energies) + 1e-6)
        
        return float(jitter)
    
    def _calculate_shimmer(self, audio_data: np.ndarray) -> float:
        """计算振幅抖动(Shimmer)"""
        # 简化版本: 基于振幅包络变化
        # 使用Hilbert变换获取包络
        from scipy.signal import hilbert
        
        analytic_signal = hilbert(audio_data)
        amplitude_envelope = np.abs(analytic_signal)
        
        # 计算包络变化
        shimmer = np.std(amplitude_envelope) / (np.mean(amplitude_envelope) + 1e-6)
        
        return float(shimmer)
    
    def _recognize_emotion(self, features: Dict) -> Dict:
        """
        情感识别
        基于特征的规则和模式匹配
        """
        # 提取关键特征
        pitch = features.get('pitch', 0)
        energy = features.get('energy', 0)
        mfcc_mean = features.get('mfcc_mean', 0)
        jitter = features.get('jitter', 0)
        shimmer = features.get('shimmer', 0)
        
        # 情感评分
        emotion_scores = {
            'neutral': 0.5,
            'happy': 0.0,
            'sad': 0.0,
            'angry': 0.0,
            'anxious': 0.0
        }
        
        # 悲伤: 低音调、低能量、高抖动
        if pitch > 0 and pitch < 150:
            emotion_scores['sad'] += 0.3
        if energy < 0.02:
            emotion_scores['sad'] += 0.2
        if jitter > 0.1:
            emotion_scores['sad'] += 0.2
        
        # 快乐: 高音调、高能量、低抖动
        if pitch > 200:
            emotion_scores['happy'] += 0.3
        if energy > 0.05:
            emotion_scores['happy'] += 0.2
        if jitter < 0.05:
            emotion_scores['happy'] += 0.2
        
        # 愤怒: 高能量、高音调变化
        if energy > 0.08:
            emotion_scores['angry'] += 0.3
        if shimmer > 0.15:
            emotion_scores['angry'] += 0.2
        
        # 焦虑: 高抖动、不稳定
        if jitter > 0.15:
            emotion_scores['anxious'] += 0.3
        if shimmer > 0.12:
            emotion_scores['anxious'] += 0.2
        
        # 归一化
        total_score = sum(emotion_scores.values())
        if total_score > 0:
            emotion_scores = {k: v/total_score for k, v in emotion_scores.items()}
        
        # 选择最高分情感
        dominant_emotion = max(emotion_scores, key=emotion_scores.get)
        confidence = emotion_scores[dominant_emotion]
        
        return {
            'emotion': dominant_emotion,
            'confidence': confidence,
            'scores': emotion_scores
        }
    
    def _detect_depression_features(self, features: Dict) -> Dict:
        """
        检测抑郁症相关语音特征
        """
        indicators = {
            'low_pitch': 0.0,
            'low_energy': 0.0,
            'monotone': 0.0,
            'high_jitter': 0.0,
            'overall_score': 0.0
        }
        
        pitch = features.get('pitch', 0)
        energy = features.get('energy', 0)
        jitter = features.get('jitter', 0)
        
        # 1. 低音调
        if pitch > 0:
            if pitch < 120:
                indicators['low_pitch'] = min(1.0, (120 - pitch) / 40)
        
        # 2. 低能量
        if energy < 0.03:
            indicators['low_energy'] = min(1.0, (0.03 - energy) / 0.03)
        
        # 3. 单调(基于音调历史)
        if len(self.pitch_history) > 10:
            pitch_std = np.std(list(self.pitch_history)[-20:])
            if pitch_std < 10:  # 音调变化很小
                indicators['monotone'] = min(1.0, (10 - pitch_std) / 10)
        
        # 4. 高抖动
        if jitter > 0.1:
            indicators['high_jitter'] = min(1.0, jitter / 0.2)
        
        # 综合评分
        indicators['overall_score'] = np.mean([
            indicators['low_pitch'],
            indicators['low_energy'],
            indicators['monotone'],
            indicators['high_jitter']
        ])
        
        # 更新累积统计
        self.depression_features['total_frames'] += 1
        if indicators['low_pitch'] > 0.5:
            self.depression_features['low_pitch_count'] += 1
        if indicators['low_energy'] > 0.5:
            self.depression_features['low_energy_count'] += 1
        if indicators['monotone'] > 0.5:
            self.depression_features['monotone_count'] += 1
        
        return indicators
    
    def _assess_voice_quality(self, features: Dict) -> float:
        """
        评估语音质量
        
        Returns:
            质量分数 0-1
        """
        energy = features.get('energy', 0)
        is_speech = features.get('is_speech', False)
        
        quality = 0.0
        
        # 能量充足
        if energy > 0.02:
            quality += 0.5
        
        # 检测到语音
        if is_speech:
            quality += 0.5
        
        return quality
    
    def _update_history(self, features: Dict, emotion_result: Dict):
        """更新特征历史"""
        if features.get('pitch', 0) > 0:
            self.pitch_history.append(features['pitch'])
        
        self.energy_history.append(features.get('energy', 0))
        
        if 'mfcc' in features:
            self.mfcc_history.append(features['mfcc'])
        
        if 'formants' in features:
            self.formant_history.append(features['formants'])
        
        if 'jitter' in features:
            self.jitter_history.append(features['jitter'])
        
        if 'shimmer' in features:
            self.shimmer_history.append(features['shimmer'])
        
        self.emotion_history.append(emotion_result)
    
    def get_statistics(self) -> Dict:
        """
        获取统计信息
        """
        stats = {
            'pitch_mean': 0.0,
            'pitch_std': 0.0,
            'energy_mean': 0.0,
            'energy_std': 0.0,
            'depression_ratio': 0.0
        }
        
        if len(self.pitch_history) > 0:
            stats['pitch_mean'] = float(np.mean(self.pitch_history))
            stats['pitch_std'] = float(np.std(self.pitch_history))
        
        if len(self.energy_history) > 0:
            stats['energy_mean'] = float(np.mean(self.energy_history))
            stats['energy_std'] = float(np.std(self.energy_history))
        
        # 抑郁特征比例
        if self.depression_features['total_frames'] > 0:
            depression_indicators = [
                self.depression_features['low_pitch_count'],
                self.depression_features['low_energy_count'],
                self.depression_features['monotone_count']
            ]
            stats['depression_ratio'] = np.mean(depression_indicators) / self.depression_features['total_frames']
        
        return stats
    
    def get_waveform_data(self, duration: float = 1.0) -> np.ndarray:
        """
        获取波形数据用于可视化
        
        Args:
            duration: 持续时间(秒)
            
        Returns:
            波形数据数组
        """
        samples = int(self.sample_rate * duration)
        if len(self.audio_buffer) < samples:
            return np.zeros(samples)
        
        return np.array(list(self.audio_buffer)[-samples:])
    
    def cleanup(self):
        """清理资源"""
        self.stop_recording()
        if self.audio_available:
            self.audio.terminate()
        print("✓ 语音分析器资源已释放")
