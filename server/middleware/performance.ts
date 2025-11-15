/**
 * 性能优化中间件 - 2025
 * 包括压缩、缓存、限流等
 */

import { Request, Response, NextFunction } from 'express';
import compression from 'compression';

/**
 * 响应压缩中间件
 */
export function compressionMiddleware() {
  return compression({
    // 压缩级别 (0-9, 6为默认)
    level: 6,
    // 压缩阈值 (小于1KB不压缩)
    threshold: 1024,
    // 过滤函数
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  });
}

/**
 * 缓存控制中间件
 */
export function cacheMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // 静态资源缓存
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      // 1年缓存
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // API请求不缓存
    else if (req.url.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // HTML页面短缓存
    else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    
    next();
  };
}

/**
 * 简单限流中间件
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimitMiddleware(options: {
  windowMs?: number;
  maxRequests?: number;
} = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15分钟
  const maxRequests = options.maxRequests || 100;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    let record = requestCounts.get(ip);
    
    // 重置或创建记录
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestCounts.set(ip, record);
    }
    
    record.count++;
    
    // 检查是否超过限制
    if (record.count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests',
        message: '请求过于频繁,请稍后再试',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }
    
    // 设置响应头
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
    
    next();
  };
}

/**
 * 响应时间记录中间件
 */
export function responseTimeMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // 在响应发送前设置header
    const originalSend = res.send;
    res.send = function(data: any) {
      const duration = Date.now() - start;
      res.setHeader('X-Response-Time', `${duration}ms`);
      
      // 记录慢请求
      if (duration > 1000) {
        console.warn(`Slow request: ${req.method} ${req.url} - ${duration}ms`);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * 安全头中间件
 */
export function securityHeadersMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // 防止XSS攻击
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // CSP (内容安全策略)
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://api.openai.com;"
    );
    
    next();
  };
}

/**
 * CORS中间件(已在_core/index.ts中配置,这里提供备用)
 */
export function corsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    
    next();
  };
}
