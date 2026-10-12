import pLimit from 'p-limit';

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

const requestWindows = new Map<string, RateLimitWindow>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function limitRequestsByIp(
  ip: string,
  limit = 30,
  windowMs = 60_000,
  now = Date.now()
): RateLimitResult {
  for (const [key, window] of requestWindows) {
    if (window.resetAt <= now) requestWindows.delete(key);
  }

  const current = requestWindows.get(ip);
  if (!current || current.resetAt <= now) {
    requestWindows.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// IGDB: limite de 4 req/segundo
export const igdbLimiter = pLimit(4);

// TMDB: tolerante, limite de segurança 10 concorrentes
export const tmdbLimiter = pLimit(10);

// AniList: até 90 req/min
export const anilistLimiter = pLimit(3);

// OpenLibrary / GoogleBooks
export const booksLimiter = pLimit(5);
