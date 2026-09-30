import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it("autorise jusqu'à la limite, puis refuse jusqu'à la fin de la fenêtre", () => {
    const limiter = new RateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(limiter.hit('k', 3, 60_000, t0)).toBe(true);
    expect(limiter.hit('k', 3, 60_000, t0 + 1)).toBe(false);
    expect(limiter.hit('k', 3, 60_000, t0 + 60_000)).toBe(true);
  });

  it('compte chaque clé séparément', () => {
    const limiter = new RateLimiter();
    expect(limiter.hit('a', 1, 1000, 0)).toBe(true);
    expect(limiter.hit('b', 1, 1000, 0)).toBe(true);
    expect(limiter.hit('a', 1, 1000, 1)).toBe(false);
  });
});
