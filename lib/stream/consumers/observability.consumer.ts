import type { StreamEvent } from "@/lib/stream/stream-event";
import { observabilityStore } from "@/lib/observability/observability-store";

/** Observability 消费者：聚合 requestId / latency / tokens / error rate */
export function handleObservabilityEvent(event: StreamEvent): void {
  observabilityStore.ingest(event);
}

export { observabilityStore } from "@/lib/observability/observability-store";
export type {
  ObservabilitySnapshot,
  ObservabilityTotals,
  StreamRunTrace,
  ToolCallTrace,
} from "@/lib/observability/observability-store";
