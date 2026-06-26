import { ApiError } from "@/utils/apiError";
import type { AIErrorKind } from "./types";

export function classifyAIError(error: unknown): AIErrorKind {
  if (!(error instanceof ApiError)) {
    return "unknown";
  }
  const status = error.status ?? error.code;
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth";
  if (status != null && status >= 500) return "server";
  if (error.message.includes("SSE") || error.message.includes("连接")) {
    return "network";
  }
  return "unknown";
}

/** 统一 AI 层错误，供 UI 展示 */
export function normalizeAIError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof Error) {
    return new ApiError(error.message);
  }
  return new ApiError("AI 请求失败");
}

export function isRetryableAIError(error: unknown): boolean {
  const kind = classifyAIError(error);
  return kind === "timeout" || kind === "rate_limit" || kind === "network";
}

export function isRateLimitError(error: unknown): boolean {
  return classifyAIError(error) === "rate_limit";
}
