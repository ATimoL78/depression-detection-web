"""
高级眼部分析器 v2.0
- 精确的眨眼检测和频率分析
- 眼部疲劳多维度评估
- 凝视行为分析
- 瞳孔变化检测(如果可用)
- 眼动模式分析
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
import time


class AdvancedEyeAnalyzer:
    """
    高级眼部分析器
    提供全面的眼部特征分析
    """
    
    def __init__(
        self,
        fps: int = 30,
        blink_ear_threshold: float = 0.21,
        fatigue_ear_threshold: float = 0.25,
        analysis_window: int = 300  # 10秒窗口
    ):
        """
        初始化眼部分析器
        
        Args:
            fps: 帧率
            blink_ear_threshold: 眨眼EAR阈值
            fatigue_ear_threshold: 疲劳EAR阈值
            analysis_window: 分析窗口大小(帧数)
        """
        self.fps = fps
        self.blink_ear_threshold = blink_ear_threshold
        self.fatigue_ear_threshold = fatigue_ear_threshold
        self.analysis_window = analysis_window
        
        # EAR历史
        self.left_ear_history = deque(maxlen=analysis_window)
        self.right_ear_history = deque(maxlen=analysis_window)
        self.avg_ear_history = deque(maxlen=analysis_window)
        
        # 眨眼检测
        self.last_ear = 1.0
        self.blink_counter = 0
        self.blink_timestamps = deque(maxlen=100)
        self.blink_durations = deque(maxlen=100)
        self.current_blink_start = None
        
        # 疲劳检测
        self.fatigue_episodes = deque(maxlen=50)
        self.continuous_low_ear_count = 0
        
        # 凝视检测
        self.gaze_positions = deque(maxlen=analysis_window)
        self.gaze_fixations = []
        self.current_fixation_start = None
        self.current_fixation_position = None
        
        # 眼动模式
        self.saccade_count = 0
        self.smooth_pursuit_count = 0
        
        # 统计信息
        self.frame_count = 0
        self.analysis_times = deque(maxlen=100)
        
    def analyze(
        self,
        left_eye: np.ndarray,
        right_eye: np.ndarray,
        landmarks: Optional[np.ndarray] = None
    ) -> Dict:
        """
        分析眼部特征
        
        Args:
            left_eye: 左眼关键点
            right_eye: 右眼关键点
            landmarks: 完整人脸关键点(可选)
            
        Returns:
            眼部分析结果
        """
        start_time = time.time()
        self.frame_count += 1
        
        # 计算EAR
        left_ear = self._calculate_ear(left_eye)
        right_ear = self._calculate_ear(right_eye)
        avg_ear = (left_ear + right_ear) / 2.0
        
        # 记录EAR历史
        self.left_ear_history.append(left_ear)
        self.right_ear_history.append(right_ear)
        self.avg_ear_history.append(avg_ear)
        
        # 眨眼检测
        blink_info = self._detect_blink(avg_ear)
        
        # 疲劳检测
        fatigue_info = self._detect_fatigue(avg_ear)
        
        # 凝视分析
        gaze_info = self._analyze_gaze(left_eye, right_eye)
        
        # 眼部对称性
        symmetry = self._analyze_symmetry(left_ear, right_ear)
        
        # 眼动模式
        eye_movement = self._analyze_eye_movement()
        
        # 综合评估
        overall_score = self._calculate_overall_score(
            blink_info, fatigue_info, gaze_info, symmetry
        )
        
        analysis_time = (time.time() - start_time) * 1000
        self.analysis_times.append(analysis_time)
        
        return {
            # 基础EAR数据
            'left_ear': left_ear,
            'right_ear': right_ear,
            'avg_ear': avg_ear,
            'ear_std': np.std(list(self.avg_ear_history)) if len(self.avg_ear_history) > 10 else 0,
            
            # 眨眼信息
            'blink_detected': blink_info['detected'],
            'blink_count': self.blink_counter,
            'blink_rate': blink_info['rate'],
            'avg_blink_duration': blink_info['avg_duration'],
            'blink_regularity': blink_info['regularity'],
            
            # 疲劳信息
            'fatigue_level': fatigue_info['level'],
            'fatigue_score': fatigue_info['score'],
            'low_ear_ratio': fatigue_info['low_ear_ratio'],
            'fatigue_episodes': len(self.fatigue_episodes),
            
            # 凝视信息
            'gaze_stability': gaze_info['stability'],
            'fixation_count': len(self.gaze_fixations),
            'avg_fixation_duration': gaze_info['avg_fixation_duration'],
            'gaze_dispersion': gaze_info['dispersion'],
            
            # 对称性
            'eye_symmetry': symmetry['score'],
            'symmetry_issue': symmetry['issue'],
            
            # 眼动模式
            'saccade_count': self.saccade_count,
            'smooth_pursuit_detected': eye_movement['smooth_pursuit'],
            
            # 综合评估
            'overall_score': overall_score,
            'depression_indicators': self._identify_depression_indicators(
                blink_info, fatigue_info, gaze_info
            ),
            
            # 性能
            'analysis_time': analysis_time
        }
    
    def _calculate_ear(self, eye_points: np.ndarray) -> float:
        """
        计算眼睛纵横比(Eye Aspect Ratio)
        
        Args:
            eye_points: 眼部6个关键点
            
        Returns:
            EAR值
        """
        if len(eye_points) < 6:
            return 0.3  # 默认值
        
        # 垂直距离
        A = np.linalg.norm(eye_points[1] - eye_points[5])
        B = np.linalg.norm(eye_points[2] - eye_points[4])
        
        # 水平距离
        C = np.linalg.norm(eye_points[0] - eye_points[3])
        
        # EAR计算
        ear = (A + B) / (2.0 * C + 1e-6)
        
        return ear
    
    def _detect_blink(self, avg_ear: float) -> Dict:
        """检测眨眼"""
        detected = False
        
        # 检测眨眼动作(EAR从高到低再到高)
        if avg_ear < self.blink_ear_threshold and self.last_ear >= self.blink_ear_threshold:
            # 眨眼开始
            self.current_blink_start = self.frame_count
        elif avg_ear >= self.blink_ear_threshold and self.last_ear < self.blink_ear_threshold:
            # 眨眼结束
            if self.current_blink_start is not None:
                blink_duration = (self.frame_count - self.current_blink_start) / self.fps
                
                # 过滤异常眨眼(太短或太长)
                if 0.05 <= blink_duration <= 0.5:
                    self.blink_counter += 1
                    self.blink_timestamps.append(self.frame_count / self.fps)
                    self.blink_durations.append(blink_duration)
                    detected = True
                
                self.current_blink_start = None
        
        self.last_ear = avg_ear
        
        # 计算眨眼率(次/分钟)
        if len(self.avg_ear_history) > self.fps:  # 至少1秒数据
            time_window = len(self.avg_ear_history) / self.fps / 60.0  # 分钟
            blink_rate = self.blink_counter / time_window if time_window > 0 else 0
        else:
            blink_rate = 0
        
        # 计算平均眨眼时长
        avg_duration = np.mean(list(self.blink_durations)) if self.blink_durations else 0
        
        # 计算眨眼规律性
        regularity = self._calculate_blink_regularity()
        
        return {
            'detected': detected,
            'rate': blink_rate,
            'avg_duration': avg_duration,
            'regularity': regularity
        }
    
    def _calculate_blink_regularity(self) -> float:
        """
        计算眨眼规律性
        
        Returns:
            规律性评分(0-1,越高越规律)
        """
        if len(self.blink_timestamps) < 3:
            return 0.5
        
        # 计算眨眼间隔
        intervals = []
        timestamps = list(self.blink_timestamps)
        for i in range(1, len(timestamps)):
            intervals.append(timestamps[i] - timestamps[i-1])
        
        if not intervals:
            return 0.5
        
        # 间隔的变异系数(CV)
        mean_interval = np.mean(intervals)
        std_interval = np.std(intervals)
        
        if mean_interval > 0:
            cv = std_interval / mean_interval
            # CV越小越规律,转换为0-1评分
            regularity = 1.0 / (1.0 + cv)
        else:
            regularity = 0.5
        
        return regularity
    
    def _detect_fatigue(self, avg_ear: float) -> Dict:
        """检测眼部疲劳"""
        # 多维度疲劳评估
        fatigue_indicators = []
        
        # 1. 持续低EAR
        if avg_ear < self.fatigue_ear_threshold:
            self.continuous_low_ear_count += 1
        else:
            if self.continuous_low_ear_count > self.fps * 2:  # 持续2秒以上
                self.fatigue_episodes.append({
                    'duration': self.continuous_low_ear_count / self.fps,
                    'frame': self.frame_count
                })
            self.continuous_low_ear_count = 0
        
        # 持续低EAR比例
        if len(self.avg_ear_history) > self.fps:
            low_ear_count = sum(1 for ear in self.avg_ear_history if ear < self.fatigue_ear_threshold)
            low_ear_ratio = low_ear_count / len(self.avg_ear_history)
        else:
            low_ear_ratio = 0
        
        if low_ear_ratio > 0.3:
            fatigue_indicators.append(('low_ear_ratio', low_ear_ratio))
        
        # 2. EAR下降趋势
        if len(self.avg_ear_history) >= 60:  # 2秒数据
            recent_ear = list(self.avg_ear_history)[-30:]
            earlier_ear = list(self.avg_ear_history)[-60:-30]
            
            recent_avg = np.mean(recent_ear)
            earlier_avg = np.mean(earlier_ear)
            
            if recent_avg < earlier_avg * 0.9:  # 下降超过10%
                fatigue_indicators.append(('ear_decline', (earlier_avg - recent_avg) / earlier_avg))
        
        # 3. 眨眼频率异常
        if len(self.blink_timestamps) >= 3:
            time_window = (self.blink_timestamps[-1] - self.blink_timestamps[0]) / 60.0
            if time_window > 0:
                recent_blink_rate = (len(self.blink_timestamps) - 1) / time_window
                
                # 眨眼过少(< 10次/分钟)或过多(> 30次/分钟)
                if recent_blink_rate < 10:
                    fatigue_indicators.append(('low_blink_rate', 10 - recent_blink_rate))
                elif recent_blink_rate > 30:
                    fatigue_indicators.append(('high_blink_rate', recent_blink_rate - 30))
        
        # 4. EAR波动性降低(疲劳时眼睛活动减少)
        if len(self.avg_ear_history) > 30:
            ear_std = np.std(list(self.avg_ear_history)[-30:])
            if ear_std < 0.02:  # 波动很小
                fatigue_indicators.append(('low_variability', 0.02 - ear_std))
        
        # 计算综合疲劳评分
        if fatigue_indicators:
            fatigue_score = sum(weight for _, weight in fatigue_indicators) / len(fatigue_indicators)
            fatigue_score = min(1.0, fatigue_score)
        else:
            fatigue_score = 0.0
        
        # 疲劳等级
        if fatigue_score < 0.2:
            fatigue_level = 'none'
        elif fatigue_score < 0.4:
            fatigue_level = 'mild'
        elif fatigue_score < 0.6:
            fatigue_level = 'moderate'
        elif fatigue_score < 0.8:
            fatigue_level = 'severe'
        else:
            fatigue_level = 'extreme'
        
        return {
            'level': fatigue_level,
            'score': fatigue_score,
            'low_ear_ratio': low_ear_ratio,
            'indicators': fatigue_indicators
        }
    
    def _analyze_gaze(self, left_eye: np.ndarray, right_eye: np.ndarray) -> Dict:
        """分析凝视行为"""
        # 计算凝视位置(简化为眼睛中心)
        left_center = np.mean(left_eye, axis=0)
        right_center = np.mean(right_eye, axis=0)
        gaze_position = (left_center + right_center) / 2.0
        
        self.gaze_positions.append(gaze_position)
        
        # 凝视稳定性(位置变化的标准差)
        if len(self.gaze_positions) > 10:
            positions = np.array(list(self.gaze_positions)[-30:])
            gaze_stability = 1.0 / (1.0 + np.std(positions))
        else:
            gaze_stability = 0.5
        
        # 凝视分散度
        if len(self.gaze_positions) > 30:
            positions = np.array(list(self.gaze_positions))
            center = np.mean(positions, axis=0)
            distances = [np.linalg.norm(pos - center) for pos in positions]
            gaze_dispersion = np.mean(distances)
        else:
            gaze_dispersion = 0
        
        # 凝视点检测(位置变化小于阈值)
        if len(self.gaze_positions) >= 2:
            current_pos = self.gaze_positions[-1]
            prev_pos = self.gaze_positions[-2]
            position_change = np.linalg.norm(current_pos - prev_pos)
            
            if position_change < 2.0:  # 阈值
                if self.current_fixation_start is None:
                    self.current_fixation_start = self.frame_count
                    self.current_fixation_position = current_pos
            else:
                if self.current_fixation_start is not None:
                    duration = (self.frame_count - self.current_fixation_start) / self.fps
                    if duration > 0.2:  # 至少200ms
                        self.gaze_fixations.append({
                            'position': self.current_fixation_position,
                            'duration': duration,
                            'frame': self.frame_count
                        })
                    self.current_fixation_start = None
        
        # 平均凝视时长
        if self.gaze_fixations:
            recent_fixations = [f['duration'] for f in list(self.gaze_fixations)[-10:]]
            avg_fixation_duration = np.mean(recent_fixations)
        else:
            avg_fixation_duration = 0
        
        return {
            'stability': gaze_stability,
            'dispersion': gaze_dispersion,
            'avg_fixation_duration': avg_fixation_duration
        }
    
    def _analyze_symmetry(self, left_ear: float, right_ear: float) -> Dict:
        """分析眼部对称性"""
        # 计算左右眼EAR差异
        ear_diff = abs(left_ear - right_ear)
        
        # 对称性评分(差异越小越对称)
        symmetry_score = 1.0 / (1.0 + ear_diff * 10)
        
        # 判断是否存在对称性问题
        if ear_diff > 0.05:
            if left_ear < right_ear:
                issue = 'left_eye_more_closed'
            else:
                issue = 'right_eye_more_closed'
        else:
            issue = 'none'
        
        return {
            'score': symmetry_score,
            'ear_diff': ear_diff,
            'issue': issue
        }
    
    def _analyze_eye_movement(self) -> Dict:
        """分析眼动模式"""
        # 检测平滑追踪(smooth pursuit)
        smooth_pursuit = False
        
        if len(self.gaze_positions) >= 30:
            positions = np.array(list(self.gaze_positions)[-30:])
            
            # 计算运动方向的一致性
            movements = np.diff(positions, axis=0)
            if len(movements) > 0:
                # 计算运动向量的相关性
                correlations = []
                for i in range(len(movements) - 1):
                    if np.linalg.norm(movements[i]) > 0 and np.linalg.norm(movements[i+1]) > 0:
                        corr = np.dot(movements[i], movements[i+1]) / (
                            np.linalg.norm(movements[i]) * np.linalg.norm(movements[i+1])
                        )
                        correlations.append(corr)
                
                if correlations and np.mean(correlations) > 0.7:
                    smooth_pursuit = True
                    self.smooth_pursuit_count += 1
        
        return {
            'smooth_pursuit': smooth_pursuit
        }
    
    def _calculate_overall_score(
        self,
        blink_info: Dict,
        fatigue_info: Dict,
        gaze_info: Dict,
        symmetry: Dict
    ) -> float:
        """
        计算眼部综合评分(用于抑郁评估)
        
        Returns:
            评分(0-1,越高越可能抑郁)
        """
        score = 0.0
        
        # 眨眼异常
        blink_rate = blink_info['rate']
        if blink_rate > 0:
            if blink_rate < 10:  # 眨眼过少
                score += min(0.3, (10 - blink_rate) / 10 * 0.3)
            elif blink_rate > 30:  # 眨眼过多
                score += min(0.2, (blink_rate - 30) / 20 * 0.2)
        
        # 疲劳评分
        score += fatigue_info['score'] * 0.4
        
        # 凝视异常(抑郁患者凝视时间可能延长)
        avg_fixation = gaze_info['avg_fixation_duration']
        if avg_fixation > 3.0:  # 凝视超过3秒
            score += min(0.2, (avg_fixation - 3.0) / 5.0 * 0.2)
        
        # 眼部不对称(可能表示疲劳或神经问题)
        if symmetry['score'] < 0.8:
            score += (1.0 - symmetry['score']) * 0.1
        
        return min(1.0, score)
    
    def _identify_depression_indicators(
        self,
        blink_info: Dict,
        fatigue_info: Dict,
        gaze_info: Dict
    ) -> List[str]:
        """识别抑郁相关指标"""
        indicators = []
        
        # 眨眼频率异常
        blink_rate = blink_info['rate']
        if 0 < blink_rate < 10:
            indicators.append('reduced_blink_rate')
        elif blink_rate > 30:
            indicators.append('increased_blink_rate')
        
        # 眼部疲劳
        if fatigue_info['score'] > 0.5:
            indicators.append('eye_fatigue')
        
        # 凝视时间延长
        if gaze_info['avg_fixation_duration'] > 3.0:
            indicators.append('prolonged_gaze')
        
        # 眼动减少
        if gaze_info['dispersion'] < 5.0:
            indicators.append('reduced_eye_movement')
        
        return indicators
    
    def reset(self):
        """重置分析器"""
        self.left_ear_history.clear()
        self.right_ear_history.clear()
        self.avg_ear_history.clear()
        self.blink_counter = 0
        self.blink_timestamps.clear()
        self.blink_durations.clear()
        self.fatigue_episodes.clear()
        self.gaze_positions.clear()
        self.gaze_fixations = []
        self.frame_count = 0
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        return {
            'frame_count': self.frame_count,
            'total_blinks': self.blink_counter,
            'avg_blink_rate': self.blink_counter / max(self.frame_count / self.fps / 60, 1),
            'fatigue_episodes': len(self.fatigue_episodes),
            'gaze_fixations': len(self.gaze_fixations),
            'avg_analysis_time': np.mean(list(self.analysis_times)) if self.analysis_times else 0
        }
