const rateLimit = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimit.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimit.set(key, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
  }

  if (entry.count < config.maxRequests) {
    entry.count++;
    return { allowed: true, remaining: config.maxRequests - entry.count, resetIn: entry.resetTime - now };
  }

  return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimit.entries()) {
    if (now > entry.resetTime) {
      rateLimit.delete(key);
    }
  }
}, 60000);

export const RATE_LIMITS = {
  LOGIN: { windowMs: 60 * 1000, maxRequests: 10 },
  SIGNUP: { windowMs: 60 * 1000, maxRequests: 5 },
  API: { windowMs: 60 * 1000, maxRequests: 60 },
  AI: { windowMs: 60 * 1000, maxRequests: 10 },
  PASSWORD_RESET: { windowMs: 60 * 1000, maxRequests: 3 },
} as const;

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
