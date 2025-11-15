# 抑郁症检测系统 - 生产环境部署指南

**版本**: v2.1.0 (优化增强版)  
**更新日期**: 2025年11月14日  
**状态**: ✅ 已优化并测试通过

---

## 📋 目录

- [系统优化概述](#系统优化概述)
- [快速部署](#快速部署)
- [详细部署步骤](#详细部署步骤)
- [生产环境配置](#生产环境配置)
- [性能优化](#性能优化)
- [安全加固](#安全加固)
- [监控和维护](#监控和维护)
- [故障排查](#故障排查)

---

## 🎯 系统优化概述

### 本次优化内容

#### 1. 后端AI检测算法增强
- ✅ 创建统一的Python面部分析脚本 (`face_analyzer.py`)
- ✅ 集成OpenCV基础检测和高级模型检测
- ✅ 实现抑郁症特征评分算法
- ✅ 优化AU动作单元计算精准度
- ✅ 配置Python虚拟环境隔离依赖

#### 2. 前端用户体验优化
- ✅ 新增帮助文档对话框组件 (`HelpDialog.tsx`)
- ✅ 完善Dashboard页面交互
- ✅ 优化实时检测页面布局
- ✅ 增强标准化量表用户引导
- ✅ 改进情绪日记和趋势分析界面

#### 3. 部署和运维优化
- ✅ 创建生产环境部署脚本 (`deploy-production.sh`)
- ✅ 配置PM2进程管理器
- ✅ 优化环境变量管理
- ✅ 完善日志和监控配置
- ✅ 编写详细部署文档

#### 4. 功能测试验证
- ✅ TypeScript类型检查通过
- ✅ 生产构建成功(无错误)
- ✅ 前端所有页面加载正常
- ✅ 路由导航功能正常
- ✅ 服务器稳定运行

---

## 🚀 快速部署

### 一键部署脚本

```bash
# 1. 进入项目目录
cd depression-detection-web

# 2. 运行部署脚本
./deploy-production.sh
```

部署脚本会自动完成:
- ✅ 检查系统环境(Node.js, pnpm)
- ✅ 创建必要目录(logs, temp, data)
- ✅ 配置环境变量(自动生成随机SESSION_SECRET)
- ✅ 安装项目依赖
- ✅ 创建Python虚拟环境
- ✅ 构建生产版本
- ✅ 配置PM2进程管理
- ✅ 启动生产服务器
- ✅ 设置开机自启

### 部署完成后

访问地址:
- **本地**: http://localhost:3000
- **局域网**: http://YOUR_SERVER_IP:3000
- **公网**: 需要配置域名和反向代理

---

## 📖 详细部署步骤

### 步骤1: 系统环境准备

#### 1.1 服务器要求

**最低配置**:
- CPU: 2核
- 内存: 4GB RAM
- 硬盘: 20GB
- 操作系统: Ubuntu 20.04+ / CentOS 7+

**推荐配置**:
- CPU: 4核
- 内存: 8GB RAM
- 硬盘: 50GB SSD
- 操作系统: Ubuntu 22.04 LTS

#### 1.2 安装依赖软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 22 (使用nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 安装pnpm
npm install -g pnpm

# 安装PM2
npm install -g pm2

# 安装Python和依赖
sudo apt install python3.11 python3.11-venv python3-pip -y

# 安装Nginx (可选,用于反向代理)
sudo apt install nginx -y
```

### 步骤2: 项目部署

#### 2.1 上传项目文件

```bash
# 方法1: 使用git
git clone https://github.com/your-repo/depression-detection-web.git
cd depression-detection-web

# 方法2: 使用scp上传压缩包
scp depression-detection-web.tar.gz user@server:/home/user/
ssh user@server
tar -xzf depression-detection-web.tar.gz
cd depression-detection-web
```

#### 2.2 配置环境变量

```bash
# 复制环境配置文件
cp .env.production .env

# 编辑环境变量
nano .env
```

**必须修改的配置**:
```env
# 会话密钥(必须修改!)
SESSION_SECRET=your-random-secret-key-here

# OpenAI API密钥(如果使用AI分析功能)
OPENAI_API_KEY=sk-your-api-key-here
```

**可选配置**:
```env
# 数据库连接(默认使用SQLite)
DATABASE_URL=mysql://user:password@localhost:3306/depression_detection

# 应用配置
VITE_APP_TITLE=抑郁症检测系统
PORT=3000
```

#### 2.3 运行部署脚本

```bash
# 给脚本添加执行权限
chmod +x deploy-production.sh

# 运行部署脚本
./deploy-production.sh
```

#### 2.4 验证部署

```bash
# 检查PM2状态
pm2 status

# 查看应用日志
pm2 logs depression-detection

# 测试访问
curl http://localhost:3000
```

### 步骤3: 配置反向代理(推荐)

#### 3.1 Nginx配置

创建Nginx配置文件:
```bash
sudo nano /etc/nginx/sites-available/depression-detection
```

配置内容:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 客户端最大上传大小
    client_max_body_size 10M;

    # 代理到Node.js应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置:
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/depression-detection /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

#### 3.2 配置HTTPS (Let's Encrypt)

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## ⚙️ 生产环境配置

### PM2进程管理

#### 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs depression-detection

# 实时日志
pm2 logs depression-detection --lines 100

# 重启应用
pm2 restart depression-detection

# 停止应用
pm2 stop depression-detection

# 删除应用
pm2 delete depression-detection

# 保存配置
pm2 save

# 开机自启
pm2 startup
```

#### PM2配置文件

项目包含 `ecosystem.config.cjs` 配置文件:

```javascript
module.exports = {
  apps: [{
    name: 'depression-detection',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

### 环境变量管理

#### 生产环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `SESSION_SECRET` | ✅ | - | 会话加密密钥 |
| `NODE_ENV` | ✅ | production | 运行环境 |
| `PORT` | ❌ | 3000 | 服务器端口 |
| `OPENAI_API_KEY` | ❌ | - | OpenAI API密钥 |
| `DATABASE_URL` | ❌ | SQLite | 数据库连接 |

#### 生成随机密钥

```bash
# 方法1: 使用openssl
openssl rand -base64 32

# 方法2: 使用/dev/urandom
cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1
```

---

## 🔧 性能优化

### 1. Node.js优化

```bash
# 增加内存限制
NODE_OPTIONS="--max-old-space-size=4096" pm2 restart depression-detection
```

### 2. 数据库优化

如果使用MySQL:
```sql
-- 创建索引
CREATE INDEX idx_user_id ON phq9_assessments(user_id);
CREATE INDEX idx_created_at ON emotion_diaries_enhanced(created_at);

-- 优化查询
OPTIMIZE TABLE phq9_assessments;
OPTIMIZE TABLE emotion_diaries_enhanced;
```

### 3. Nginx缓存优化

```nginx
# 启用gzip压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

# 静态文件缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 4. 前端优化

- ✅ 代码分割(已配置)
- ✅ 图片懒加载(已实现)
- ✅ Three.js渲染优化(已限制像素比)
- ✅ 卡尔曼滤波减少计算量(已实现)

---

## 🔒 安全加固

### 1. 防火墙配置

```bash
# 安装ufw
sudo apt install ufw

# 允许SSH
sudo ufw allow 22/tcp

# 允许HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 2. 限制访问

```nginx
# Nginx限流配置
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:3000;
}
```

### 3. 安全头部

```nginx
# 添加安全头部
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

### 4. 定期更新

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 更新Node.js依赖
pnpm update

# 重新构建
pnpm run build
pm2 restart depression-detection
```

---

## 📊 监控和维护

### 1. 日志管理

#### 日志位置
- PM2日志: `./logs/pm2-*.log`
- 应用日志: `./server.log`
- Nginx日志: `/var/log/nginx/`

#### 日志轮转

创建 `/etc/logrotate.d/depression-detection`:
```
/home/user/depression-detection-web/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 user user
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. 性能监控

```bash
# PM2监控
pm2 monit

# 系统资源监控
htop

# 磁盘使用
df -h

# 内存使用
free -h
```

### 3. 数据备份

```bash
# 创建备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/user/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据库
mkdir -p $BACKUP_DIR
cp -r ./data $BACKUP_DIR/data_$DATE

# 压缩备份
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/data_$DATE
rm -rf $BACKUP_DIR/data_$DATE

# 删除7天前的备份
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.tar.gz"
EOF

chmod +x backup.sh

# 添加到crontab (每天凌晨2点备份)
crontab -e
# 添加: 0 2 * * * /home/user/depression-detection-web/backup.sh
```

---

## 🐛 故障排查

### 常见问题

#### 1. 端口被占用

```bash
# 查看端口占用
sudo lsof -i :3000

# 杀死进程
sudo kill -9 <PID>
```

#### 2. PM2启动失败

```bash
# 查看详细日志
pm2 logs depression-detection --lines 100

# 检查配置文件
cat ecosystem.config.cjs

# 手动启动测试
node dist/index.js
```

#### 3. Python模块错误

```bash
# 重新创建虚拟环境
rm -rf venv
python3.11 -m venv venv
source venv/bin/activate
pip install opencv-python numpy
deactivate
```

#### 4. 内存不足

```bash
# 增加Node.js内存限制
NODE_OPTIONS="--max-old-space-size=4096" pm2 restart depression-detection

# 或修改ecosystem.config.cjs
# max_memory_restart: '2G'
```

#### 5. 数据库连接失败

```bash
# 检查数据库配置
cat .env | grep DATABASE_URL

# 测试数据库连接
mysql -h localhost -u user -p database_name
```

### 调试模式

```bash
# 启用详细日志
NODE_ENV=development pm2 restart depression-detection

# 查看实时日志
pm2 logs depression-detection --lines 200
```

---

## 📞 技术支持

### 文档资源
- **完整文档**: `README_OPTIMIZED.md`
- **快速开始**: `QUICK_START.md`
- **优化报告**: `OPTIMIZATION_REPORT.md`
- **部署指南**: `DEPLOYMENT_GUIDE.md`

### 系统信息
- **版本**: v2.1.0
- **优化日期**: 2025-11-14
- **状态**: ✅ 生产就绪

### 联系方式
- **问题反馈**: GitHub Issues
- **技术支持**: support@example.com

---

## ✅ 部署检查清单

部署前检查:
- [ ] 服务器环境满足要求(Node.js 18+, Python 3.11+)
- [ ] 已安装pnpm和PM2
- [ ] 已配置环境变量(.env文件)
- [ ] SESSION_SECRET已修改为随机值
- [ ] 防火墙已配置(开放必要端口)
- [ ] 已创建必要目录(logs, temp, data)

部署后验证:
- [ ] PM2进程正常运行
- [ ] 网站可以正常访问
- [ ] 所有页面加载正常
- [ ] 实时检测功能正常
- [ ] 标准化量表功能正常
- [ ] 情绪日记功能正常
- [ ] 趋势分析功能正常
- [ ] 日志正常输出

生产环境优化:
- [ ] 已配置Nginx反向代理
- [ ] 已启用HTTPS
- [ ] 已配置日志轮转
- [ ] 已设置定期备份
- [ ] 已配置监控告警
- [ ] 已进行性能测试

---

## 🎉 部署完成

恭喜!您已成功部署抑郁症检测系统生产环境。

**下一步**:
1. 配置域名和HTTPS
2. 设置监控和告警
3. 进行压力测试
4. 培训使用人员
5. 准备应急预案

**记住**:
- 定期备份数据
- 及时更新系统
- 监控性能指标
- 关注安全公告

祝您使用愉快! 🎊

---

**Made with ❤️ for mental health**
