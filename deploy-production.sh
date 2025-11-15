#!/bin/bash

# 抑郁症检测系统 - 生产环境部署脚本
# 作者: 优化版本
# 日期: 2025-11-14

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  抑郁症检测系统 - 生产环境部署"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Node.js版本
echo "📋 检查系统环境..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ 错误: 需要Node.js 18或更高版本${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js版本: $(node -v)${NC}"

# 检查pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  pnpm未安装,正在安装...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✅ pnpm版本: $(pnpm -v)${NC}"

# 创建必要的目录
echo ""
echo "📁 创建必要的目录..."
mkdir -p logs
mkdir -p temp
mkdir -p data
echo -e "${GREEN}✅ 目录创建完成${NC}"

# 检查环境变量文件
echo ""
echo "🔧 检查环境配置..."
if [ ! -f .env ]; then
    if [ -f .env.production ]; then
        echo -e "${YELLOW}⚠️  .env文件不存在,复制.env.production...${NC}"
        cp .env.production .env
    else
        echo -e "${RED}❌ 错误: 找不到环境配置文件${NC}"
        exit 1
    fi
fi

# 检查SESSION_SECRET
if grep -q "PLEASE_CHANGE_THIS_IN_PRODUCTION" .env || grep -q "CHANGE_THIS_TO_RANDOM_SECRET_KEY" .env; then
    echo -e "${YELLOW}⚠️  警告: SESSION_SECRET使用默认值,建议修改为随机字符串${NC}"
    # 生成随机密钥
    RANDOM_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$RANDOM_SECRET/" .env
    echo -e "${GREEN}✅ 已自动生成随机SESSION_SECRET${NC}"
fi

echo -e "${GREEN}✅ 环境配置检查完成${NC}"

# 安装依赖
echo ""
echo "📦 安装项目依赖..."
pnpm install --prod=false
echo -e "${GREEN}✅ 依赖安装完成${NC}"

# 创建Python虚拟环境(如果不存在)
echo ""
echo "🐍 配置Python环境..."
if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python3.11 -m venv venv
    source venv/bin/activate
    pip install opencv-python numpy --quiet
    deactivate
    echo -e "${GREEN}✅ Python虚拟环境创建完成${NC}"
else
    echo -e "${GREEN}✅ Python虚拟环境已存在${NC}"
fi

# 构建项目
echo ""
echo "🔨 构建生产版本..."
pnpm run build
echo -e "${GREEN}✅ 构建完成${NC}"

# 检查PM2
echo ""
echo "🚀 配置进程管理器..."
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2未安装,正在安装...${NC}"
    npm install -g pm2
fi
echo -e "${GREEN}✅ PM2版本: $(pm2 -v)${NC}"

# 停止旧进程
echo ""
echo "🛑 停止旧进程..."
pm2 stop depression-detection 2>/dev/null || true
pm2 delete depression-detection 2>/dev/null || true

# 启动新进程
echo ""
echo "🚀 启动生产服务器..."
if [ -f "ecosystem.config.cjs" ]; then
    pm2 start ecosystem.config.cjs
else
    pm2 start dist/index.js --name depression-detection
fi

# 保存PM2配置
pm2 save

# 设置开机自启
echo ""
echo "⚙️  配置开机自启..."
pm2 startup | tail -n 1 | bash || echo -e "${YELLOW}⚠️  请手动运行上面的命令以配置开机自启${NC}"

# 显示状态
echo ""
echo "📊 服务状态:"
pm2 status

# 显示日志位置
echo ""
echo "📝 日志文件位置:"
echo "  - PM2日志: $(pwd)/logs/"
echo "  - 应用日志: $(pwd)/server.log"

# 显示访问地址
echo ""
echo "=========================================="
echo -e "${GREEN}✅ 部署完成!${NC}"
echo "=========================================="
echo ""
echo "🌐 访问地址:"
echo "  - 本地: http://localhost:3000"
echo "  - 局域网: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📋 常用命令:"
echo "  - 查看状态: pm2 status"
echo "  - 查看日志: pm2 logs depression-detection"
echo "  - 重启服务: pm2 restart depression-detection"
echo "  - 停止服务: pm2 stop depression-detection"
echo ""
echo "⚠️  重要提示:"
echo "  1. 请确保防火墙已开放3000端口"
echo "  2. 生产环境建议配置Nginx反向代理"
echo "  3. 建议启用HTTPS(使用Let's Encrypt)"
echo "  4. 定期备份数据库文件"
echo ""
echo "📚 更多信息请查看: DEPLOYMENT_GUIDE.md"
echo ""
