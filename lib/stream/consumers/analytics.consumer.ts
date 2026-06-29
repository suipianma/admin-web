import type { StreamEvent } from "../stream-event";

const devEventCounts = new Map<string, number>();

/** 埋点消费者：开发环境统计事件类型分布 */
export function handleAnalyticsEvent(event: StreamEvent): void {
  if (process.env.NODE_ENV !== "production") {
    devEventCounts.set(event.type, (devEventCounts.get(event.type) ?? 0) + 1);
  }
}

/** 开发环境读取事件计数 */
export function getAnalyticsEventCounts(): ReadonlyMap<string, number> {
  return devEventCounts;
}

