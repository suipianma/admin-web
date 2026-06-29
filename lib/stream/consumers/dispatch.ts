import { handleAgentTimelineEvent } from "./agent-timeline.consumer";
import { handleAnalyticsEvent } from "./analytics.consumer";
import { handleRagCitationsEvent } from "./rag-citations.consumer";
import { handleObservabilityEvent } from "./observability.consumer";
import { handleDebugLogEvent } from "./debug-log.consumer";
import { handleMessageStoreEvent } from "./message-store.consumer";
import { handleStreamLifecycleEvent } from "./stream-lifecycle.consumer";
import { handleToolUiEvent } from "./tool-ui.consumer";
import type { ChatStreamConsumerDeps } from "./types";
import type { StreamEvent } from "../stream-event";

/** 按序分发给各消费者 */
export function dispatchStreamEvent(
  event: StreamEvent,
  deps: ChatStreamConsumerDeps
): void {
  handleMessageStoreEvent(event, deps);
  handleRagCitationsEvent(event, deps);
  handleToolUiEvent(event, deps);
  handleAgentTimelineEvent(event, deps);
  handleStreamLifecycleEvent(event, deps);
  handleObservabilityEvent(event);
  handleAnalyticsEvent(event);
  handleDebugLogEvent(event);
}

export type { ChatStreamConsumerDeps, StreamMeta } from "./types";
