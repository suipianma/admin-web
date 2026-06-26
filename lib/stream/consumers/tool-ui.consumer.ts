import type { ChatStreamConsumerDeps } from "./types";
import type { StreamEvent } from "../stream-event";

/** Tool 调用 UI 状态 */
export function handleToolUiEvent(
  event: StreamEvent,
  deps: ChatStreamConsumerDeps
): void {
  if (event.type === "tool_call") {
    const { conversationId, assistantId, payload } = event;
    const { tool, args } = payload;

    if (!deps.isViewingConversation(conversationId)) {
      deps.mutateDraftMessages(conversationId, (msgs) =>
        msgs.map((m) => {
          if (m.id !== assistantId) return m;
          const toolCalls = m.toolCalls ?? [];
          return {
            ...m,
            toolCalls: [...toolCalls, { tool, args, status: "calling" as const }],
          };
        })
      );
      return;
    }
    deps.appendToolCall(assistantId, tool, args);
    return;
  }

  if (event.type === "tool_result") {
    const { conversationId, assistantId, payload } = event;
    const { tool, result, error } = payload;

    if (!deps.isViewingConversation(conversationId)) {
      deps.mutateDraftMessages(conversationId, (msgs) =>
        msgs.map((m) => {
          if (m.id !== assistantId) return m;
          return {
            ...m,
            toolCalls: (m.toolCalls ?? []).map((item) =>
              item.tool === tool && item.status === "calling"
                ? {
                    ...item,
                    result,
                    status: error ? ("error" as const) : ("done" as const),
                  }
                : item
            ),
          };
        })
      );
      return;
    }
    deps.completeToolCall(assistantId, tool, result, error);
  }
}
