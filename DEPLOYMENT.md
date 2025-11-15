# 抑郁症智能识别系统 - 部署说明

**系统作者:** 王周好 (Wang Zhouhao)  
**版本:** v1.0.0  
**最后更新:** 2024年11月14日

---

## 📋 系统概述

这是一个专业级的抑郁症智能识别系统,集成了以下核心功能:

### 核心技术栈
- **前端:** React 19 + TypeScript + Tailwind CSS 4 + Vite
- **后端:** Node.js + Express + tRPC
- **数据库:** MySQL/TiDB (Drizzle ORM)
- **AI模型:** Face-API.js (深度学习情绪识别)
- **3D渲染:** Three.js (面部点云可视化)
- **认证:** Manus OAuth

### 主要功能
1. **实时人脸识别** - 68个面部关键点实时跟踪
2. **3D点云可视化** - Three.js渲染的可旋转3D面部模型
3. **精准情绪识别** - 7种情绪(愤怒、厌恶、恐惧、开心、悲伤、惊讶、平静)
4. **面部肌肉分析** - AU面部动作单元实时分析
5. **AI心理助手** - 大语言模型驱动的智能对话
6. **数据管理** - 完整的用户认证和历史记录

---

## 🚀 快速部署

### 1. 环境要求
- Node.js >= 18.0.0
- pnpm >= 8.0.0
- MySQL >= 8.0 或 TiDB

### 2. 解压项目
```bash
tar -xzf depression-detection-web-complete.tar.gz
cd depression-detection-web
```

### 3. 安装依赖
```bash
pnpm install
```

### 4. 配置环境变量
项目已经预配置了Manus平台的环境变量,包括:
- `DATABASE_URL` - 数据库连接字符串
- `JWT_SECRET` - JWT密钥
- `VITE_APP_TITLE` - 应用标题
- `BUILT_IN_FORGE_API_KEY` - Manus API密钥
- 其他OAuth和系统配置

如果需要自定义配置,请参考 `server/_core/env.ts`

### 5. 数据库迁移
```bash
pnpm db:push
```

### 6. 启动开发服务器
```bash
pnpm dev
```

服务器将在 `http://localhost:3000` 启动

### 7. 生产环境构建
```bash
pnpm build
pnpm start
```

---

## 📁 项目结构

```
depression-detection-web/
├── client/                    # 前端代码
│   ├── public/               # 静态资源
│   ├── src/
│   │   ├── components/       # React组件
│   │   │   ├── Face3DPointCloud.tsx      # 3D点云组件
│   │   │   ├── AIAssistant.tsx           # AI助手组件
│   │   │   └── ...
│   │   ├── pages/            # 页面组件
│   │   │   ├── Home.tsx                  # 首页
│   │   │   ├── Dashboard.tsx             # 控制台
│   │   │   ├── RealtimeDetection.tsx     # 实时检测
│   │   │   └── ...
│   │   ├── lib/              # 工具库
│   │   ├── hooks/            # 自定义Hooks
│   │   ├── App.tsx           # 应用入口
│   │   └── index.css         # 全局样式
│   └── index.html
├── server/                    # 后端代码
│   ├── _core/                # 核心框架
│   ├── db.ts                 # 数据库查询
│   ├── routers.ts            # tRPC路由
│   ├── faceDetection.ts      # 面部识别API
│   ├── dialogueAnalysis.ts   # 对话分析
│   └── detectionDb.ts        # 检测数据库操作
├── drizzle/                   # 数据库Schema
│   └── schema.ts             # 数据表定义
├── shared/                    # 共享代码
├── storage/                   # S3存储配置
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🗄️ 数据库Schema

系统包含以下数据表:

1. **users** - 用户表
   - id, openId, name, email, role, createdAt, etc.

2. **detection_records** - 识别记录表
   - id, userId, detectionType, emotionResult, confidence, etc.

3. **emotion_history** - 情绪历史表
   - id, userId, emotion, confidence, timestamp, etc.

4. **assessment_reports** - 评估报告表
   - id, userId, overallScore, riskLevel, recommendations, etc.

5. **dialogue_records** - 对话记录表
   - id, userId, userMessage, aiResponse, timestamp, etc.

6. **emotion_diary** - 情绪日记表
   - id, userId, mood, note, timestamp, etc.

7. **medical_resources** - 医疗资源表
   - id, name, type, address, phone, description, etc.

---

## 🎨 核心组件说明

### Face3DPointCloud.tsx
3D面部点云识别组件,集成:
- Face-API.js 深度学习模型
- Three.js 3D渲染引擎
- 68个关键点实时跟踪
- 7种情绪精准识别
- 可旋转的3D视图

### AIAssistant.tsx
AI心理助手组件,提供:
- 大语言模型对话
- 温暖的心理支持
- 专业的建议

### RealtimeDetection.tsx
实时检测页面,包含:
- 2D视频流显示
- 3D点云可视化
- AU面部动作单元分析
- AI助手对话

---

## 🔧 常见问题

### 1. 摄像头无法访问
确保浏览器已授予摄像头权限,并使用HTTPS协议访问

### 2. 3D模型加载失败
检查网络连接,Face-API.js模型从CDN加载:
```
https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model
```

### 3. 数据库连接失败
检查 `DATABASE_URL` 环境变量配置是否正确

### 4. 依赖安装失败
使用pnpm而不是npm:
```bash
npm install -g pnpm
pnpm install
```

---

## 📝 开发说明

### 添加新功能
1. 在 `drizzle/schema.ts` 中定义数据表
2. 运行 `pnpm db:push` 推送迁移
3. 在 `server/db.ts` 中添加查询函数
4. 在 `server/routers.ts` 中添加tRPC路由
5. 在 `client/src/pages/` 中创建页面组件

### 修改主题颜色
编辑 `client/src/index.css` 中的CSS变量:
```css
:root {
  --primary: 210 100% 60%;
  --secondary: 180 80% 50%;
  ...
}
```

### 更新系统署名
所有署名已设置为"王周好",如需修改请编辑:
- `client/src/pages/Home.tsx` (页脚)
- `client/src/const.ts` (APP_TITLE)

---

## 📞 技术支持

**系统作者:** 王周好 (Wang Zhouhao)  
**开发时间:** 2024年11月  
**技术栈:** React + Node.js + Face-API.js + Three.js

---

## 📄 许可证

本项目版权归王周好所有。

---

**祝您使用愉快!** 🎉
