export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export const USER_ID_HEADER = "x-user-id";

// 默认 HTTP 超时
export const DEFAULT_TIMEOUT_MS = 10_000;

// AI 非流式接口超时
export const AI_CHAT_TIMEOUT_MS = 120_000;

// AI SSE 流式最长等待时间
export const AI_STREAM_TIMEOUT_MS = 300_000;
