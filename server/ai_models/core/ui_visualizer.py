"""
高级UI可视化模块 v2.0
Advanced UI Visualizer

功能:
1. 现代化界面设计
2. 实时数据可视化
3. 情绪趋势图
4. 健康仪表盘
5. 语音波形显示
6. AU热力图
7. 多主题支持
"""

import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
import time


class AdvancedUIVisualizer:
    """
    高级UI可视化器
    
    设计理念:
    - 现代化、专业化
    - 信息丰富但不杂乱
    - 动态效果流畅
    - 多主题支持
    """
    
    def __init__(
        self,
        width: int = 1920,
        height: int = 1080,
        theme: str = 'cyberpunk'
    ):
        """
        初始化UI可视化器
        
        Args:
            width: 画布宽度
            height: 画布高度
            theme: 主题名称
        """
        self.width = width
        self.height = height
        self.theme = theme
        
        # 主题配置
        self.themes = {
            'cyberpunk': {
                'bg_color': (20, 20, 30),
                'primary_color': (255, 0, 255),  # 紫红
                'secondary_color': (0, 255, 255),  # 青色
                'accent_color': (255, 100, 255),
                'text_color': (220, 220, 255),
                'warning_color': (0, 100, 255),  # 橙色
                'danger_color': (0, 0, 255),  # 红色
                'success_color': (0, 255, 100),  # 绿色
            },
            'medical': {
                'bg_color': (240, 248, 255),
                'primary_color': (100, 180, 100),  # 医疗绿
                'secondary_color': (180, 180, 200),
                'accent_color': (120, 200, 120),
                'text_color': (40, 40, 60),
                'warning_color': (0, 165, 255),
                'danger_color': (0, 0, 200),
                'success_color': (0, 200, 100),
            },
            'warm': {
                'bg_color': (30, 40, 50),
                'primary_color': (100, 200, 255),  # 暖橙
                'secondary_color': (150, 220, 255),  # 暖黄
                'accent_color': (80, 180, 255),
                'text_color': (255, 250, 240),
                'warning_color': (0, 140, 255),
                'danger_color': (0, 50, 255),
                'success_color': (100, 255, 200),
            },
            'dark': {
                'bg_color': (15, 15, 25),
                'primary_color': (200, 150, 100),  # 深蓝
                'secondary_color': (150, 100, 80),
                'accent_color': (220, 180, 120),
                'text_color': (200, 200, 220),
                'warning_color': (0, 120, 200),
                'danger_color': (50, 50, 200),
                'success_color': (100, 200, 150),
            }
        }
        
        # 当前主题颜色
        self.colors = self.themes.get(theme, self.themes['cyberpunk'])
        
        # 数据历史
        self.emotion_history = deque(maxlen=100)
        self.depression_history = deque(maxlen=100)
        self.confidence_history = deque(maxlen=100)
        
        # 粒子系统
        self.particles = []
        self.max_particles = 50
        
        # 动画参数
        self.animation_time = 0
        self.glow_intensity = 0
        
        # 布局参数
        self.video_width = int(width * 0.55)  # 视频区域占55%
        self.panel_width = width - self.video_width
        self.video_height = int(self.video_width * 9 / 16)  # 16:9
        
        print(f"✓ UI可视化器已初始化 (主题: {theme})")
    
    def render_frame(
        self,
        video_frame: np.ndarray,
        face_result: Optional[Dict],
        voice_result: Optional[Dict],
        fusion_result: Optional[Dict],
        landmarks: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        渲染完整UI界面
        
        Args:
            video_frame: 视频帧
            face_result: 面部分析结果
            voice_result: 语音分析结果
            fusion_result: 融合结果
            landmarks: 面部关键点
            
        Returns:
            渲染后的界面
        """
        # 创建画布
        canvas = np.full((self.height, self.width, 3), self.colors['bg_color'], dtype=np.uint8)
        
        # 更新动画
        self.animation_time = (self.animation_time + 0.05) % (2 * np.pi)
        self.glow_intensity = (np.sin(self.animation_time) + 1) / 2
        
        # 1. 渲染视频区域
        video_display = self._render_video_area(video_frame, landmarks, face_result)
        
        # 放置视频
        video_y = 50
        video_x = 30
        if video_display.shape[0] <= self.height - video_y and video_display.shape[1] <= self.video_width:
            canvas[video_y:video_y+video_display.shape[0],
                   video_x:video_x+video_display.shape[1]] = video_display
        
        # 2. 渲染右侧面板
        panel_x = self.video_width + 40
        panel_y = 50
        
        # 情绪和风险评估
        panel_y = self._render_emotion_panel(canvas, panel_x, panel_y, fusion_result)
        
        # 情绪趋势图
        panel_y = self._render_trend_chart(canvas, panel_x, panel_y + 20)
        
        # 健康指标雷达图
        panel_y = self._render_health_radar(canvas, panel_x, panel_y + 20, fusion_result)
        
        # 3. 渲染底部语音波形
        self._render_voice_waveform(canvas, voice_result)
        
        # 4. 渲染顶部标题栏
        self._render_header(canvas)
        
        # 5. 渲染粒子效果
        self._render_particles(canvas, fusion_result)
        
        # 6. 渲染控制提示
        self._render_controls(canvas)
        
        return canvas
    
    def _render_video_area(
        self,
        frame: np.ndarray,
        landmarks: Optional[np.ndarray],
        face_result: Optional[Dict]
    ) -> np.ndarray:
        """渲染视频区域"""
        # 调整视频大小
        target_height = self.video_height
        target_width = int(frame.shape[1] * target_height / frame.shape[0])
        
        if target_width > self.video_width - 60:
            target_width = self.video_width - 60
            target_height = int(frame.shape[0] * target_width / frame.shape[1])
        
        video_resized = cv2.resize(frame, (target_width, target_height))
        
        # 绘制关键点
        if landmarks is not None and len(landmarks) > 0:
            scale_x = target_width / frame.shape[1]
            scale_y = target_height / frame.shape[0]
            
            # 绘制面部网格
            for i, (x, y) in enumerate(landmarks):
                x_scaled = int(x * scale_x)
                y_scaled = int(y * scale_y)
                
                # 关键点
                cv2.circle(video_resized, (x_scaled, y_scaled), 2,
                          self.colors['accent_color'], -1)
            
            # 绘制连接线(简化版)
            self._draw_face_mesh(video_resized, landmarks, scale_x, scale_y)
        
        # 添加边框和阴影效果
        bordered = self._add_border_and_shadow(video_resized)
        
        return bordered
    
    def _draw_face_mesh(
        self,
        frame: np.ndarray,
        landmarks: np.ndarray,
        scale_x: float,
        scale_y: float
    ):
        """绘制面部网格"""
        # 定义主要连接(简化版)
        connections = [
            # 下巴轮廓
            list(range(0, 16)),
            # 左眉
            list(range(17, 22)),
            # 右眉
            list(range(22, 27)),
            # 鼻梁
            list(range(27, 31)),
            # 鼻子下部
            list(range(31, 36)),
            # 左眼
            list(range(36, 42)) + [36],
            # 右眼
            list(range(42, 48)) + [42],
            # 外嘴唇
            list(range(48, 60)) + [48],
            # 内嘴唇
            list(range(60, 68)) + [60],
        ]
        
        for connection in connections:
            for i in range(len(connection) - 1):
                pt1_idx = connection[i]
                pt2_idx = connection[i + 1]
                
                if pt1_idx < len(landmarks) and pt2_idx < len(landmarks):
                    pt1 = (int(landmarks[pt1_idx][0] * scale_x),
                           int(landmarks[pt1_idx][1] * scale_y))
                    pt2 = (int(landmarks[pt2_idx][0] * scale_x),
                           int(landmarks[pt2_idx][1] * scale_y))
                    
                    # 半透明线条
                    overlay = frame.copy()
                    cv2.line(overlay, pt1, pt2, self.colors['secondary_color'], 1)
                    cv2.addWeighted(frame, 0.7, overlay, 0.3, 0, frame)
    
    def _add_border_and_shadow(self, frame: np.ndarray) -> np.ndarray:
        """添加边框和阴影"""
        border_size = 3
        shadow_size = 10
        
        # 创建带边框和阴影的画布
        h, w = frame.shape[:2]
        total_h = h + 2 * border_size + shadow_size
        total_w = w + 2 * border_size + shadow_size
        
        canvas = np.full((total_h, total_w, 3), self.colors['bg_color'], dtype=np.uint8)
        
        # 阴影(渐变)
        for i in range(shadow_size):
            alpha = (shadow_size - i) / shadow_size * 0.3
            color = tuple(int(c * (1 - alpha)) for c in self.colors['bg_color'])
            cv2.rectangle(canvas,
                         (border_size + i, border_size + i),
                         (border_size + w + i, border_size + h + i),
                         color, 1)
        
        # 边框(发光效果)
        glow_color = tuple(int(c * (0.5 + 0.5 * self.glow_intensity))
                          for c in self.colors['primary_color'])
        cv2.rectangle(canvas,
                     (0, 0),
                     (border_size + w, border_size + h),
                     glow_color, border_size)
        
        # 放置视频
        canvas[border_size:border_size+h, border_size:border_size+w] = frame
        
        return canvas
    
    def _render_emotion_panel(
        self,
        canvas: np.ndarray,
        x: int,
        y: int,
        fusion_result: Optional[Dict]
    ) -> int:
        """渲染情绪和风险评估面板"""
        panel_width = self.panel_width - 60
        panel_height = 280
        
        # 半透明背景
        overlay = canvas.copy()
        cv2.rectangle(overlay, (x, y), (x + panel_width, y + panel_height),
                     (40, 40, 50), -1)
        cv2.addWeighted(canvas, 0.7, overlay, 0.3, 0, canvas)
        
        # 边框
        cv2.rectangle(canvas, (x, y), (x + panel_width, y + panel_height),
                     self.colors['primary_color'], 2)
        
        # 标题
        cv2.putText(canvas, "EMOTION & RISK ASSESSMENT", (x + 15, y + 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, self.colors['text_color'], 2)
        
        if fusion_result and fusion_result.get('status') == 'success':
            emotion_data = fusion_result.get('emotion', {})
            assessment = fusion_result.get('assessment', {})
            
            # 情感信息
            emotion = emotion_data.get('emotion', 'unknown').upper()
            confidence = emotion_data.get('confidence', 0.0)
            
            cv2.putText(canvas, f"Emotion: {emotion}", (x + 15, y + 70),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.65, self.colors['text_color'], 2)
            
            # 置信度条
            self._draw_progress_bar(canvas, x + 15, y + 85, panel_width - 30, 20,
                                   confidence, "Confidence")
            
            # 抑郁风险仪表盘
            depression_score = fusion_result.get('depression_score', 0.0)
            self._draw_gauge(canvas, x + panel_width // 2, y + 180,
                           80, depression_score, "Depression Risk")
            
            # 风险等级
            risk_label = assessment.get('risk_label', '未知')
            risk_level = assessment.get('risk_level', 'unknown')
            
            risk_color = self.colors['success_color']
            if risk_level == 'medium':
                risk_color = self.colors['warning_color']
            elif risk_level == 'high':
                risk_color = self.colors['danger_color']
            
            cv2.putText(canvas, f"Risk: {risk_label}", (x + 15, y + 260),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, risk_color, 2)
        
        else:
            cv2.putText(canvas, "No Data Available", (x + 15, y + 70),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, self.colors['text_color'], 1)
        
        return y + panel_height
    
    def _draw_progress_bar(
        self,
        canvas: np.ndarray,
        x: int,
        y: int,
        width: int,
        height: int,
        value: float,
        label: str = ""
    ):
        """绘制进度条"""
        # 背景
        cv2.rectangle(canvas, (x, y), (x + width, y + height),
                     (60, 60, 70), -1)
        
        # 进度
        fill_width = int(width * value)
        
        # 渐变色
        if value > 0.7:
            color = self.colors['success_color']
        elif value > 0.4:
            color = self.colors['warning_color']
        else:
            color = self.colors['danger_color']
        
        cv2.rectangle(canvas, (x, y), (x + fill_width, y + height),
                     color, -1)
        
        # 边框
        cv2.rectangle(canvas, (x, y), (x + width, y + height),
                     self.colors['secondary_color'], 1)
        
        # 数值
        text = f"{value:.2f}"
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)[0]
        text_x = x + width + 10
        text_y = y + height // 2 + text_size[1] // 2
        cv2.putText(canvas, text, (text_x, text_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, self.colors['text_color'], 1)
    
    def _draw_gauge(
        self,
        canvas: np.ndarray,
        center_x: int,
        center_y: int,
        radius: int,
        value: float,
        label: str = ""
    ):
        """绘制仪表盘"""
        # 绘制半圆弧(从180度到0度)
        start_angle = 180
        end_angle = 0
        
        # 背景弧
        cv2.ellipse(canvas, (center_x, center_y), (radius, radius),
                   0, start_angle, end_angle, (60, 60, 70), 8)
        
        # 值弧
        value_angle = start_angle - (start_angle - end_angle) * value
        
        # 颜色根据值变化
        if value < 0.3:
            arc_color = self.colors['success_color']
        elif value < 0.6:
            arc_color = self.colors['warning_color']
        else:
            arc_color = self.colors['danger_color']
        
        cv2.ellipse(canvas, (center_x, center_y), (radius, radius),
                   0, start_angle, value_angle, arc_color, 8)
        
        # 指针
        pointer_angle = np.radians(value_angle)
        pointer_x = int(center_x + radius * 0.8 * np.cos(pointer_angle))
        pointer_y = int(center_y - radius * 0.8 * np.sin(pointer_angle))
        cv2.line(canvas, (center_x, center_y), (pointer_x, pointer_y),
                self.colors['text_color'], 3)
        
        # 中心点
        cv2.circle(canvas, (center_x, center_y), 5, self.colors['text_color'], -1)
        
        # 数值
        text = f"{value:.2f}"
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
        cv2.putText(canvas, text,
                   (center_x - text_size[0] // 2, center_y + 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.colors['text_color'], 1)
    
    def _render_trend_chart(
        self,
        canvas: np.ndarray,
        x: int,
        y: int
    ) -> int:
        """渲染情绪趋势图"""
        chart_width = self.panel_width - 60
        chart_height = 200
        
        # 背景
        overlay = canvas.copy()
        cv2.rectangle(overlay, (x, y), (x + chart_width, y + chart_height),
                     (40, 40, 50), -1)
        cv2.addWeighted(canvas, 0.7, overlay, 0.3, 0, canvas)
        
        # 边框
        cv2.rectangle(canvas, (x, y), (x + chart_width, y + chart_height),
                     self.colors['primary_color'], 2)
        
        # 标题
        cv2.putText(canvas, "EMOTION TREND", (x + 15, y + 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, self.colors['text_color'], 2)
        
        # 绘制网格
        grid_color = (60, 60, 70)
        for i in range(5):
            grid_y = y + 40 + i * (chart_height - 60) // 4
            cv2.line(canvas, (x + 15, grid_y), (x + chart_width - 15, grid_y),
                    grid_color, 1)
        
        # 绘制曲线
        if len(self.depression_history) > 1:
            points = []
            for i, value in enumerate(self.depression_history):
                px = x + 15 + i * (chart_width - 30) // max(1, len(self.depression_history) - 1)
                py = y + 40 + int((1 - value) * (chart_height - 60))
                points.append((px, py))
            
            # 绘制线条
            for i in range(len(points) - 1):
                cv2.line(canvas, points[i], points[i + 1],
                        self.colors['accent_color'], 2)
            
            # 绘制点
            for point in points:
                cv2.circle(canvas, point, 3, self.colors['primary_color'], -1)
        
        return y + chart_height
    
    def _render_health_radar(
        self,
        canvas: np.ndarray,
        x: int,
        y: int,
        fusion_result: Optional[Dict]
    ) -> int:
        """渲染健康指标雷达图"""
        radar_size = 180
        panel_width = self.panel_width - 60
        panel_height = 240
        
        # 背景
        overlay = canvas.copy()
        cv2.rectangle(overlay, (x, y), (x + panel_width, y + panel_height),
                     (40, 40, 50), -1)
        cv2.addWeighted(canvas, 0.7, overlay, 0.3, 0, canvas)
        
        # 边框
        cv2.rectangle(canvas, (x, y), (x + panel_width, y + panel_height),
                     self.colors['primary_color'], 2)
        
        # 标题
        cv2.putText(canvas, "HEALTH INDICATORS", (x + 15, y + 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, self.colors['text_color'], 2)
        
        # 雷达图中心
        center_x = x + panel_width // 2
        center_y = y + 140
        
        # 6个维度
        dimensions = [
            "Emotion",
            "Energy",
            "Social",
            "Sleep",
            "Appetite",
            "Focus"
        ]
        
        # 模拟数据(实际应从fusion_result获取)
        if fusion_result and fusion_result.get('status') == 'success':
            depression_score = fusion_result.get('depression_score', 0.5)
            # 抑郁分数越高,健康指标越低
            base_score = 1.0 - depression_score
            values = [
                base_score + np.random.uniform(-0.1, 0.1),
                base_score + np.random.uniform(-0.15, 0.15),
                base_score + np.random.uniform(-0.1, 0.1),
                base_score + np.random.uniform(-0.2, 0.1),
                base_score + np.random.uniform(-0.15, 0.15),
                base_score + np.random.uniform(-0.1, 0.1),
            ]
            values = [max(0, min(1, v)) for v in values]
        else:
            values = [0.5] * 6
        
        # 绘制雷达图
        self._draw_radar_chart(canvas, center_x, center_y, radar_size // 2,
                              dimensions, values)
        
        return y + panel_height
    
    def _draw_radar_chart(
        self,
        canvas: np.ndarray,
        center_x: int,
        center_y: int,
        radius: int,
        labels: List[str],
        values: List[float]
    ):
        """绘制雷达图"""
        n = len(labels)
        angles = [2 * np.pi * i / n - np.pi / 2 for i in range(n)]
        
        # 绘制背景网格
        for r in [0.25, 0.5, 0.75, 1.0]:
            points = []
            for angle in angles:
                x = int(center_x + radius * r * np.cos(angle))
                y = int(center_y + radius * r * np.sin(angle))
                points.append((x, y))
            points.append(points[0])
            
            for i in range(len(points) - 1):
                cv2.line(canvas, points[i], points[i + 1],
                        (60, 60, 70), 1)
        
        # 绘制轴线
        for angle in angles:
            x = int(center_x + radius * np.cos(angle))
            y = int(center_y + radius * np.sin(angle))
            cv2.line(canvas, (center_x, center_y), (x, y),
                    (60, 60, 70), 1)
        
        # 绘制数据多边形
        data_points = []
        for i, (angle, value) in enumerate(zip(angles, values)):
            x = int(center_x + radius * value * np.cos(angle))
            y = int(center_y + radius * value * np.sin(angle))
            data_points.append((x, y))
        
        # 填充
        if len(data_points) > 0:
            pts = np.array(data_points, np.int32)
            pts = pts.reshape((-1, 1, 2))
            overlay = canvas.copy()
            cv2.fillPoly(overlay, [pts], self.colors['accent_color'])
            cv2.addWeighted(canvas, 0.7, overlay, 0.3, 0, canvas)
            
            # 边线
            for i in range(len(data_points)):
                cv2.line(canvas, data_points[i], data_points[(i + 1) % len(data_points)],
                        self.colors['primary_color'], 2)
            
            # 数据点
            for point in data_points:
                cv2.circle(canvas, point, 4, self.colors['primary_color'], -1)
        
        # 标签
        for i, (angle, label) in enumerate(zip(angles, labels)):
            label_radius = radius + 25
            x = int(center_x + label_radius * np.cos(angle))
            y = int(center_y + label_radius * np.sin(angle))
            
            text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)[0]
            text_x = x - text_size[0] // 2
            text_y = y + text_size[1] // 2
            
            cv2.putText(canvas, label, (text_x, text_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, self.colors['text_color'], 1)
    
    def _render_voice_waveform(
        self,
        canvas: np.ndarray,
        voice_result: Optional[Dict]
    ):
        """渲染语音波形"""
        waveform_height = 100
        waveform_y = self.height - waveform_height - 80
        waveform_x = 30
        waveform_width = self.video_width
        
        # 背景
        overlay = canvas.copy()
        cv2.rectangle(overlay, (waveform_x, waveform_y),
                     (waveform_x + waveform_width, waveform_y + waveform_height),
                     (40, 40, 50), -1)
        cv2.addWeighted(canvas, 0.7, overlay, 0.3, 0, canvas)
        
        # 边框
        cv2.rectangle(canvas, (waveform_x, waveform_y),
                     (waveform_x + waveform_width, waveform_y + waveform_height),
                     self.colors['secondary_color'], 2)
        
        # 标题
        cv2.putText(canvas, "VOICE WAVEFORM", (waveform_x + 15, waveform_y + 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.colors['text_color'], 1)
        
        # 绘制波形(模拟)
        if voice_result and voice_result.get('status') == 'success':
            # 模拟波形数据
            num_samples = 200
            samples = np.random.randn(num_samples) * 0.3
            
            center_y = waveform_y + waveform_height // 2
            
            for i in range(num_samples - 1):
                x1 = waveform_x + 15 + i * (waveform_width - 30) // num_samples
                x2 = waveform_x + 15 + (i + 1) * (waveform_width - 30) // num_samples
                y1 = int(center_y + samples[i] * (waveform_height - 40))
                y2 = int(center_y + samples[i + 1] * (waveform_height - 40))
                
                cv2.line(canvas, (x1, y1), (x2, y2),
                        self.colors['accent_color'], 1)
    
    def _render_header(self, canvas: np.ndarray):
        """渲染顶部标题栏"""
        header_height = 40
        
        # 半透明背景
        overlay = canvas.copy()
        cv2.rectangle(overlay, (0, 0), (self.width, header_height),
                     (30, 30, 40), -1)
        cv2.addWeighted(canvas, 0.5, overlay, 0.5, 0, canvas)
        
        # 标题
        title = "DEPRESSION DETECTION SYSTEM v4.0"
        cv2.putText(canvas, title, (30, 28),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, self.colors['primary_color'], 2)
        
        # 时间
        current_time = time.strftime("%Y-%m-%d %H:%M:%S")
        time_size = cv2.getTextSize(current_time, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
        cv2.putText(canvas, current_time, (self.width - time_size[0] - 30, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.colors['text_color'], 1)
    
    def _render_particles(
        self,
        canvas: np.ndarray,
        fusion_result: Optional[Dict]
    ):
        """渲染粒子效果"""
        # 根据情绪生成粒子
        if fusion_result and fusion_result.get('status') == 'success':
            emotion = fusion_result.get('emotion', {}).get('emotion', 'neutral')
            
            # 随机生成新粒子
            if len(self.particles) < self.max_particles and np.random.random() < 0.3:
                particle = {
                    'x': np.random.randint(0, self.width),
                    'y': self.height,
                    'vx': np.random.uniform(-1, 1),
                    'vy': np.random.uniform(-3, -1) if emotion != 'sad' else np.random.uniform(0.5, 2),
                    'life': 1.0,
                    'color': self.colors['accent_color']
                }
                self.particles.append(particle)
        
        # 更新和绘制粒子
        particles_to_remove = []
        for particle in self.particles:
            particle['x'] += particle['vx']
            particle['y'] += particle['vy']
            particle['life'] -= 0.02
            
            if particle['life'] <= 0 or particle['y'] < 0 or particle['y'] > self.height:
                particles_to_remove.append(particle)
            else:
                # 绘制粒子
                alpha = particle['life']
                color = tuple(int(c * alpha) for c in particle['color'])
                cv2.circle(canvas, (int(particle['x']), int(particle['y'])),
                          2, color, -1)
        
        # 移除死亡粒子
        for particle in particles_to_remove:
            self.particles.remove(particle)
    
    def _render_controls(self, canvas: np.ndarray):
        """渲染控制提示"""
        controls_y = self.height - 40
        controls = [
            "Q: Quit",
            "T: Theme",
            "R: Record",
            "S: Screenshot"
        ]
        
        x_offset = 30
        for control in controls:
            cv2.putText(canvas, control, (x_offset, controls_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.45, self.colors['text_color'], 1)
            x_offset += 150
    
    def update_data(
        self,
        emotion: str,
        confidence: float,
        depression_score: float
    ):
        """更新数据历史"""
        self.emotion_history.append(emotion)
        self.confidence_history.append(confidence)
        self.depression_history.append(depression_score)
    
    def set_theme(self, theme: str):
        """切换主题"""
        if theme in self.themes:
            self.theme = theme
            self.colors = self.themes[theme]
            print(f"✓ 主题已切换: {theme}")
        else:
            print(f"⚠ 未知主题: {theme}")
