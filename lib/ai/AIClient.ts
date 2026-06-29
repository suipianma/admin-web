import {
  AI_FALLBACK_MODEL,
  AI_STREAM_CONCURRENCY,
  AI_STREAM_TIMEOUT_MS,
  API_BASE,
} from "@/config/api";
import { ApiError } from "@/utils/apiError";
import {
  clearActiveStream,
  saveActiveStream,
} from "@/utils/streamSessionStorage";
import { createStreamTicket } from "@/services/conversation";
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

const MAX_STREAM_RESUME_RETRIES = 3;

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

  streamChat(request: StreamChatRequest): () => void {
    let aborted = false;
    let cleanup: (() => void) | null = null;
    let connectAttempt = 0;
    let resumeAttempt = 0;
    let resumeStreamId: string | undefined = request.resumeStreamId;

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

      if (!resumeStreamId && !request.content?.trim()) {
        request.handlers.onError(new ApiError("消息内容不能为空"));
        return;
      }

      await this.queue.run(`stream-${request.conversationId}`, () =>
        new Promise<void>((resolve) => {
          if (aborted) {
            resolve();
            return;
          }

          const useFallback =
            connectAttempt > 0 && Boolean(request.model ?? AI_FALLBACK_MODEL);
          const model = useFallback
            ? request.model ?? AI_FALLBACK_MODEL
            : request.model;

          void createStreamTicket(request.conversationId)
            .then((ticketRes) => {
              if (aborted) {
                resolve();
                return;
              }

              const url = buildStreamUrl(this.baseUrl, {
                conversationId: request.conversationId,
                content: resumeStreamId ? undefined : request.content,
                resumeStreamId,
                promptId: request.promptId,
                knowledgeBaseIds: request.knowledgeBaseIds,
                regenerate: request.regenerate,
                model,
                streamTicket: ticketRes.data.ticket,
              });

              let connectionFailed = false;

              cleanup = createStreamAdapter({
                url,
                timeoutMs: AI_STREAM_TIMEOUT_MS,
                handlers: {
                  ...request.handlers,
                  onStreamMeta: (meta) => {
                    resumeStreamId = meta.streamId;
                    saveActiveStream(request.conversationId, meta.streamId);
                    request.handlers.onStreamMeta?.(meta);
                  },
                  onStreamInterrupted: (streamId) => {
                    cleanup?.();
                    cleanup = null;

                    if (
                      !aborted &&
                      resumeAttempt < MAX_STREAM_RESUME_RETRIES
                    ) {
                      resumeAttempt += 1;
                      resumeStreamId = streamId;
                      const delay = getBackoffDelay(
                        resumeAttempt,
                        defaultStreamRetryPolicy
                      );
                      void sleep(delay).then(() => {
                        void connect().then(resolve);
                      });
                      return;
                    }

                    request.handlers.onError(
                      new ApiError("AI 流式响应中断，请稍后重试", { status: 500 })
                    );
                    resolve();
                  },
                  onDone: () => {
                    this.breaker.recordSuccess();
                    clearActiveStream();
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
                    connectAttempt < defaultStreamRetryPolicy.maxRetries
                  ) {
                    connectAttempt += 1;
                    const delay = getBackoffDelay(
                      connectAttempt,
                      defaultStreamRetryPolicy
                    );
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
            .catch((err) => {
              this.breaker.recordFailure();
              request.handlers.onError(
                err instanceof ApiError
                  ? err
                  : new ApiError("申请流式 ticket 失败", { status: 401 })
              );
              resolve();
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
