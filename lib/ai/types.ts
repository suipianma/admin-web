import type { ApiError } from "@/utils/apiError";

export interface ChatReplyResult {
  thinking: string;
  response: string;
  fromCache?: boolean;
  promptTokens?: number;
  completionTokens?: number;
}

export interface StreamToolCallPayload {
  tool: string;
  args: Record<string, string>;
  step?: number;
  toolCallId?: string;
}

export interface StreamToolResultPayload {
  tool: string;
  result: string;
  error?: string;
  step?: number;
  toolCallId?: string;
}

export interface StreamAgentStepPayload {
  phase: "agent_start" | "agent_step" | "agent_done";
  step?: number;
  maxSteps?: number;
  steps?: number;
}

export interface StreamHandlers {
  onUpdate: (reply: ChatReplyResult) => void;
  onDone: () => void;
  onError: (error: ApiError) => void;
  onToolCall?: (payload: StreamToolCallPayload) => void;
  onToolResult?: (payload: StreamToolResultPayload) => void;
  onAgentStep?: (payload: StreamAgentStepPayload) => void;
  onStreamMeta?: (meta: {
    streamId: string;
    seq?: number;
    requestId?: string;
  }) => void;
  onStreamInterrupted?: (streamId: string) => void;
  onRagCitations?: (
    citations: Array<{
      chunkId: number;
      documentName: string;
      page?: number | null;
      snippet: string;
      score: number;
    }>
  ) => void;
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
