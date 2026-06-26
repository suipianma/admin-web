export interface CircuitBreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
}

const defaultOptions: CircuitBreakerOptions = {
  failureThreshold: 3,
  cooldownMs: 30_000,
};

/** 简易熔断：连续失败后短时拒绝新请求 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  canRequest(): boolean {
    if (this.failures < this.options.failureThreshold) return true;
    if (Date.now() - this.openedAt >= this.options.cooldownMs) {
      this.failures = 0;
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.options.failureThreshold) {
      this.openedAt = Date.now();
    }
  }
}
