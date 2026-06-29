import type { StreamEvent } from "../stream-event";
import { observabilityStore } from "@/lib/observability/observability-store";

/** Debug 事件流：复用 Observability Store 的 recentEvents */
export function handleDebugLogEvent(_event: StreamEvent): void {
  // 由 observability consumer 统一 ingest，避免双缓冲
}

/** 读取最近事件（与 Observability Panel 事件流一致） */
export function getStreamDebugLog(): readonly StreamEvent[] {
  return observabilityStore.getSnapshot().recentEvents;
}

export function clearStreamDebugLog(): void {
  observabilityStore.clear();
}
