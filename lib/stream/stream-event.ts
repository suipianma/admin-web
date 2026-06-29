import type { ApiError } from "@/utils/apiError";
import type {
  ChatReplyResult,
  StreamAgentStepPayload,
  StreamToolCallPayload,
  StreamToolResultPayload,
} from "@/lib/ai/types";

/** 流错误时可选回滚乐观消息 */
export interface StreamErrorRollback {
  userMsgId: number;
  assistantId: number;
}

export type StreamEvent =
  | {
      type: "message_delta";
      conversationId: number;
      assistantId: number;
      reply: ChatReplyResult;
    }
  | {
      type: "tool_call";
      conversationId: number;
      assistantId: number;
      payload: StreamToolCallPayload;
    }
  | {
      type: "tool_result";
      conversationId: number;
      assistantId: number;
      payload: StreamToolResultPayload;
    }
  | {
      type: "agent_step";
      conversationId: number;
      assistantId: number;
      payload: StreamAgentStepPayload;
    }
  | {
      type: "stream_meta";
      conversationId: number;
      streamId: string;
      seq?: number;
      requestId?: string;
      assistantId: number;
    }
  | {
      type: "stream_done";
      conversationId: number;
    }
  | {
      type: "rag_citations";
      conversationId: number;
      assistantId: number;
      citations: Array<{
        chunkId: number;
        documentName: string;
        page?: number | null;
        snippet: string;
        score: number;
      }>;
    }
  | {
      type: "stream_cancelled";
      conversationId: number;
    }
  | {
      type: "stream_error";
      conversationId: number;
      error: ApiError;
      rollback?: StreamErrorRollback;
    };

export type StreamEventHandler = (event: StreamEvent) => void;
