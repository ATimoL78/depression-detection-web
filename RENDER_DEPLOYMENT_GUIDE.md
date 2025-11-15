# 抑郁症检测系统 - Render 免费部署指南

## 📋 修改说明

本项目已经完成以下修改,可以直接在 Render 免费套餐上部署:

### ✅ 已完成的修改

1. **数据库适配**: MySQL → PostgreSQL
   - ✅ 修改 `drizzle.config.ts` 使用 PostgreSQL dialect
   - ✅ 重写 `drizzle/schema.ts` 使用 PostgreSQL 类型
   - ✅ 更新 `server/db.ts` 使用 `drizzle-orm/postgres-js`
   - ✅ 更新 `package.json` 依赖: `mysql2` → `postgres`

2. **AI 服务切换**: OpenAI → 豆包 AI (免费)
   - ✅ 配置豆包 API 端点: `https://ark.cn-beijing.volces.com/api/v3`
   - ✅ 使用豆包模型: `ep-20241115031255-xnfmq`
   - ✅ 兼容 OpenAI SDK (无需修改代码)

3. **部署配置优化**
   - ✅ 更新 `render.yaml` 包含数据库配置
   - ✅ 配置所有必需的环境变量
   - ✅ 优化为免费套餐运行

---

## 🚀 部署步骤

### 第一步: 获取豆包 AI API 密钥

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark)
2. 注册/登录账号
3. 进入"豆包大模型"服务
4. 创建 API 密钥
5. 复制您的 API Key (格式类似: `ak-xxxxx`)

### 第二步: 推送代码到 GitHub

```bash
# 在项目目录下执行
cd /path/to/depression-detection-web

# 添加所有修改
git add .

# 提交修改
git commit -m "适配 Render PostgreSQL 和豆包 AI"

# 推送到 GitHub
git push origin main
```

### 第三步: 在 Render 创建服务

#### 方式 A: 使用 Blueprint (推荐)

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击 **"New +"** → **"Blueprint"**
3. 连接您的 GitHub 仓库: `ATimoL78/depression-detection-web`
4. Render 会自动检测 `render.yaml` 并创建:
   - ✅ Web Service: `depression-detection-web`
   - ✅ PostgreSQL Database: `depression-detection-db`

#### 方式 B: 手动创建

**1. 创建 PostgreSQL 数据库**

1. 点击 **"New +"** → **"PostgreSQL"**
2. 配置:
   - **Name**: `depression-detection-db`
   - **Database**: `depression_detection`
   - **User**: `depression_user`
   - **Region**: `Oregon (US West)`
   - **Plan**: `Free`
3. 点击 **"Create Database"**
4. 等待数据库状态变为 **"Available"**
5. 复制 **Internal Database URL** (格式: `postgresql://...`)

**2. 创建 Web Service**

1. 点击 **"New +"** → **"Web Service"**
2. 连接 GitHub 仓库: `ATimoL78/depression-detection-web`
3. 配置:
   - **Name**: `depression-detection-web`
   - **Region**: `Oregon (US West)` (必须与数据库同区域)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `node dist/index.js`
   - **Plan**: `Free`

### 第四步: 配置环境变量

在 Web Service 的 **Environment** 标签页添加以下环境变量:

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_ENV` | `production` | 生产环境 |
| `PORT` | `10000` | Render 默认端口 |
| `SESSION_SECRET` | (点击 Generate) | 会话密钥,自动生成 |
| `DOUBAO_API_KEY` | `ak-xxxxx` | 您的豆包 API 密钥 |
| `OPENAI_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3` | 豆包 API 端点 |
| `OPENAI_MODEL` | `ep-20241115031255-xnfmq` | 豆包模型 ID |
| `DATABASE_URL` | (从数据库复制) | PostgreSQL 连接字符串 |
| `COMPRESSION_ENABLED` | `true` | 启用压缩 |
| `CACHE_ENABLED` | `true` | 启用缓存 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `CORS_ORIGIN` | `*` | 允许所有来源 |

**重要**: 
- `DOUBAO_API_KEY`: 必须填写您从火山引擎获取的密钥
- `DATABASE_URL`: 使用数据库的 **Internal Connection String**

### 第五步: 部署

1. 点击 **"Create Web Service"** (手动创建) 或等待 Blueprint 自动部署
2. Render 会自动:
   - 克隆代码
   - 安装依赖 (`pnpm install`)
   - 构建项目 (`pnpm run build`)
   - 启动服务 (`node dist/index.js`)

3. 查看部署日志,等待状态变为 **"Live"**

### 第六步: 初始化数据库

部署成功后,需要运行数据库迁移:

1. 在 Web Service 页面,点击 **"Shell"** 标签
2. 执行以下命令:

```bash
# 生成并运行数据库迁移
pnpm run db:push

