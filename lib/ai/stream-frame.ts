import type { StreamHandlers } from "./types";

/** SSE v2 事件信封 */
export interface StreamEventEnvelopeV2 {
  v: 2;
  type: string;
  payload: Record<string, unknown>;
  streamId?: string;
  requestId?: string;
  seq?: number;
  ts: number;
}

export interface RagCitationPayload {
  chunkId: number;
  documentName: string;
  page?: number | null;
  snippet: string;
  score: number;
}

export interface ParsedStreamFrame {
  thinking?: string;
  response?: string;
  thinkingDelta?: string;
  contentDelta?: string;
  error?: string;
  done?: boolean;
  fromCache?: boolean;
  promptTokens?: number;
  completionTokens?: number;
  phase?: string;
  tool?: string;
  args?: Record<string, string>;
  result?: string;
  step?: number;
  maxSteps?: number;
  steps?: number;
  streamId?: string;
  requestId?: string;
  toolCallId?: string;
  seq?: number;
  citations?: RagCitationPayload[];
}

function isEnvelopeV2(value: Record<string, unknown>): boolean {
  return value.v === 2 && typeof value.type === "string" && value.payload != null;
}

/** 解析 SSE 帧：兼容 v2 信封与旧版扁平 payload */
export function parseStreamFrame(raw: Record<string, unknown>): ParsedStreamFrame {
  if (isEnvelopeV2(raw)) {
    const envelope = raw as unknown as StreamEventEnvelopeV2;
    const payload = envelope.payload;
    const base: ParsedStreamFrame = {
      streamId: envelope.streamId,
      requestId: envelope.requestId,
      seq: envelope.seq,
    };

    switch (envelope.type) {
      case "stream_meta":
        return base;
      case "message_delta":
        return {
          ...base,
          thinkingDelta: payload.thinkingDelta as string | undefined,
          contentDelta: payload.contentDelta as string | undefined,
          thinking: payload.thinking as string | undefined,
          response: payload.response as string | undefined,
          fromCache: payload.fromCache as boolean | undefined,
          promptTokens: payload.promptTokens as number | undefined,
          completionTokens: payload.completionTokens as number | undefined,
        };
      case "tool_call":
        return {
          ...base,
          phase: "tool_call",
          tool: payload.tool as string,
          args: payload.args as Record<string, string>,
          step: payload.step as number | undefined,
          toolCallId: payload.toolCallId as string | undefined,
        };
      case "tool_result":
        return {
          ...base,
          phase: "tool_result",
          tool: payload.tool as string,
          result: payload.result as string,
          error: payload.error as string | undefined,
          step: payload.step as number | undefined,
          toolCallId: payload.toolCallId as string | undefined,
        };
      case "agent_step":
        return {
          ...base,
          phase: payload.phase as string,
          step: payload.step as number | undefined,
          maxSteps: payload.maxSteps as number | undefined,
          steps: payload.steps as number | undefined,
        };
      case "rag_citations":
        return {
          ...base,
          phase: "rag_citations",
          citations: payload.citations as RagCitationPayload[],
        };
      case "stream_done":
        return {
          ...base,
          done: true,
          thinking: payload.thinking as string | undefined,
          response: payload.response as string | undefined,
          fromCache: payload.fromCache as boolean | undefined,
          promptTokens: payload.promptTokens as number | undefined,
          completionTokens: payload.completionTokens as number | undefined,
        };
      case "stream_error":
        return {
          ...base,
          error: payload.error as string,
          done: true,
        };
      default:
        return base;
    }
  }

  return raw as ParsedStreamFrame;
}

/** 从 handlers 中取出帧级回调（供 StreamAdapter 使用） */
export function pickStreamFrameHandlers(handlers: StreamHandlers) {
  return {
    onUpdate: handlers.onUpdate,
    onDone: handlers.onDone,
    onError: handlers.onError,
    onToolCall: handlers.onToolCall,
    onToolResult: handlers.onToolResult,
    onAgentStep: handlers.onAgentStep,
    onStreamMeta: handlers.onStreamMeta,
    onRagCitations: handlers.onRagCitations,
  };
}
