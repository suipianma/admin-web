export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export const USER_ID_HEADER = "x-user-id";

// 默认 HTTP 超时
export const DEFAULT_TIMEOUT_MS = 10_000;

// AI 非流式接口超时
export const AI_CHAT_TIMEOUT_MS = 120_000;

// AI SSE 流式最长等待时间
export const AI_STREAM_TIMEOUT_MS = 300_000;

// 同时进行的 SSE 流数量上限
export const AI_STREAM_CONCURRENCY = 2;

// 连接失败重试时的降级模型（需后端支持 model 查询参数）
export const AI_FALLBACK_MODEL =
  process.env.NEXT_PUBLIC_AI_FALLBACK_MODEL || "";
