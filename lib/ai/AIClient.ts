import {
  AI_FALLBACK_MODEL,
  AI_STREAM_CONCURRENCY,
  AI_STREAM_TIMEOUT_MS,
  API_BASE,
} from "@/config/api";
import { ApiError } from "@/utils/apiError";
import { CircuitBreaker } from "./CircuitBreaker";
import { isRetryableAIError } from "./ErrorNormalizer";
import { RequestQueue } from "./RequestQueue";
import {
  defaultStreamRetryPolicy,
  getBackoffDelay,
  sleep,
} from "./RetryPolicy";
import { buildStreamUrl, createStreamAdapter } from "./StreamAdapter";
import type { StreamChatRequest } from "./types";

export class AIClient {
  private readonly queue: RequestQueue;
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly baseUrl: string = API_BASE,
    concurrency = AI_STREAM_CONCURRENCY
  ) {
    this.queue = new RequestQueue(concurrency);
    this.breaker = new CircuitBreaker();
  }

  /** 流式对话：队列 + 熔断 + 连接失败指数退避重试 */
  streamChat(request: StreamChatRequest): () => void {
    let aborted = false;
    let cleanup: (() => void) | null = null;
    let attempt = 0;

    const stop = () => {
      aborted = true;
      cleanup?.();
      cleanup = null;
    };

    const connect = async (): Promise<void> => {
      if (aborted) return;

      if (!this.breaker.canRequest()) {
        request.handlers.onError(
          new ApiError("AI 服务繁忙，请稍后再试", {
            code: 503,
            status: 503,
          })
        );
        return;
      }

      await this.queue.run(`stream-${request.conversationId}`, () =>
        new Promise<void>((resolve) => {
          if (aborted) {
            resolve();
            return;
          }

          const useFallback =
            attempt > 0 && Boolean(request.model ?? AI_FALLBACK_MODEL);
          const model = useFallback
            ? request.model ?? AI_FALLBACK_MODEL
            : undefined;

          const url = buildStreamUrl(this.baseUrl, {
            conversationId: request.conversationId,
            content: request.content,
            promptId: request.promptId,
            knowledgeBaseIds: request.knowledgeBaseIds,
            regenerate: request.regenerate,
            model,
          });

          let connectionFailed = false;

          cleanup = createStreamAdapter({
            url,
            timeoutMs: AI_STREAM_TIMEOUT_MS,
            handlers: {
              ...request.handlers,
              onDone: () => {
                this.breaker.recordSuccess();
                request.handlers.onDone();
                resolve();
              },
              onError: (error) => {
                if (connectionFailed) {
                  resolve();
                  return;
                }
                this.breaker.recordFailure();
                request.handlers.onError(error);
                resolve();
              },
            },
            onConnectionFailed: (error) => {
              connectionFailed = true;
              cleanup?.();
              cleanup = null;

              if (
                !aborted &&
                isRetryableAIError(error) &&
                attempt < defaultStreamRetryPolicy.maxRetries
              ) {
                attempt += 1;
                const delay = getBackoffDelay(attempt, defaultStreamRetryPolicy);
                void sleep(delay).then(() => {
                  void connect().then(resolve);
                });
                return;
              }

              this.breaker.recordFailure();
              request.handlers.onError(error);
              resolve();
            },
          });
        })
      );
    };

    void connect();
    return stop;
  }

  getQueueStats() {
    return {
      active: this.queue.activeCount,
      pending: this.queue.pendingCount,
    };
  }
}

export const aiClient = new AIClient();
