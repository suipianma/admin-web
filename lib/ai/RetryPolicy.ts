export interface RetryPolicyConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const defaultStreamRetryPolicy: RetryPolicyConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

/** 指数退避 + 抖动 */
export function getBackoffDelay(
  attempt: number,
  policy: RetryPolicyConfig = defaultStreamRetryPolicy
): number {
  const exp = Math.min(
    policy.baseDelayMs * 2 ** Math.max(0, attempt - 1),
    policy.maxDelayMs
  );
  const jitter = Math.floor(Math.random() * 200);
  return exp + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
