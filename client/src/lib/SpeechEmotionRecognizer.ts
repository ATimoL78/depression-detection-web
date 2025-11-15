/**
 * 语音情绪识别器 - 2025
 * 基于Web Audio API提取音频特征并识别情绪
 * 
 * 功能:
 * 1. 实时音频采集
 * 2. MFCC特征提取(简化版)
 * 3. 音高(Pitch)检测
 * 4. 能量(Energy)检测
 * 5. 语速(Speech Rate)检测
 * 6. 情绪分类(基于规则)
 */

export interface AudioFeatures {
  pitch: number;           // 音高(Hz)
  energy: number;          // 能量(0-1)
  speechRate: number;      // 语速(words per minute)
  zeroCrossingRate: number; // 过零率
  spectralCentroid: number; // 频谱质心
}

export interface EmotionPrediction {
  emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised';
  confidence: number;
  features: AudioFeatures;
}

export class SpeechEmotionRecognizer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Float32Array | null = null;
  private bufferLength: number = 0;
  
  private isRecording: boolean = false;
  private sampleRate: number = 44100;

  /**
   * 初始化音频上下文
   */
  async initialize(): Promise<void> {
    try {
      // 创建音频上下文
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;
      
      // 创建分析器节点
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Float32Array(this.bufferLength);
      
      console.log('Speech emotion recognizer initialized');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw error;
    }
  }

  /**
   * 开始录音
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      if (!this.audioContext || !this.analyser) {
        await this.initialize();
      }

      // 连接麦克风到分析器
      this.microphone = this.audioContext!.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser!);
      
      this.isRecording = true;
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * 停止录音
   */
  stopRecording(): void {
    if (!this.isRecording) return;

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    this.isRecording = false;
    console.log('Recording stopped');
  }

  /**
   * 提取音频特征
   */
  extractFeatures(): AudioFeatures | null {
    if (!this.analyser || !this.dataArray || !this.isRecording) {
      return null;
    }

    // 获取时域数据
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // 获取频域数据
    const frequencyData = new Float32Array(this.bufferLength);
    this.analyser.getFloatFrequencyData(frequencyData);

    // 计算各种特征
    const pitch = this.calculatePitch(this.dataArray);
    const energy = this.calculateEnergy(this.dataArray);
    const zeroCrossingRate = this.calculateZeroCrossingRate(this.dataArray);
    const spectralCentroid = this.calculateSpectralCentroid(frequencyData);
    
    return {
      pitch,
      energy,
      speechRate: 0, // 需要更复杂的算法,暂时设为0
      zeroCrossingRate,
      spectralCentroid
    };
  }

  /**
   * 识别情绪(基于规则)
   */
  recognizeEmotion(): EmotionPrediction | null {
    const features = this.extractFeatures();
    if (!features) return null;

    // 基于规则的情绪分类
    let emotion: EmotionPrediction['emotion'] = 'neutral';
    let confidence = 0.5;

    const { pitch, energy, zeroCrossingRate, spectralCentroid } = features;

    // 快乐:高音高,高能量,高频谱质心
    if (pitch > 200 && energy > 0.3 && spectralCentroid > 2000) {
      emotion = 'happy';
      confidence = 0.75;
    }
    // 悲伤:低音高,低能量,低频谱质心
    else if (pitch < 150 && energy < 0.2 && spectralCentroid < 1500) {
      emotion = 'sad';
      confidence = 0.7;
    }
    // 愤怒:高能量,高过零率
    else if (energy > 0.4 && zeroCrossingRate > 0.15) {
      emotion = 'angry';
      confidence = 0.7;
    }
    // 恐惧:高音高,中等能量,高过零率
    else if (pitch > 220 && energy > 0.25 && zeroCrossingRate > 0.12) {
      emotion = 'fearful';
      confidence = 0.65;
    }
    // 惊讶:高音高,突然的能量变化
    else if (pitch > 210 && energy > 0.35) {
      emotion = 'surprised';
      confidence = 0.6;
    }

    return {
      emotion,
      confidence,
      features
    };
  }

  /**
   * 计算音高(基于自相关法)
   */
  private calculatePitch(buffer: Float32Array): number {
    // 自相关法检测基频
    const minFreq = 80;  // 最低频率(Hz)
    const maxFreq = 400; // 最高频率(Hz)
    
    const minPeriod = Math.floor(this.sampleRate / maxFreq);
    const maxPeriod = Math.floor(this.sampleRate / minFreq);
    
    let bestCorrelation = 0;
    let bestPeriod = 0;
    
    // 计算自相关
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      for (let i = 0; i < buffer.length - period; i++) {
        correlation += buffer[i] * buffer[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    // 转换为频率
    const pitch = bestPeriod > 0 ? this.sampleRate / bestPeriod : 0;
    return pitch;
  }

  /**
   * 计算能量(RMS)
   */
  private calculateEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);
    return Math.min(1.0, rms * 10); // 归一化到0-1
  }

  /**
   * 计算过零率
   */
  private calculateZeroCrossingRate(buffer: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i - 1] >= 0 && buffer[i] < 0) || (buffer[i - 1] < 0 && buffer[i] >= 0)) {
        crossings++;
      }
    }
    return crossings / buffer.length;
  }

  /**
   * 计算频谱质心
   */
  private calculateSpectralCentroid(frequencyData: Float32Array): number {
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = Math.pow(10, frequencyData[i] / 20); // dB转线性
      const frequency = (i * this.sampleRate) / (2 * frequencyData.length);
      
      numerator += frequency * magnitude;
      denominator += magnitude;
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopRecording();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
  }

  /**
   * 获取录音状态
   */
  getRecordingStatus(): boolean {
    return this.isRecording;
  }
}

