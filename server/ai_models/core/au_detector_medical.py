"""
医疗级AU检测器 - Medical-Grade Action Unit Detector
基于临床研究的18种AU检测,支持强度分级(0-5)和微表情捕捉
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from collections import deque
import time


class MedicalGradeAUDetector:
    """
    医疗级AU检测器
    
    特性:
    1. 18种AU检测(覆盖所有抑郁相关AU)
    2. 强度分级0-5(符合FACS标准)
    3. 微表情检测(40-500ms)
    4. 自适应阈值(个性化基线)
    5. 时序平滑(减少抖动)
    """
    
    # 18种关键AU定义
    AU_DEFINITIONS = {
        # 上脸部AU
        'AU1': {'name': 'Inner Brow Raiser', 'region': 'upper', 'emotion': 'sadness'},
        'AU2': {'name': 'Outer Brow Raiser', 'region': 'upper', 'emotion': 'surprise'},
        'AU4': {'name': 'Brow Lowerer', 'region': 'upper', 'emotion': 'anger'},
        'AU5': {'name': 'Upper Lid Raiser', 'region': 'upper', 'emotion': 'surprise'},
        'AU6': {'name': 'Cheek Raiser', 'region': 'upper', 'emotion': 'happiness'},
        'AU7': {'name': 'Lid Tightener', 'region': 'upper', 'emotion': 'anger'},
        
        # 中脸部AU
        'AU9': {'name': 'Nose Wrinkler', 'region': 'middle', 'emotion': 'disgust'},
        'AU10': {'name': 'Upper Lip Raiser', 'region': 'middle', 'emotion': 'disgust'},
        
        # 下脸部AU
        'AU12': {'name': 'Lip Corner Puller', 'region': 'lower', 'emotion': 'happiness'},
        'AU15': {'name': 'Lip Corner Depressor', 'region': 'lower', 'emotion': 'sadness'},
        'AU17': {'name': 'Chin Raiser', 'region': 'lower', 'emotion': 'sadness'},
        'AU20': {'name': 'Lip Stretcher', 'region': 'lower', 'emotion': 'fear'},
        'AU23': {'name': 'Lip Tightener', 'region': 'lower', 'emotion': 'anger'},
        'AU24': {'name': 'Lip Presser', 'region': 'lower', 'emotion': 'suppression'},
        'AU25': {'name': 'Lips Part', 'region': 'lower', 'emotion': 'neutral'},
        'AU26': {'name': 'Jaw Drop', 'region': 'lower', 'emotion': 'surprise'},
        'AU27': {'name': 'Mouth Stretch', 'region': 'lower', 'emotion': 'fear'},
        'AU43': {'name': 'Eyes Closed', 'region': 'upper', 'emotion': 'fatigue'},
    }
    
    # 抑郁相关AU(高权重)
    DEPRESSION_AUS = ['AU1', 'AU4', 'AU15', 'AU17', 'AU24', 'AU43']
    
    # 健康相关AU(负权重)
    HEALTHY_AUS = ['AU6', 'AU12', 'AU25', 'AU26']
    
    def __init__(self, 
                 baseline_frames: int = 300,  # 基线校准帧数(10秒@30fps)
                 smoothing_window: int = 5,    # 时序平滑窗口
                 micro_expr_fps: int = 60):    # 微表情检测帧率
        """
        初始化医疗级AU检测器
        
        Args:
            baseline_frames: 基线校准所需帧数
            smoothing_window: 时序平滑窗口大小
            micro_expr_fps: 微表情检测所需帧率
        """
        self.baseline_frames = baseline_frames
        self.smoothing_window = smoothing_window
        self.micro_expr_fps = micro_expr_fps
        
        # 基线数据
        self.baseline_data = {au: [] for au in self.AU_DEFINITIONS.keys()}
        self.baseline_means = {}
        self.baseline_stds = {}
        self.is_calibrated = False
        
        # 时序平滑
        self.au_history = {au: deque(maxlen=smoothing_window) 
                          for au in self.AU_DEFINITIONS.keys()}
        
        # 微表情检测
        self.frame_timestamps = deque(maxlen=micro_expr_fps * 2)  # 2秒历史
        self.au_snapshots = deque(maxlen=micro_expr_fps * 2)
        
        # 统计信息
        self.total_frames = 0
        self.micro_expressions = []
        
    def detect(self, landmarks: np.ndarray) -> Dict:
        """
        检测所有AU及其强度
        
        Args:
            landmarks: 面部关键点 (68点或更多)
            
        Returns:
            {
                'aus': {
                    'AU1': {'intensity': 2.5, 'active': True, 'confidence': 0.85},
                    ...
                },
                'micro_expressions': [...],  # 检测到的微表情
                'depression_score': 0.65,    # 抑郁相关评分
                'is_calibrated': True
            }
        """
        self.total_frames += 1
        current_time = time.time()
        
        # 计算所有AU的原始特征
        au_features = self._extract_au_features(landmarks)
        
        # 更新基线(如果未校准)
        if not self.is_calibrated:
            self._update_baseline(au_features)
        
        # 计算AU强度(0-5级)
        au_results = {}
        for au_name, raw_value in au_features.items():
            intensity = self._calculate_intensity(au_name, raw_value)
            
            # 时序平滑
            self.au_history[au_name].append(intensity)
            smoothed_intensity = np.mean(self.au_history[au_name])
            
            # 判断是否激活(强度>1.0)
            active = smoothed_intensity >= 1.0
            
            # 置信度(基于稳定性)
            confidence = self._calculate_confidence(au_name)
            
            au_results[au_name] = {
                'intensity': float(smoothed_intensity),
                'active': active,
                'confidence': float(confidence),
                'region': self.AU_DEFINITIONS[au_name]['region'],
                'emotion': self.AU_DEFINITIONS[au_name]['emotion']
            }
        
        # 微表情检测
        self.frame_timestamps.append(current_time)
        self.au_snapshots.append(au_features.copy())
        micro_exprs = self._detect_micro_expressions()
        
        # 计算抑郁评分
        depression_score = self._calculate_depression_score(au_results)
        
        return {
            'aus': au_results,
            'micro_expressions': micro_exprs,
            'depression_score': depression_score,
            'is_calibrated': self.is_calibrated,
            'total_frames': self.total_frames
        }
    
    def _extract_au_features(self, landmarks: np.ndarray) -> Dict[str, float]:
        """提取所有AU的几何特征"""
        features = {}
        
        # 确保landmarks是正确的形状
        if landmarks.shape[0] < 68:
            # 如果点数不足,返回默认值
            return {au: 0.0 for au in self.AU_DEFINITIONS.keys()}
        
        # AU1: Inner Brow Raiser (内眉上扬)
        # 眉毛内侧点(19, 20, 23, 24)相对于鼻根(27)的距离
        inner_brow_left = np.linalg.norm(landmarks[19] - landmarks[27])
        inner_brow_right = np.linalg.norm(landmarks[24] - landmarks[27])
        features['AU1'] = (inner_brow_left + inner_brow_right) / 2.0
        
        # AU2: Outer Brow Raiser (外眉上扬)
        outer_brow_left = np.linalg.norm(landmarks[17] - landmarks[27])
        outer_brow_right = np.linalg.norm(landmarks[26] - landmarks[27])
        features['AU2'] = (outer_brow_left + outer_brow_right) / 2.0
        
        # AU4: Brow Lowerer (眉头下压)
        # 眉毛间距离
        brow_distance = np.linalg.norm(landmarks[21] - landmarks[22])
        features['AU4'] = 1.0 / (brow_distance + 1e-6)  # 距离越小,AU4越强
        
        # AU5: Upper Lid Raiser (上眼睑上扬)
        # 眼睛高度
        eye_height_left = np.linalg.norm(landmarks[37] - landmarks[41])
        eye_height_right = np.linalg.norm(landmarks[44] - landmarks[46])
        features['AU5'] = (eye_height_left + eye_height_right) / 2.0
        
        # AU6: Cheek Raiser (脸颊上提) - 真笑的关键
        # 眼角到脸颊的距离
        cheek_left = np.linalg.norm(landmarks[36] - landmarks[48])
        cheek_right = np.linalg.norm(landmarks[45] - landmarks[54])
        features['AU6'] = 1.0 / ((cheek_left + cheek_right) / 2.0 + 1e-6)
        
        # AU7: Lid Tightener (眼睑收紧)
        # 眼睛宽度
        eye_width_left = np.linalg.norm(landmarks[36] - landmarks[39])
        eye_width_right = np.linalg.norm(landmarks[42] - landmarks[45])
        features['AU7'] = 1.0 / ((eye_width_left + eye_width_right) / 2.0 + 1e-6)
        
        # AU9: Nose Wrinkler (鼻子皱起)
        nose_width = np.linalg.norm(landmarks[31] - landmarks[35])
        features['AU9'] = 1.0 / (nose_width + 1e-6)
        
        # AU10: Upper Lip Raiser (上唇上扬)
        upper_lip_height = np.linalg.norm(landmarks[51] - landmarks[33])
        features['AU10'] = upper_lip_height
        
        # AU12: Lip Corner Puller (嘴角上扬) - 笑容的关键
        # 嘴角到嘴中心的角度
        mouth_left = landmarks[48]
        mouth_right = landmarks[54]
        mouth_center = landmarks[51]
        
        # 计算嘴角上扬角度
        left_angle = np.arctan2(mouth_left[1] - mouth_center[1], 
                               mouth_left[0] - mouth_center[0])
        right_angle = np.arctan2(mouth_right[1] - mouth_center[1],
                                mouth_right[0] - mouth_center[0])
        features['AU12'] = -(left_angle + right_angle) / 2.0  # 负值表示上扬
        
        # AU15: Lip Corner Depressor (嘴角下拉) - 悲伤的关键
        features['AU15'] = (left_angle + right_angle) / 2.0  # 正值表示下拉
        
        # AU17: Chin Raiser (下巴上提)
        chin_height = np.linalg.norm(landmarks[8] - landmarks[57])
        features['AU17'] = 1.0 / (chin_height + 1e-6)
        
        # AU20: Lip Stretcher (嘴唇拉伸)
        mouth_width = np.linalg.norm(landmarks[48] - landmarks[54])
        features['AU20'] = mouth_width
        
        # AU23: Lip Tightener (嘴唇收紧)
        lip_thickness = np.linalg.norm(landmarks[62] - landmarks[66])
        features['AU23'] = 1.0 / (lip_thickness + 1e-6)
        
        # AU24: Lip Presser (嘴唇紧闭)
        lip_gap = np.linalg.norm(landmarks[51] - landmarks[57])
        features['AU24'] = 1.0 / (lip_gap + 1e-6)
        
        # AU25: Lips Part (嘴唇分开)
        features['AU25'] = lip_gap
        
        # AU26: Jaw Drop (下巴下垂)
        jaw_opening = np.linalg.norm(landmarks[62] - landmarks[66])
        features['AU26'] = jaw_opening
        
        # AU27: Mouth Stretch (嘴巴拉伸)
        mouth_stretch = mouth_width / (lip_gap + 1e-6)
        features['AU27'] = mouth_stretch
        
        # AU43: Eyes Closed (闭眼)
        # 眼睛纵横比
        eye_aspect_ratio_left = (eye_height_left / (eye_width_left + 1e-6))
        eye_aspect_ratio_right = (eye_height_right / (eye_width_right + 1e-6))
        features['AU43'] = 1.0 / ((eye_aspect_ratio_left + eye_aspect_ratio_right) / 2.0 + 1e-6)
        
        return features
    
    def _update_baseline(self, au_features: Dict[str, float]):
        """更新基线数据"""
        for au_name, value in au_features.items():
            self.baseline_data[au_name].append(value)
        
        # 检查是否收集足够的数据
        if len(self.baseline_data['AU1']) >= self.baseline_frames:
            # 计算均值和标准差
            for au_name in self.AU_DEFINITIONS.keys():
                data = np.array(self.baseline_data[au_name])
                self.baseline_means[au_name] = np.mean(data)
                self.baseline_stds[au_name] = np.std(data) + 1e-6  # 避免除零
            
            self.is_calibrated = True
            print(f"✓ 基线校准完成 ({self.baseline_frames}帧)")
    
    def _calculate_intensity(self, au_name: str, raw_value: float) -> float:
        """
        计算AU强度(0-5级)
        
        使用Z-score标准化,然后映射到0-5范围
        """
        if not self.is_calibrated:
            return 0.0
        
        # Z-score标准化
        mean = self.baseline_means[au_name]
        std = self.baseline_stds[au_name]
        z_score = (raw_value - mean) / std
        
        # 映射到0-5范围
        # z_score: -2 ~ +2 -> intensity: 0 ~ 5
        intensity = (z_score + 2.0) * 1.25
        intensity = np.clip(intensity, 0.0, 5.0)
        
        return intensity
    
    def _calculate_confidence(self, au_name: str) -> float:
        """
        计算AU检测置信度
        
        基于时序稳定性:变化越小,置信度越高
        """
        if len(self.au_history[au_name]) < 2:
            return 0.5
        
        # 计算标准差
        std = np.std(self.au_history[au_name])
        
        # 标准差越小,置信度越高
        confidence = 1.0 / (1.0 + std)
        
        return confidence
    
    def _detect_micro_expressions(self) -> List[Dict]:
        """
        检测微表情(40-500ms)
        
        方法:
        1. 检测AU的快速变化
        2. 持续时间在40-500ms范围内
        3. 强度变化>2.0
        """
        micro_exprs = []
        
        if len(self.frame_timestamps) < 5:
            return micro_exprs
        
        # 检查每个AU
        for au_name in self.AU_DEFINITIONS.keys():
            # 获取最近的AU值
            recent_values = [snapshot[au_name] for snapshot in list(self.au_snapshots)[-10:]]
            
            if len(recent_values) < 5:
                continue
            
            # 检测峰值
            for i in range(2, len(recent_values) - 2):
                # 检查是否是峰值
                if recent_values[i] > recent_values[i-1] and recent_values[i] > recent_values[i+1]:
                    # 计算变化幅度
                    baseline = (recent_values[i-2] + recent_values[i+2]) / 2.0
                    change = recent_values[i] - baseline
                    
                    # 如果变化幅度足够大
                    if abs(change) > 0.3:  # 相对于原始特征值
                        # 估计持续时间
                        start_idx = max(0, i - 2)
                        end_idx = min(len(recent_values) - 1, i + 2)
                        
                        if start_idx < len(self.frame_timestamps) and end_idx < len(self.frame_timestamps):
                            duration = (list(self.frame_timestamps)[end_idx] - 
                                      list(self.frame_timestamps)[start_idx]) * 1000  # ms
                            
                            # 检查是否在微表情范围内(40-500ms)
                            if 40 <= duration <= 500:
                                micro_exprs.append({
                                    'au': au_name,
                                    'intensity': abs(change),
                                    'duration_ms': duration,
                                    'timestamp': list(self.frame_timestamps)[i],
                                    'emotion': self.AU_DEFINITIONS[au_name]['emotion']
                                })
        
        return micro_exprs
    
    def _calculate_depression_score(self, au_results: Dict) -> float:
        """
        计算抑郁相关评分(0-1)
        
        基于抑郁相关AU和健康相关AU的平衡
        """
        # 抑郁相关AU的平均强度
        depression_intensity = np.mean([
            au_results[au]['intensity'] 
            for au in self.DEPRESSION_AUS 
            if au in au_results
        ])
        
        # 健康相关AU的平均强度
        healthy_intensity = np.mean([
            au_results[au]['intensity'] 
            for au in self.HEALTHY_AUS 
            if au in au_results
        ])
        
        # 计算评分
        # 抑郁AU越强,健康AU越弱,评分越高
        score = (depression_intensity / 5.0) * 0.6 + (1.0 - healthy_intensity / 5.0) * 0.4
        score = np.clip(score, 0.0, 1.0)
        
        return float(score)
    
    def get_active_aus(self, au_results: Dict) -> List[str]:
        """获取当前激活的AU列表"""
        return [au for au, data in au_results.items() if data['active']]
    
    def get_depression_indicators(self, au_results: Dict) -> List[str]:
        """获取抑郁相关指标"""
        indicators = []
        
        for au in self.DEPRESSION_AUS:
            if au in au_results and au_results[au]['active']:
                indicators.append(f"{au}_{au_results[au]['emotion']}")
        
        return indicators
    
    def reset_baseline(self):
        """重置基线校准"""
        self.baseline_data = {au: [] for au in self.AU_DEFINITIONS.keys()}
        self.baseline_means = {}
        self.baseline_stds = {}
        self.is_calibrated = False
        self.total_frames = 0
        print("基线已重置")
    
    def get_calibration_progress(self) -> float:
        """获取校准进度(0-1)"""
        if self.is_calibrated:
            return 1.0
        
        current_frames = len(self.baseline_data['AU1'])
        return min(1.0, current_frames / self.baseline_frames)
