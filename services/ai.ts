import { aiClient } from "@/lib/ai";
import type {
  ChatReplyResult,
  StreamChatRequest,
  StreamHandlers,
} from "@/lib/ai";

export type { ChatReplyResult, StreamHandlers };
export type StreamChatOptions = Omit<StreamChatRequest, "conversationId" | "content" | "handlers"> &
  StreamHandlers;

/** @deprecated 请优先使用 aiClient.streamChat */
export function streamChat(
  conversationId: number,
  content: string,
  options: StreamChatOptions
): () => void {
  const { onUpdate, onDone, onError, onToolCall, onToolResult, ...rest } =
    options;

  return aiClient.streamChat({
    conversationId,
    content,
    ...rest,
    handlers: {
      onUpdate,
      onDone,
      onError,
      onToolCall,
      onToolResult,
    },
  });
}

export { aiClient };
