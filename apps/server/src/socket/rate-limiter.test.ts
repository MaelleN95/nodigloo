import { describe, expect, it } from '@jest/globals';
import { createRateLimiter } from './rate-limiter.js';

describe('createRateLimiter', () => {
  it('refuse les tentatives au-delà du maximum dans la fenêtre', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000 }, () => 0);

    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(false);
  });

  it('compte chaque clé séparément', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 }, () => 0);

    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('b')).toBe(true);
    expect(limiter.allow('a')).toBe(false);
  });

  it('autorise de nouveau une fois la fenêtre écoulée', () => {
    let time = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 }, () => time);

    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(false);

    time = 1000;
    expect(limiter.allow('a')).toBe(true);
  });
});
