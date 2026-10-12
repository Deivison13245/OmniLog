import { describe, expect, it } from 'vitest';
import { limitRequestsByIp } from '@/lib/rate-limit';

describe('per-IP request limiter', () => {
  it('blocks requests above the limit and allows them after the window', () => {
    const start = 1_800_000_000_000;
    expect(limitRequestsByIp('198.51.100.42', 2, 1_000, start).allowed).toBe(true);
    expect(limitRequestsByIp('198.51.100.42', 2, 1_000, start + 1).allowed).toBe(true);
    expect(limitRequestsByIp('198.51.100.42', 2, 1_000, start + 2)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(limitRequestsByIp('198.51.100.42', 2, 1_000, start + 1_000).allowed).toBe(true);
  });

  it('tracks different client IPs independently', () => {
    const start = 1_800_000_010_000;
    expect(limitRequestsByIp('198.51.100.43', 1, 1_000, start).allowed).toBe(true);
    expect(limitRequestsByIp('198.51.100.44', 1, 1_000, start).allowed).toBe(true);
    expect(limitRequestsByIp('198.51.100.43', 1, 1_000, start + 1).allowed).toBe(false);
  });
});
