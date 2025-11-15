// PM2配置文件 - 2025
// 用于永久部署和进程管理

export default {
  apps: [{
    name: 'depression-detection-2025',
    script: './dist/index.js',
    cwd: '/home/ubuntu/depression-detection-web',
    
    // 实例配置
    instances: 1,
    exec_mode: 'fork',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    
    // 日志配置
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 自动重启配置
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // 内存限制
    max_memory_restart: '500M',
    
    // 优雅重启
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // 其他配置
    time: true,
    
    // 启动延迟
    restart_delay: 4000,
  }]
};
