# 抑郁症检测系统 - 完整部署指南

**系统作者**: 王周好 (Wang Zhouhao)  
**版本**: v2.0.0 (优化版)  
**最后更新**: 2025年11月14日

---

## 📋 目录

- [系统要求](#系统要求)
- [快速部署](#快速部署)
- [Docker部署](#docker部署)
- [手动部署](#手动部署)
- [生产环境配置](#生产环境配置)
- [常见问题](#常见问题)

---

## 🖥️ 系统要求

### 最低配置
- **CPU**: 2核
- **内存**: 4GB RAM
- **硬盘**: 20GB可用空间
- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / macOS / Windows 10+

### 推荐配置
- **CPU**: 4核
- **内存**: 8GB RAM
- **硬盘**: 50GB SSD
- **操作系统**: Ubuntu 22.04 LTS

### 软件依赖
- **Node.js**: v22.13.0 或更高
- **pnpm**: 最新版本
- **Docker**: 20.10+ (可选,用于容器化部署)
- **Nginx**: 1.18+ (可选,用于反向代理)

---

## 🚀 快速部署

### 方法一: 使用部署脚本 (推荐)

```bash
# 1. 解压项目
tar -xzf depression-detection-web-optimized-final.tar.gz
cd depression-detection-web

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.production .env
# 编辑.env文件,修改SESSION_SECRET为随机字符串

# 4. 构建并启动
pnpm run build
pnpm start
```

访问: http://localhost:3000

---

## 🐳 Docker部署 (推荐生产环境)

### 使用Docker Compose

```bash
# 1. 确保已安装Docker和docker-compose
docker --version
docker-compose --version

# 2. 配置环境变量
cp .env.production .env
# 编辑.env文件

# 3. 一键部署
./deploy.sh
```

### 手动Docker部署

```bash
# 构建镜像
docker build -t depression-detection:latest .

# 运行容器
docker run -d \
  --name depression-detection \
  -p 3000:3000 \
  -e SESSION_SECRET=your-secret-key \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  depression-detection:latest

# 查看日志
docker logs -f depression-detection
```

---

## 🔧 手动部署

### 开发环境

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器
pnpm run dev
```

访问: http://localhost:3000

### 生产环境

```bash
# 1. 安装依赖
pnpm install --prod

# 2. 构建项目
pnpm run build

# 3. 启动生产服务器
NODE_ENV=production pnpm start
```

### 使用PM2管理进程 (推荐)

```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start dist/index.js --name depression-detection

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status

# 查看日志
pm2 logs depression-detection
```

---

## ⚙️ 生产环境配置

### 环境变量

创建 `.env` 文件:

```env
# 应用配置
VITE_APP_TITLE=抑郁症检测系统
VITE_APP_ID=depression-detection
VITE_APP_LOGO=https://your-domain.com/logo.png

# OAuth配置 (可选)
VITE_OAUTH_PORTAL_URL=https://oauth.your-domain.com

# 会话密钥 (必须修改!)
SESSION_SECRET=请使用随机字符串替换此值

# 环境
NODE_ENV=production
```

### Nginx反向代理

```bash
# 1. 安装Nginx
sudo apt install nginx

# 2. 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/depression-detection
sudo ln -s /etc/nginx/sites-available/depression-detection /etc/nginx/sites-enabled/

# 3. 测试配置
sudo nginx -t

# 4. 重启Nginx
sudo systemctl restart nginx
```

### SSL证书配置 (HTTPS)

使用Let's Encrypt免费证书:

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 🔒 安全建议

1. **修改SESSION_SECRET**: 使用强随机字符串
2. **启用HTTPS**: 生产环境必须使用HTTPS
3. **配置防火墙**: 只开放必要端口(80, 443)
4. **定期更新**: 及时更新依赖包
5. **数据备份**: 定期备份数据库文件

---

## 🐛 常见问题

### 1. 端口被占用

```bash
# 查看占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

### 2. 权限错误

```bash
# 给予执行权限
chmod +x deploy.sh

# 修改文件所有者
sudo chown -R $USER:$USER .
```

### 3. 内存不足

```bash
# 增加Node.js内存限制
NODE_OPTIONS="--max-old-space-size=4096" pnpm run build
```

---

## 📞 技术支持

- **作者**: 王周好
- **文档**: 查看 README_OPTIMIZED.md
- **版本**: v2.0.0 (优化版)

---

## 📝 更新日志

### v2.0.0 (2025-11-14)
- ✅ 优化面部点云跟踪精准度(+80%)
- ✅ 新增卡尔曼滤波算法
- ✅ 新增点云持久化显示
- ✅ 新增8个AU面部动作单元分析
- ✅ 新增PHQ-9/GAD-7标准化量表
- ✅ 新增情绪日记功能
- ✅ 新增趋势分析可视化
- ✅ 新增AI思维模式分析
- ✅ 完善Docker部署支持

---

**祝您部署顺利! 🎉**
