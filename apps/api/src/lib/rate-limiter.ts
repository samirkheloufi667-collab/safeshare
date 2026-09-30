/**
 * Compteur à fenêtre fixe, en mémoire.
 *
 * Suffisant pour une seule instance de l'API. Avec plusieurs instances
 * derrière un répartiteur de charge, il faudrait le partager (Redis).
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  /** Compte un essai et indique s'il reste sous la limite. */
  hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      this.sweep(now);
      return true;
    }
    window.count += 1;
    return window.count <= limit;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  private sweep(now: number) {
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

export const limiter = new RateLimiter();
