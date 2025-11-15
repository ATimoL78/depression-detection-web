# 假表情识别与微表情识别研究要点

## 一、假笑识别(Fake Smile Detection)

### 核心理论:Duchenne Smile

**真实笑容(Duchenne Smile)特征:**
- **AU6(眼轮匝肌收缩)+ AU12(嘴角上扬)**同时激活
- 眼周皮肤被拉向眼球,产生以下变化:
  - 脸颊上提
  - 眼下皮肤隆起或膨胀
  - 下眼睑上移
  - 眼角出现鱼尾纹
  - 眼上皮肤轻微下压和内收
  - 眉毛轻微下移

**假笑(Fake Smile)特征:**
- **仅AU12激活,缺少AU6**
- 或者AU6/AU12强度比值过低(<0.6)
- 没有眼周肌肉运动
- 缺少鱼尾纹
- 脸颊不上提

### 识别标准

1. **AU组合检测**
   - 真实笑容:AU6 + AU12同时激活
   - 假笑:仅AU12或AU6/AU12比值<0.6

2. **持续时间分析**
   - 真实笑容:0.5-4秒
   - 假笑:持续时间异常(过短或过长)

3. **时序动态分析**
   - 真实笑容:自然的起始(onset)和消退(offset)过程
   - 假笑:突然起始或消退,像"开关"一样

4. **左右对称性**
   - 真实笑容:基本对称
   - 假笑:可能不对称

### 识别准确率
根据研究文献,最佳AU组合方法可达到**86%**的准确率

---

## 二、微表情识别(Micro-Expression Recognition)

### 微表情特征

1. **持续时间极短**:1/25秒到1/2秒(40ms-500ms)
2. **强度低**:面部肌肉运动幅度小
3. **局部区域**:仅在面部特定区域出现
4. **不可控**:自发的、无法伪装的真实情绪

### 深度学习方法(2024最新)

#### 1. 特征提取方法

**手工特征(Handcrafted Features):**
- **LBP(Local Binary Patterns)**:局部二值模式
- **HOG(Histogram of Oriented Gradients)**:方向梯度直方图
- **Optical Flow**:光流特征

**深度特征(Deep Features):**
- **CNN(卷积神经网络)**:自动特征提取
- **3D CNN**:时空特征提取
- **ResNet**:残差网络
- **VGG**:深层卷积网络

#### 2. 时序建模方法

- **LSTM(长短期记忆网络)**:捕捉时序依赖
- **Bi-LSTM(双向LSTM)**:前后时序信息
- **Temporal Attention**:时序注意力机制
- **3D CNN**:直接建模时空特征

#### 3. 关键技术点

**Apex Frame Spotting(顶点帧检测):**
- 微表情强度最大的帧
- 对识别准确率影响显著

**数据增强:**
- 时间拉伸
- 空间旋转
- 噪声添加

**特征融合:**
- 手工特征+深度特征
- 多尺度特征融合
- 时空特征融合

---

## 三、语音情绪识别(Speech Emotion Recognition)

### 2024最新方法

#### 1. 深度学习模型

- **HuBERT**:优于CNN,准确率更高
- **VGGish + YAMNet组合**:达到87%准确率
- **CNN + Bi-LSTM轻量级模型**
- **Transformer模型**:自注意力机制

#### 2. 特征提取

**声学特征:**
- **MFCC(梅尔频率倒谱系数)**
- **Pitch(音高)**
- **Energy(能量)**
- **Formants(共振峰)**
- **Spectrograms(频谱图)**

#### 3. 数据增强

- 噪声添加
- 时间拉伸
- 音高变换

---

## 四、多模态情绪识别(Multimodal Emotion Recognition)

### 融合策略

#### 1. 特征层融合(Feature-level Fusion)
- 在特征提取后融合
- 拼接或加权融合

#### 2. 决策层融合(Decision-level Fusion)
- 各模态独立识别
- 最后融合决策结果

#### 3. 模型层融合(Model-level Fusion)
- 共享表示学习
- 跨模态注意力机制

### 音视频融合架构

**Audio-Video Transformer Fusion with Cross Attention (AVT-CA):**
- 视觉模态:面部表情(CNN提取)
- 音频模态:语音情绪(MFCC+深度学习)
- 跨模态注意力:捕捉音视频相关性
- 准确率提升显著

### 关键优势

- **互补性**:音频和视频提供不同维度信息
- **鲁棒性**:单模态失效时,其他模态补偿
- **准确性**:多模态融合准确率>单模态

---

## 五、实时性能优化

### 1. 模型优化

- **轻量级网络**:MobileNet, ShuffleNet
- **模型剪枝**:减少参数量
- **量化**:降低精度换取速度
- **知识蒸馏**:小模型学习大模型

### 2. 推理优化

- **GPU加速**:TensorFlow.js WebGL backend
- **Web Workers**:多线程处理
- **帧率控制**:30fps平衡性能和准确率
- **ROI检测**:仅处理面部区域

### 3. 点云优化

- **卡尔曼滤波**:平滑轨迹,减少抖动
- **持久化机制**:短暂遮挡不消失
- **置信度衰减**:逐渐降低未检测点的置信度

---

## 六、应用建议

### 假表情识别实现

1. 实时检测AU6和AU12
2. 计算AU6/AU12强度比值
3. 分析表情起始和消退的自然性
4. 检查持续时间是否在0.5-4秒范围
5. 综合评分判断真假

### 微表情识别实现

1. 使用3D CNN或LSTM进行时序建模
2. 检测Apex Frame(顶点帧)
3. 结合LBP/HOG手工特征和深度特征
4. 时间窗口设置为40-500ms
5. 多尺度特征融合

### 多模态融合实现

1. 面部:实时AU检测+微表情识别
2. 语音:MFCC特征提取+深度学习分类
3. 特征层或决策层融合
4. 跨模态注意力机制
5. 动态权重调整

---

## 七、数据集参考

### 微表情数据集
- **CASME II**:中国科学院微表情数据集
- **SMIC**:自发微表情数据集
- **SAMM**:曼彻斯特微表情数据集

### 语音情绪数据集
- **IEMOCAP**:交互式情绪多模态数据集
- **RAVDESS**:Ryerson音视频情绪数据集
- **EmoDB**:柏林情绪语音数据集

---

## 八、技术栈建议

### 前端
- **TensorFlow.js**:浏览器端深度学习
- **MediaPipe**:实时面部关键点检测(468点)
- **face-api.js**:面部检测和AU识别
- **Web Audio API**:语音采集和处理

### 后端
- **OpenCV**:图像处理
- **dlib**:面部关键点检测
- **OpenFace**:AU检测工具
- **librosa**:音频特征提取
- **PyTorch/TensorFlow**:深度学习模型训练

---

## 参考文献

1. Paul Ekman - "Fake Smile or Genuine Smile? The Duchenne Smile"
2. Zhang & Chai (2024) - "A review of research on micro-expression recognition algorithms based on deep learning"
3. Kim et al. (2024) - "Speech Emotion Recognition Using Deep Learning"
4. Mocanu et al. (2023) - "Multimodal emotion recognition using cross modal audio-video fusion"
5. Liu et al. (2012) - "Comparison of methods for smile deceit detection" (86% accuracy)
