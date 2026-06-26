import type { ApiError } from "@/utils/apiError";

export interface ChatReplyResult {
  thinking: string;
  response: string;
  fromCache?: boolean;
}

export interface StreamToolCallPayload {
  tool: string;
  args: Record<string, string>;
  step?: number;
}

export interface StreamToolResultPayload {
  tool: string;
  result: string;
  error?: string;
  step?: number;
}

export interface StreamHandlers {
  onUpdate: (reply: ChatReplyResult) => void;
  onDone: () => void;
  onError: (error: ApiError) => void;
  onToolCall?: (payload: StreamToolCallPayload) => void;
  onToolResult?: (payload: StreamToolResultPayload) => void;
  onStreamMeta?: (meta: { streamId: string; seq?: number }) => void;
  onStreamInterrupted?: (streamId: string) => void;
}

export interface StreamChatRequest {
  conversationId: number;
  content?: string;
  resumeStreamId?: string;
  promptId?: string;
  knowledgeBaseIds?: number[];
  regenerate?: boolean;
  model?: string;
  handlers: StreamHandlers;
}

export type AIErrorKind =
  | "timeout"
  | "rate_limit"
  | "network"
  | "auth"
  | "server"
  | "circuit_open"
  | "stream_abort"
  | "unknown";
