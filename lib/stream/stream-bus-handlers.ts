import type { StreamHandlers } from "@/lib/ai/types";
import type { StreamEventBus } from "./stream-event-bus";
import type { StreamErrorRollback } from "./stream-event";

export interface StreamBusHandlerContext {
  conversationId: number;
  assistantId: number;
  rollback?: StreamErrorRollback;
}

/** 将 StreamAdapter 回调桥接为 Bus 事件 */
export function createStreamBusHandlers(
  bus: StreamEventBus,
  ctx: StreamBusHandlerContext
): StreamHandlers {
  const { conversationId, assistantId, rollback } = ctx;

  return {
    onUpdate: (reply) => {
      bus.emit({ type: "message_delta", conversationId, assistantId, reply });
    },
    onToolCall: (payload) => {
      bus.emit({ type: "tool_call", conversationId, assistantId, payload });
    },
    onToolResult: (payload) => {
      bus.emit({ type: "tool_result", conversationId, assistantId, payload });
    },
    onAgentStep: (payload) => {
      bus.emit({ type: "agent_step", conversationId, assistantId, payload });
    },
    onStreamMeta: ({ streamId, seq, requestId }) => {
      bus.emit({
        type: "stream_meta",
        conversationId,
        assistantId,
        streamId,
        seq,
        requestId,
      });
    },
    onDone: () => {
      bus.emit({ type: "stream_done", conversationId });
    },
    onError: (error) => {
      bus.emit({
        type: "stream_error",
        conversationId,
        error,
        rollback,
      });
    },
  };
}
