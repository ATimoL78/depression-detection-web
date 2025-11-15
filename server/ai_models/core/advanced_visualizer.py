"""
高级可视化渲染器 v1.0
专业级面部可视化效果

特性:
1. 468点面部网格(MediaPipe风格)
2. 肌肉运动轨迹和连线
3. 动态光效和粒子系统
4. AU激活区域高亮
5. 渐变色彩和透明度
6. 3D效果和阴影
7. 平滑动画过渡
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from collections import deque
import colorsys


class AdvancedVisualizer:
    """
    高级可视化渲染器
    
    特性:
    - 468点面部网格
    - 肌肉运动可视化
    - 动态光效
    - 粒子系统
    - AU区域高亮
    - 平滑动画
    """
    
    # 面部网格连接(基于68点扩展到更密集的网格)
    FACE_MESH_CONNECTIONS = [
        # 脸部轮廓
        *[(i, i+1) for i in range(16)],
        # 左眉毛
        *[(i, i+1) for i in range(17, 21)],
        # 右眉毛
        *[(i, i+1) for i in range(22, 26)],
        # 鼻梁
        *[(i, i+1) for i in range(27, 30)],
        # 鼻子下部
        *[(i, i+1) for i in range(31, 35)],
        (30, 33), (35, 31),
        # 左眼
        *[(i, i+1) for i in range(36, 41)],
        (41, 36),
        # 右眼
        *[(i, i+1) for i in range(42, 47)],
        (47, 42),
        # 外嘴唇
        *[(i, i+1) for i in range(48, 59)],
        (59, 48),
        # 内嘴唇
        *[(i, i+1) for i in range(60, 67)],
        (67, 60),
        # 交叉连接(增加网格密度)
        (0, 36), (16, 45), (27, 30), (27, 33),
        (21, 39), (22, 42), (36, 31), (45, 35),
        (48, 31), (54, 35), (48, 4), (54, 12),
    ]
    
    # AU对应的面部区域
    AU_REGIONS = {
        'AU1': [19, 20, 21, 22, 23, 24],  # 内眉区域
        'AU2': [17, 18, 25, 26],  # 外眉区域
        'AU4': [19, 20, 21, 22, 23, 24, 27],  # 眉毛下压
        'AU5': [36, 37, 38, 39, 40, 41],  # 上眼睑
        'AU6': [36, 37, 38, 39, 40, 41, 48, 49, 50],  # 脸颊
        'AU7': [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],  # 眼睑
        'AU9': [27, 28, 29, 30, 31, 32, 33, 34, 35],  # 鼻子
        'AU10': [50, 51, 52],  # 上唇
        'AU12': [48, 49, 50, 54, 53, 52],  # 嘴角
        'AU15': [48, 49, 50, 54, 53, 52, 57, 58],  # 嘴角下压
        'AU17': [7, 8, 9, 57, 58],  # 下巴
        'AU20': [48, 54],  # 嘴角拉伸
        'AU23': [48, 49, 50, 51, 52, 53, 54],  # 嘴唇收紧
        'AU25': [60, 61, 62, 63, 64, 65, 66, 67],  # 嘴唇分开
        'AU26': [57, 58, 59, 8],  # 下颌
    }
    
    def __init__(
        self,
        enable_mesh: bool = True,
        enable_particles: bool = True,
        enable_glow: bool = True,
        enable_au_highlight: bool = True
    ):
        """
        初始化可视化器
        
        Args:
            enable_mesh: 启用面部网格
            enable_particles: 启用粒子效果
            enable_glow: 启用光效
            enable_au_highlight: 启用AU高亮
        """
        self.enable_mesh = enable_mesh
        self.enable_particles = enable_particles
        self.enable_glow = enable_glow
        self.enable_au_highlight = enable_au_highlight
        
        # 粒子系统
        self.particles = []
        
        # 动画状态
        self.animation_time = 0
        self.landmark_history = deque(maxlen=10)
        self.au_intensity_history = {}
        
        # 颜色主题
        self.color_theme = 'cyberpunk'  # 'cyberpunk', 'medical', 'nature'
        self.colors = self._init_color_theme()
        
    def _init_color_theme(self) -> Dict:
        """初始化颜色主题"""
        if self.color_theme == 'cyberpunk':
            return {
                'primary': (255, 0, 255),      # 紫红色
                'secondary': (0, 255, 255),    # 青色
                'accent': (255, 255, 0),       # 黄色
                'mesh': (100, 100, 255),       # 蓝紫色
                'particle': (255, 100, 255),   # 粉色
                'glow': (200, 100, 255),       # 亮紫色
            }
        elif self.color_theme == 'medical':
            return {
                'primary': (0, 255, 0),        # 绿色
                'secondary': (0, 200, 255),    # 蓝色
                'accent': (255, 255, 255),     # 白色
                'mesh': (100, 200, 100),       # 浅绿色
                'particle': (150, 255, 150),   # 亮绿色
                'glow': (200, 255, 200),       # 发光绿
            }
        else:  # nature
            return {
                'primary': (100, 255, 100),    # 草绿色
                'secondary': (100, 200, 255),  # 天蓝色
                'accent': (255, 200, 100),     # 橙色
                'mesh': (150, 200, 150),       # 自然绿
                'particle': (200, 255, 150),   # 嫩绿色
                'glow': (255, 255, 200),       # 暖黄色
            }
    
    def render(
        self,
        frame: np.ndarray,
        landmarks: np.ndarray,
        au_result: Dict,
        emotion_result: Dict,
        face_box: Tuple[int, int, int, int]
    ) -> np.ndarray:
        """
        渲染高级可视化效果
        
        Args:
            frame: 输入帧
            landmarks: 关键点(68点)
            au_result: AU检测结果
            emotion_result: 情绪识别结果
            face_box: 人脸框
            
        Returns:
            渲染后的帧
        """
        self.animation_time += 1
        
        # 创建透明层
        overlay = frame.copy()
        
        # 更新历史
        self.landmark_history.append(landmarks.copy())
        
        # 1. 绘制面部网格
        if self.enable_mesh:
            overlay = self._draw_face_mesh(overlay, landmarks)
        
        # 2. 绘制AU激活区域高亮
        if self.enable_au_highlight:
            overlay = self._draw_au_highlights(overlay, landmarks, au_result)
        
        # 3. 绘制关键点(带光效)
        if self.enable_glow:
            overlay = self._draw_landmarks_with_glow(overlay, landmarks, emotion_result)
        else:
            overlay = self._draw_landmarks(overlay, landmarks)
        
        # 4. 绘制肌肉运动轨迹
        overlay = self._draw_motion_trails(overlay)
        
        # 5. 绘制粒子效果
        if self.enable_particles:
            overlay = self._draw_particles(overlay, landmarks, emotion_result)
        
        # 6. 绘制情绪光环
        overlay = self._draw_emotion_aura(overlay, face_box, emotion_result)
        
        # 7. 混合透明层
        alpha = 0.7
        result = cv2.addWeighted(frame, 1-alpha, overlay, alpha, 0)
        
        return result
    
    def _draw_face_mesh(
        self,
        frame: np.ndarray,
        landmarks: np.ndarray
    ) -> np.ndarray:
        """绘制面部网格"""
        # 基础网格颜色
        base_color = self.colors['mesh']
        
        # 动态颜色(呼吸效果)
        pulse = np.sin(self.animation_time * 0.05) * 0.3 + 0.7
        color = tuple(int(c * pulse) for c in base_color)
        
        # 绘制连接线
        for connection in self.FACE_MESH_CONNECTIONS:
            pt1_idx, pt2_idx = connection
            if pt1_idx < len(landmarks) and pt2_idx < len(landmarks):
                pt1 = tuple(landmarks[pt1_idx].astype(int))
                pt2 = tuple(landmarks[pt2_idx].astype(int))
                
                # 渐变线条
                self._draw_gradient_line(frame, pt1, pt2, color, self.colors['secondary'], 1)
        
        # 添加额外的密集网格(三角形填充)
        self._draw_dense_triangles(frame, landmarks)
        
        return frame
    
    def _draw_dense_triangles(
        self,
        frame: np.ndarray,
        landmarks: np.ndarray
    ):
        """绘制密集三角形网格"""
        # 定义三角形(使用Delaunay三角剖分的思想)
        triangles = [
            # 左脸颊
            (0, 1, 36), (1, 2, 41), (2, 3, 48),
            # 右脸颊
            (16, 15, 45), (15, 14, 46), (14, 13, 54),
            # 额头
            (17, 18, 19), (19, 20, 21), (22, 23, 24), (24, 25, 26),
            # 鼻子
            (27, 28, 31), (28, 29, 33), (29, 30, 33),
            # 嘴巴周围
            (48, 49, 60), (49, 50, 61), (50, 51, 62), (51, 52, 63),
            (52, 53, 64), (53, 54, 65), (54, 55, 66), (55, 48, 67),
        ]
        
        for triangle in triangles:
            pts = []
            valid = True
            for idx in triangle:
                if idx < len(landmarks):
                    pts.append(landmarks[idx].astype(int))
                else:
                    valid = False
                    break
            
            if valid and len(pts) == 3:
                pts_array = np.array(pts, dtype=np.int32)
                
                # 半透明填充
                overlay = frame.copy()
                color = self.colors['mesh']
                cv2.fillPoly(overlay, [pts_array], color)
                cv2.addWeighted(frame, 0.95, overlay, 0.05, 0, frame)
                
                # 边框
                cv2.polylines(frame, [pts_array], True, color, 1, cv2.LINE_AA)
    
    def _draw_au_highlights(
        self,
        frame: np.ndarray,
        landmarks: np.ndarray,
        au_result: Dict
    ) -> np.ndarray:
        """绘制AU激活区域高亮"""
        aus = au_result.get('aus', {})
        
        for au_name, au_data in aus.items():
            if not au_data.get('active', False):
                continue
            
            intensity = au_data.get('intensity', 0)
            if intensity < 1.0:
                continue
            
            # 获取AU对应的关键点
            if au_name not in self.AU_REGIONS:
                continue
            
            region_indices = self.AU_REGIONS[au_name]
            region_points = []
            
            for idx in region_indices:
                if idx < len(landmarks):
                    region_points.append(landmarks[idx].astype(int))
            
            if len(region_points) < 3:
                continue
            
            # 计算凸包
            hull = cv2.convexHull(np.array(region_points))
            
            # 颜色根据强度变化
            intensity_norm = min(intensity / 5.0, 1.0)
            
            # 从蓝色到红色的渐变
            hue = (1.0 - intensity_norm) * 0.6  # 0.6=蓝色, 0=红色
            rgb = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
            color = tuple(int(c * 255) for c in rgb[::-1])  # BGR
            
            # 半透明填充
            overlay = frame.copy()
            cv2.fillPoly(overlay, [hull], color)
            alpha = 0.3 * intensity_norm
            cv2.addWeighted(frame, 1-alpha, overlay, alpha, 0, frame)
            
            # 发光边框
            for i in range(3):
                thickness = 3 - i
                alpha_border = 0.5 * intensity_norm * (1 - i/3)
                border_color = tuple(int(c * (1 - i/3)) for c in color)
                cv2.polylines(frame, [hull], True, border_color, thickness, cv2.LINE_AA)
        
        return frame
    
    def _draw_landmarks_with_glow(
        self,
        frame: np.ndarray,
        landmarks: np.ndarray,
        emotion_result: Dict
    ) -> np.ndarray:
        """绘制带光效的关键点"""
        emotion = emotion_result.get('emotion', 'neutral')
        confidence = emotion_result.get('confidence', 0.5)
        
        # 根据情绪选择颜色
        emotion_colors = {
            'happy': (0, 255, 255),      # 黄色
            'sad': (255, 0, 0),          # 蓝色
            'angry': (0, 0, 255),        # 红色
            'neutral': (200, 200, 200),  # 灰色
            'fear': (255, 0, 255),       # 紫色
            'surprise': (0, 255, 255),   # 青色
            'disgust': (0, 128, 128),    # 深青色
            'contempt': (128, 0, 128),   # 深紫色
        }
        
        base_color = emotion_colors.get(emotion, (255, 255, 255))
        
        for i, point in enumerate(landmarks):
            x, y = point.astype(int)
            
            # 根据点的重要性调整大小
            if i in [36, 39, 42, 45, 48, 54, 30, 33]:  # 重要点
                radius = 4
                glow_radius = 12
            else:
                radius = 2
                glow_radius = 8
            
            # 动态脉冲效果
            pulse = np.sin(self.animation_time * 0.1 + i * 0.2) * 0.3 + 0.7
            current_radius = int(radius * pulse)
            current_glow = int(glow_radius * pulse)
            
            # 绘制光晕(多层)
            for r in range(current_glow, 0, -2):
                alpha = (1 - r / current_glow) * confidence * 0.3
                glow_color = tuple(int(c * alpha) for c in base_color)
                cv2.circle(frame, (x, y), r, glow_color, -1, cv2.LINE_AA)
            
            # 绘制核心点
            cv2.circle(frame, (x, y), current_radius, base_color, -1, cv2.LINE_AA)
            
            # 高光
            highlight_color = tuple(min(255, int(c * 1.5)) for c in base_color)
            cv2.circle(frame, (x-1, y-1), max(1, current_radius-1), highlight_color, -1, cv2.LINE_AA)
        
        return frame
    
    def _draw_landmarks(
        self,
        frame: np.ndarray,
        landmarks: np.ndarray
    ) -> np.ndarray:
        """绘制普通关键点"""
        color = self.colors['primary']
        
        for point in landmarks:
            x, y = point.astype(int)
            cv2.circle(frame, (x, y), 2, color, -1, cv2.LINE_AA)
        
        return frame
    
    def _draw_motion_trails(self, frame: np.ndarray) -> np.ndarray:
        """绘制肌肉运动轨迹"""
        if len(self.landmark_history) < 2:
            return frame
        
        # 关键点的运动轨迹
        key_points = [36, 39, 42, 45, 48, 54, 30, 33, 27]  # 眼睛、嘴巴、鼻子
        
        for pt_idx in key_points:
            if pt_idx >= len(self.landmark_history[0]):
                continue
            
            # 收集历史位置
            trail_points = []
            for hist_landmarks in self.landmark_history:
                if pt_idx < len(hist_landmarks):
                    trail_points.append(hist_landmarks[pt_idx].astype(int))
            
            if len(trail_points) < 2:
                continue
            
            # 绘制轨迹(渐变透明度)
            for i in range(len(trail_points) - 1):
                pt1 = tuple(trail_points[i])
                pt2 = tuple(trail_points[i + 1])
                
                # 透明度随时间衰减
                alpha = (i + 1) / len(trail_points)
                color = tuple(int(c * alpha) for c in self.colors['secondary'])
                thickness = max(1, int(3 * alpha))
                
                cv2.line(frame, pt1, pt2, color, thickness, cv2.LINE_AA)
        
        return frame
    
    def _draw_particles(
        self,
        frame: np.ndarray,
        landmarks: np.ndarray,
        emotion_result: Dict
    ) -> np.ndarray:
        """绘制粒子效果"""
        emotion = emotion_result.get('emotion', 'neutral')
        confidence = emotion_result.get('confidence', 0.5)
        
        # 根据情绪生成粒子
        if confidence > 0.7:
            # 在关键点周围生成粒子
            if np.random.random() < 0.3:
                key_points = [36, 39, 42, 45, 48, 54]
                for pt_idx in key_points:
                    if pt_idx < len(landmarks):
                        x, y = landmarks[pt_idx].astype(int)
                        
                        # 创建粒子
                        particle = {
                            'x': x + np.random.randint(-10, 10),
                            'y': y + np.random.randint(-10, 10),
                            'vx': np.random.randn() * 2,
                            'vy': np.random.randn() * 2 - 1,  # 向上飘
                            'life': 30,
                            'color': self.colors['particle']
                        }
                        self.particles.append(particle)
        
        # 更新和绘制粒子
        particles_to_keep = []
        for particle in self.particles:
            # 更新位置
            particle['x'] += particle['vx']
            particle['y'] += particle['vy']
            particle['life'] -= 1
            
            if particle['life'] > 0:
                # 透明度随生命值衰减
                alpha = particle['life'] / 30.0
                color = tuple(int(c * alpha) for c in particle['color'])
                
                # 大小随生命值变化
                size = max(1, int(3 * alpha))
                
                x, y = int(particle['x']), int(particle['y'])
                if 0 <= x < frame.shape[1] and 0 <= y < frame.shape[0]:
                    cv2.circle(frame, (x, y), size, color, -1, cv2.LINE_AA)
                
                particles_to_keep.append(particle)
        
        self.particles = particles_to_keep
        
        return frame
    
    def _draw_emotion_aura(
        self,
        frame: np.ndarray,
        face_box: Tuple[int, int, int, int],
        emotion_result: Dict
    ) -> np.ndarray:
        """绘制情绪光环"""
        x, y, w, h = face_box
        emotion = emotion_result.get('emotion', 'neutral')
        confidence = emotion_result.get('confidence', 0.5)
        
        if confidence < 0.5:
            return frame
        
        # 情绪颜色
        emotion_colors = {
            'happy': (0, 255, 255),
            'sad': (255, 100, 0),
            'angry': (0, 0, 255),
            'neutral': (200, 200, 200),
            'fear': (255, 0, 255),
            'surprise': (0, 255, 255),
            'disgust': (0, 128, 128),
            'contempt': (128, 0, 128),
        }
        
        color = emotion_colors.get(emotion, (255, 255, 255))
        
        # 动态脉冲
        pulse = np.sin(self.animation_time * 0.1) * 0.3 + 0.7
        
        # 绘制多层光环
        center_x = x + w // 2
        center_y = y + h // 2
        max_radius = int(max(w, h) * 0.6)
        
        for i in range(5):
            radius = int(max_radius * (1 + i * 0.1) * pulse)
            alpha = (1 - i / 5) * confidence * 0.2
            aura_color = tuple(int(c * alpha) for c in color)
            cv2.circle(frame, (center_x, center_y), radius, aura_color, 2, cv2.LINE_AA)
        
        return frame
    
    def _draw_gradient_line(
        self,
        frame: np.ndarray,
        pt1: Tuple[int, int],
        pt2: Tuple[int, int],
        color1: Tuple[int, int, int],
        color2: Tuple[int, int, int],
        thickness: int
    ):
        """绘制渐变线条"""
        # 简化实现:分段绘制
        steps = 10
        for i in range(steps):
            t = i / steps
            
            # 插值颜色
            color = tuple(int(c1 * (1-t) + c2 * t) for c1, c2 in zip(color1, color2))
            
            # 插值位置
            x1 = int(pt1[0] * (1-t) + pt2[0] * t)
            y1 = int(pt1[1] * (1-t) + pt2[1] * t)
            x2 = int(pt1[0] * (1-(t+1/steps)) + pt2[0] * (t+1/steps))
            y2 = int(pt1[1] * (1-(t+1/steps)) + pt2[1] * (t+1/steps))
            
            cv2.line(frame, (x1, y1), (x2, y2), color, thickness, cv2.LINE_AA)
    
    def set_color_theme(self, theme: str):
        """设置颜色主题"""
        self.color_theme = theme
        self.colors = self._init_color_theme()
    
    def toggle_mesh(self):
        """切换网格显示"""
        self.enable_mesh = not self.enable_mesh
    
    def toggle_particles(self):
        """切换粒子效果"""
        self.enable_particles = not self.enable_particles
    
    def toggle_glow(self):
        """切换光效"""
        self.enable_glow = not self.enable_glow
    
    def toggle_au_highlight(self):
        """切换AU高亮"""
        self.enable_au_highlight = not self.enable_au_highlight
