import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

interface BucketEntry {
  timestamps: number[];
}

export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, BucketEntry>();
  const { windowMs, maxRequests, keyPrefix = 'rl' } = options;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || req.socket.remoteAddress || 'unknown';
    const authHeader = req.headers.authorization ? req.headers.authorization.slice(-16) : 'anon';
    const key = `${keyPrefix}:${clientIp}:${authHeader}`;

    const existing = buckets.get(key) ?? { timestamps: [] };
    const cutoff = now - windowMs;
    const recent = existing.timestamps.filter((ts) => ts > cutoff);

    if (recent.length >= maxRequests) {
      const oldestRecent = recent[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestRecent + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait before submitting another request.',
        retryAfterSeconds,
      });
      buckets.set(key, { timestamps: recent });
      return;
    }

    recent.push(now);
    buckets.set(key, { timestamps: recent });

    // Bound map size to prevent unbounded memory growth
    if (buckets.size > 2000) {
      for (const [k, entry] of buckets.entries()) {
        if (entry.timestamps.every((ts) => ts <= cutoff)) {
          buckets.delete(k);
        }
      }
    }

    next();
  };
}
