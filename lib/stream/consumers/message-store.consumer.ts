import type { AgentStepItem, ChatMessage } from "@/components/chat/ChatMessageItem";
import type { ChatStreamConsumerDeps } from "./types";
import type { StreamEvent } from "../stream-event";

/** 消息 UI：当前会话 pushStream，后台会话写 draft */
export function handleMessageStoreEvent(
  event: StreamEvent,
  deps: ChatStreamConsumerDeps
): void {
  if (event.type !== "message_delta") return;

  const { conversationId, assistantId, reply } = event;
  const meta = deps.streamMetaRef.current.get(conversationId);
  if (meta) meta.buffer = reply;

  if (deps.isViewingConversation(conversationId)) {
    deps.assistantIdRef.current = assistantId;
    deps.pushStream(reply);
    return;
  }

  deps.mutateDraftMessages(conversationId, (msgs) =>
    msgs.map((m) =>
      m.id === assistantId
        ? {
            ...m,
            thinking: reply.thinking ? reply.thinking : undefined,
            content: reply.response,
            fromCache: reply.fromCache,
          }
        : m
    )
  );
}