/**
 * 多模态情绪融合器
 * 融合面部表情和语音情绪的结果
 */
export class MultimodalEmotionFusion {
  /**
   * 融合面部和语音情绪
   * @param facialEmotion 面部情绪
   * @param facialConfidence 面部置信度
   * @param voiceEmotion 语音情绪
   * @param voiceConfidence 语音置信度
   * @param facialWeight 面部权重(0-1)
   * @returns 融合后的情绪和置信度
   */
  static fuse(
    facialEmotion: string,
    facialConfidence: number,
    voiceEmotion: string | null,
    voiceConfidence: number,
    facialWeight: number = 0.6
  ): { emotion: string; confidence: number; source: string } {
    // 如果没有语音数据,仅使用面部
    if (!voiceEmotion) {
      return {
        emotion: facialEmotion,
        confidence: facialConfidence,
        source: 'facial'
      };
    }

    const voiceWeight = 1 - facialWeight;

    // 如果两个模态一致,提高置信度
    if (facialEmotion === voiceEmotion) {
      return {
        emotion: facialEmotion,
        confidence: Math.min(0.95, facialConfidence * 0.5 + voiceConfidence * 0.5 + 0.2),
        source: 'multimodal-consistent'
      };
    }

    // 如果不一致,选择置信度更高的
    const facialScore = facialConfidence * facialWeight;
    const voiceScore = voiceConfidence * voiceWeight;

    if (facialScore > voiceScore) {
      return {
        emotion: facialEmotion,
        confidence: facialConfidence * 0.9, // 降低置信度(因为不一致)
        source: 'multimodal-facial-dominant'
      };
    } else {
      return {
        emotion: voiceEmotion,
        confidence: voiceConfidence * 0.9,
        source: 'multimodal-voice-dominant'
      };
    }
  }

  /**
   * 检测情绪不一致性(可能表示伪装)
   */
  static detectInconsistency(
    facialEmotion: string,
    voiceEmotion: string | null
  ): { inconsistent: boolean; reason: string } {
    if (!voiceEmotion) {
      return { inconsistent: false, reason: 'No voice data' };
    }

    // 定义不一致的情绪组合
    const inconsistentPairs: Record<string, string[]> = {
      'happy': ['sad', 'angry', 'fearful'],
      'sad': ['happy', 'surprised'],
      'angry': ['happy'],
      'fearful': ['happy', 'angry']
    };

    const incompatible = inconsistentPairs[facialEmotion]?.includes(voiceEmotion) || false;

    if (incompatible) {
      return {
        inconsistent: true,
        reason: `Facial emotion (${facialEmotion}) conflicts with voice emotion (${voiceEmotion})`
      };
    }

    return { inconsistent: false, reason: 'Emotions are consistent' };
  }
}
