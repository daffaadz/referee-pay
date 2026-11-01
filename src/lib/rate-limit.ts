/**
 * In-memory sliding-window rate limiter for API endpoints (FR-12 Security pass)
 */
interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  windowMs?: number; // default: 60,000 (1 minute)
  maxRequests: number; // e.g. 15 for draft, 5 for claim
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const windowMs = options.windowMs || 60_000;
  const max = options.maxRequests;

  let record = store.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    store.set(identifier, record);
  }

  // Filter timestamps within current sliding window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= max) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return { allowed: false, remaining: 0, resetMs };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: max - record.timestamps.length,
    resetMs: windowMs,
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

