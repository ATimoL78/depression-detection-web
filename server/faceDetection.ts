/**
 * 面部识别API包装器
 * 将Python模型封装为Node.js可调用的API
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface FaceDetectionResult {
  success: boolean;
  emotion?: string;
  confidence?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  riskScore?: number;
  auFeatures?: Record<string, number>;
  facialFeatures?: {
    eyebrowMovement: number;
    mouthCorner: number;
    eyeGaze: number;
  };
  error?: string;
}

/**
 * 分析上传的面部图像
 * @param imageBuffer 图像Buffer数据
 * @returns 识别结果
 */
export async function analyzeFaceImage(imageBuffer: Buffer): Promise<FaceDetectionResult> {
  try {
    // 临时保存图像文件
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempImagePath = path.join(tempDir, `face_${Date.now()}.jpg`);
    await fs.writeFile(tempImagePath, imageBuffer);

    // 调用Python脚本进行识别
    const pythonScript = path.join(process.cwd(), 'server/ai_models/face_analyzer.py');
    
    const result = await runPythonScript(pythonScript, [tempImagePath]);

    // 清理临时文件
    await fs.unlink(tempImagePath).catch(() => {});

    return result;
  } catch (error) {
    console.error('Face detection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 运行Python脚本
 */
function runPythonScript(scriptPath: string, args: string[]): Promise<FaceDetectionResult> {
  return new Promise((resolve, reject) => {
    // 使用虚拟环境的Python
    const pythonPath = path.join(process.cwd(), 'venv/bin/python');
    const python = spawn(pythonPath, [scriptPath, ...args]);
    
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });
  });
}

/**
 * 模拟面部识别(用于开发测试)
 * 实际部署时应使用真实的Python模型
 */
export async function mockFaceDetection(imageBuffer: Buffer): Promise<FaceDetectionResult> {
  // 模拟处理延迟
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 随机生成模拟数据
  const emotions = ['happy', 'sad', 'angry', 'neutral', 'fear', 'surprise'];
  const emotion = emotions[Math.floor(Math.random() * emotions.length)];
  const confidence = 70 + Math.random() * 25; // 70-95%
  
  // 根据情绪计算风险评分
  let riskScore = 0;
  if (emotion === 'sad') riskScore = 60 + Math.random() * 30;
  else if (emotion === 'angry') riskScore = 40 + Math.random() * 30;
  else if (emotion === 'fear') riskScore = 50 + Math.random() * 30;
  else riskScore = Math.random() * 40;

  const riskLevel: 'low' | 'medium' | 'high' = 
    riskScore < 33 ? 'low' : riskScore < 66 ? 'medium' : 'high';

  return {
    success: true,
    emotion,
    confidence: Math.round(confidence),
    riskLevel,
    riskScore: Math.round(riskScore),
    auFeatures: {
      AU1: Math.random() * 5, // 眉毛内侧上扬
      AU4: Math.random() * 5, // 眉毛下压
      AU6: Math.random() * 5, // 脸颊上提
      AU12: Math.random() * 5, // 嘴角上扬
      AU15: Math.random() * 5, // 嘴角下压
    },
    facialFeatures: {
      eyebrowMovement: Math.random() * 100,
      mouthCorner: Math.random() * 100,
      eyeGaze: Math.random() * 100,
    },
  };
}
