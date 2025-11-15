/**
 * 生成468点模拟面部关键点数据
 * 用于演示和测试3D点云可视化
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * 生成468个面部关键点的模拟数据
 * 基于MediaPipe FaceMesh的标准布局
 */
export function generateMockFaceLandmarks(): Landmark[] {
  const landmarks: Landmark[] = [];
  
  // 生成468个点,模拟真实面部结构
  for (let i = 0; i < 468; i++) {
    let x = 0.5;
    let y = 0.5;
    let z = 0;
    
    // 根据点的索引分配到不同的面部区域
    if (i >= 0 && i < 17) {
      // 面部轮廓 (下巴到额头)
      const t = i / 16;
      x = 0.3 + Math.sin(t * Math.PI) * 0.2;
      y = 0.2 + t * 0.6;
      z = -0.05 + Math.sin(t * Math.PI) * 0.02;
    } else if (i >= 17 && i < 27) {
      // 右眉毛
      const t = (i - 17) / 9;
      x = 0.6 + t * 0.15;
      y = 0.35;
      z = 0.01;
    } else if (i >= 27 && i < 36) {
      // 左眉毛
      const t = (i - 27) / 8;
      x = 0.25 + t * 0.15;
      y = 0.35;
      z = 0.01;
    } else if (i >= 36 && i < 48) {
      // 右眼
      const t = (i - 36) / 11 * Math.PI * 2;
      x = 0.65 + Math.cos(t) * 0.04;
      y = 0.4 + Math.sin(t) * 0.03;
      z = 0.02;
    } else if (i >= 48 && i < 60) {
      // 左眼
      const t = (i - 48) / 11 * Math.PI * 2;
      x = 0.35 + Math.cos(t) * 0.04;
      y = 0.4 + Math.sin(t) * 0.03;
      z = 0.02;
    } else if (i >= 60 && i < 68) {
      // 鼻子
      const t = (i - 60) / 7;
      x = 0.5;
      y = 0.45 + t * 0.15;
      z = 0.03 - t * 0.02;
    } else if (i >= 68 && i < 88) {
      // 嘴巴外轮廓
      const t = (i - 68) / 19 * Math.PI * 2;
      x = 0.5 + Math.cos(t) * 0.12;
      y = 0.7 + Math.sin(t) * 0.08;
      z = 0.01;
    } else if (i >= 88 && i < 108) {
      // 嘴巴内轮廓
      const t = (i - 88) / 19 * Math.PI * 2;
      x = 0.5 + Math.cos(t) * 0.08;
      y = 0.7 + Math.sin(t) * 0.05;
      z = 0.005;
    } else if (i >= 234 && i < 274) {
      // 左脸颊区域 (40个点)
      const row = Math.floor((i - 234) / 8);
      const col = (i - 234) % 8;
      x = 0.25 + col * 0.03;
      y = 0.45 + row * 0.05;
      z = -0.02 + Math.random() * 0.01;
    } else if (i >= 454 && i < 468) {
      // 右脸颊区域 (14个点,补充到468)
      const row = Math.floor((i - 454) / 7);
      const col = (i - 454) % 7;
      x = 0.55 + col * 0.03;
      y = 0.45 + row * 0.05;
      z = -0.02 + Math.random() * 0.01;
    } else {
      // 其他细节点 (填充到468个)
      const angle = (i / 468) * Math.PI * 2;
      const radius = 0.2 + Math.random() * 0.1;
      x = 0.5 + Math.cos(angle) * radius;
      y = 0.5 + Math.sin(angle) * radius;
      z = (Math.random() - 0.5) * 0.05;
    }
    
    // 添加微小的随机扰动,模拟真实检测
    x += (Math.random() - 0.5) * 0.005;
    y += (Math.random() - 0.5) * 0.005;
    z += (Math.random() - 0.5) * 0.002;
    
    landmarks.push({ x, y, z });
  }
  
  return landmarks;
}

/**
 * 生成带有表情变化的468点数据
 * @param emotion 表情类型: 'neutral', 'sad', 'happy'
 */
export function generateEmotionalFaceLandmarks(emotion: 'neutral' | 'sad' | 'happy' = 'neutral'): Landmark[] {
  const baseLandmarks = generateMockFaceLandmarks();
  
  if (emotion === 'sad') {
    // 模拟悲伤表情:嘴角下垂,眉头紧锁
    baseLandmarks.forEach((landmark, i) => {
      // 嘴角下垂
      if (i >= 68 && i < 88) {
        landmark.y += 0.02;
      }
      // 眉头紧锁
      if (i >= 17 && i < 36) {
        landmark.y -= 0.01;
      }
    });
  } else if (emotion === 'happy') {
    // 模拟开心表情:嘴角上扬,眼睛眯起
    baseLandmarks.forEach((landmark, i) => {
      // 嘴角上扬
      if (i >= 68 && i < 88) {
        landmark.y -= 0.02;
      }
      // 眼睛眯起
      if ((i >= 36 && i < 60)) {
        landmark.y += 0.01;
      }
    });
  }
  
  return baseLandmarks;
}

/**
 * 生成动态变化的468点数据(用于演示动画)
 * @param time 时间参数(秒)
 */
export function generateAnimatedFaceLandmarks(time: number): Landmark[] {
  const baseLandmarks = generateMockFaceLandmarks();
  
  // 添加呼吸效果
  const breathScale = 1 + Math.sin(time * 2) * 0.02;
  
  baseLandmarks.forEach((landmark) => {
    // 从中心点缩放
    const dx = landmark.x - 0.5;
    const dy = landmark.y - 0.5;
    landmark.x = 0.5 + dx * breathScale;
    landmark.y = 0.5 + dy * breathScale;
    
    // 添加微小的Z轴波动
    landmark.z += Math.sin(time * 3 + landmark.x * 10) * 0.002;
  });
  
  return baseLandmarks;
}