# 初始化医疗资源数据
node seed_medical_resources.mjs
```

### 第七步: 访问您的网站

部署完成后,您会获得一个 URL,格式类似:
```
https://depression-detection-web.onrender.com
```

点击访问即可使用您的抑郁症检测系统!

---

## 🔧 常见问题

### 1. 部署失败: "Build failed"

**原因**: 依赖安装失败或构建超时

**解决**:
- 检查 `package.json` 是否正确
- 查看构建日志中的错误信息
- 确保 `pnpm` 版本兼容

### 2. 服务启动失败: "Application failed to respond"

**原因**: 环境变量配置错误或数据库连接失败

**解决**:
- 检查 `DATABASE_URL` 是否正确
- 确保使用 **Internal** 数据库 URL
- 检查数据库和 Web 服务是否在同一区域

### 3. AI 对话功能不工作

**原因**: 豆包 API 密钥错误或模型 ID 不正确

**解决**:
- 验证 `DOUBAO_API_KEY` 是否有效
- 检查 `OPENAI_BASE_URL` 和 `OPENAI_MODEL` 配置
- 查看应用日志中的 API 错误信息

### 4. 数据库连接超时

**原因**: 使用了 External URL 或区域不匹配

**解决**:
- 确保使用数据库的 **Internal Connection String**
- 确保 Web 服务和数据库在同一区域 (Oregon)

### 5. 免费套餐限制

**症状**: 15分钟无活动后服务休眠

**说明**: 
- 这是 Render 免费套餐的正常行为
- 下次访问时会自动唤醒 (需要等待约30秒)
- 如需 24/7 运行,请升级到 Starter 套餐 ($7/月)

---

## 📊 免费套餐限制

| 资源 | 免费套餐 | 限制 |
|------|---------|------|
| Web Service | 512MB RAM, 0.1 CPU | 15分钟无活动后休眠 |
| PostgreSQL | 256MB RAM, 1GB 存储 | 90天后过期 |
| 带宽 | 100GB/月 | 超出后限速 |
| 构建时间 | 无限制 | 单次构建最长15分钟 |

**注意**: 
- 免费数据库会在 90 天后过期,需要手动续期
- 面部识别功能可能因内存限制运行较慢
- 建议升级到付费套餐以获得更好的性能

---

## 🔐 安全建议

1. **保护 API 密钥**: 
   - ❌ 不要将 `DOUBAO_API_KEY` 提交到 Git
   - ✅ 只在 Render 环境变量中配置

2. **更改 SESSION_SECRET**:
   - ❌ 不要使用默认值
   - ✅ 使用 Render 的 "Generate" 功能生成强密钥

3. **定期备份数据库**:
   - 免费数据库不提供自动备份
   - 建议定期导出数据

4. **监控 API 使用**:
   - 豆包免费额度有限
   - 定期检查 API 调用量

---

## 📞 获取帮助

### Render 文档
- [PostgreSQL 数据库](https://docs.render.com/databases)
- [Web 服务部署](https://docs.render.com/web-services)
- [环境变量配置](https://docs.render.com/configure-environment-variables)

### 豆包 AI 文档
- [火山引擎 ARK 平台](https://www.volcengine.com/docs/82379)
- [API 使用指南](https://www.volcengine.com/docs/82379/1099455)

### 项目支持
- **作者**: 王周好 (Wang Zhouhao)
- **版本**: v3.0 (PostgreSQL + 豆包 AI 适配版)

---

## ✅ 部署检查清单

完成部署前,请确认:

- [ ] 已获取豆包 AI API 密钥
- [ ] 已推送修改后的代码到 GitHub
- [ ] 已创建 PostgreSQL 数据库
- [ ] 已创建 Web Service 并连接仓库
- [ ] 已配置所有必需的环境变量
- [ ] 数据库和 Web 服务在同一区域
- [ ] 已运行数据库迁移 (`pnpm run db:push`)
- [ ] 已初始化医疗资源数据
- [ ] 网站可以正常访问
- [ ] AI 对话功能正常工作
- [ ] 面部识别功能正常工作

---

**祝您部署顺利! 🎉**

如有问题,请查看 Render 部署日志或联系技术支持。
