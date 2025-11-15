#!/bin/bash

# 抑郁症检测系统部署脚本
# 作者: 王周好

set -e

echo "========================================="
echo "  抑郁症检测系统 - 部署脚本"
echo "========================================="
echo ""

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装,请先安装Docker"
    echo "安装命令: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# 检查docker-compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose未安装,请先安装docker-compose"
    exit 1
fi

echo "✅ Docker环境检查通过"
echo ""

# 停止旧容器
echo "🛑 停止旧容器..."
docker-compose down || true

# 构建新镜像
echo "🔨 构建Docker镜像..."
docker-compose build

# 启动容器
echo "🚀 启动应用..."
docker-compose up -d

# 等待应用启动
echo "⏳ 等待应用启动..."
sleep 10

# 检查健康状态
echo "🔍 检查应用健康状态..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo ""
    echo "========================================="
    echo "✅ 部署成功!"
    echo "========================================="
    echo ""
    echo "📱 访问地址: http://localhost:3000"
    echo "📊 查看日志: docker-compose logs -f"
    echo "🛑 停止服务: docker-compose down"
    echo ""
else
    echo ""
    echo "❌ 应用启动失败,请查看日志:"
    echo "docker-compose logs"
    exit 1
fi
