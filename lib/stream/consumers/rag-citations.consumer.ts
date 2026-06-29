import type { ChatStreamConsumerDeps } from "./types";
import type { StreamEvent } from "../stream-event";

/** RAG 引用块：写入消息 citations */
export function handleRagCitationsEvent(
  event: StreamEvent,
  deps: ChatStreamConsumerDeps
): void {
  if (event.type !== "rag_citations") return;

  const { conversationId, assistantId, citations } = event;

  if (!deps.isViewingConversation(conversationId)) {
    deps.mutateDraftMessages(conversationId, (msgs) =>
      msgs.map((m) => (m.id === assistantId ? { ...m, citations } : m))
    );
    return;
  }

  deps.updateMessage(assistantId, { citations });
}
