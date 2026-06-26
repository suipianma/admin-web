import type { StreamEvent } from "../stream-event";

/** 埋点消费者（stub）：后续对接 analytics SDK */
export function handleAnalyticsEvent(_event: StreamEvent): void {
  if (process.env.NODE_ENV !== "development") return;
  // 开发环境可观察事件流，生产环境由 SDK 接管
}
