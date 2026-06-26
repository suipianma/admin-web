import type { MutableRefObject } from "react";
import type { MessageInstance } from "antd/es/message/interface";
import type { AgentStepItem, ChatMessage } from "@/components/chat/ChatMessageItem";

export interface StreamMeta {
  assistantId: number;
  userMsgId?: number;
  buffer: { thinking: string; response: string; fromCache?: boolean };
}

export interface ChatStreamConsumerDeps {
  isViewingConversation: (conversationId: number) => boolean;
  streamMetaRef: MutableRefObject<Map<number, StreamMeta>>;
  assistantIdRef: MutableRefObject<number | null>;
  streamIdsRef: MutableRefObject<Map<number, string>>;
  streamStopsRef: MutableRefObject<Map<number, () => void>>;
  pushStream: (reply: {
    thinking: string;
    response: string;
    fromCache?: boolean;
  }) => void;
  mutateDraftMessages: (
    conversationId: number,
    updater: (msgs: ChatMessage[]) => ChatMessage[]
  ) => void;
  appendToolCall: (
    assistantId: number,
    tool: string,
    args: Record<string, string>
  ) => void;
  completeToolCall: (
    assistantId: number,
    tool: string,
    result: string,
    error?: string
  ) => void;
  appendAgentStep: (assistantId: number, item: AgentStepItem) => void;
  flushNow: () => void;
  clearStreamingState: (conversationId: number) => void;
  finishStreamForConversation: (conversationId: number) => void;
  cancelStream: () => void;
  resetStream: () => void;
  removeMessages: (ids: number[]) => void;
  syncFromServer: (conversationId: number) => Promise<void>;
  saveActiveStream: (conversationId: number, streamId: string) => void;
  message: MessageInstance;
  limitErrorMsg: string;
}
