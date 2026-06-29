import { AI_STREAM_TIMEOUT_MS, API_BASE } from "@/config/api";
import { ApiError } from "@/utils/apiError";
import { playCacheTypewriter } from "@/utils/cacheTypewriter";
import { parseStreamFrame } from "./stream-frame";
import type { StreamHandlers } from "./types";

export interface StreamAdapterOptions {
  url: string;
  timeoutMs?: number;
  handlers: StreamHandlers;
  onConnectionFailed?: (error: ApiError) => void;
}

function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function cleanReplyText(text: string): string {
  const closeTag = "</" + "think>";
  const closeIndex = text.indexOf(closeTag);
  if (closeIndex !== -1) {
    return text.slice(closeIndex + closeTag.length).trim();
  }
  return text.trim();
}

function normalizeReply(raw: {
  thinking?: string;
  response?: string;
  error?: string;
  fromCache?: boolean;
  promptTokens?: number;
  completionTokens?: number;
}) {
  if (raw.error) {
    throw new Error(raw.error);
  }
  return {
    thinking: cleanText(raw.thinking ?? ""),
    response: cleanReplyText(raw.response ?? ""),
    fromCache: raw.fromCache,
    promptTokens: raw.promptTokens,
    completionTokens: raw.completionTokens,
  };
}

/** EventSource SSE 适配器：解析帧并回调 handlers */
export function createStreamAdapter({
  url,
  timeoutMs = AI_STREAM_TIMEOUT_MS,
  handlers,
  onConnectionFailed,
}: StreamAdapterOptions): () => void {
  const es = new EventSource(url);
  let finished = false;
  let completed = false;
  let hasReceivedData = false;
  let cancelTypewriter: (() => void) | null = null;
  let accThinking = "";
  let accResponse = "";
  let streamId: string | undefined;

  const {
    onUpdate,
    onDone,
    onError,
    onToolCall,
    onToolResult,
    onAgentStep,
    onStreamMeta,
    onStreamInterrupted,
    onRagCitations,
  } = handlers;

  const finishStream = () => {
    if (completed) return;
    completed = true;
    finished = true;
    window.clearTimeout(timeoutTimer);
    es.close();
    onDone();
  };

  const timeoutTimer = window.setTimeout(() => {
    if (!finished) {
      finished = true;
      es.close();
      onError(
        new ApiError("AI 流式响应超时", {
          code: 408,
          status: 408,
        })
      );
    }
  }, timeoutMs);

  es.onmessage = (event) => {
    try {
      hasReceivedData = true;
      let parsed = JSON.parse(event.data) as Record<string, unknown>;

      if (
        parsed.v !== 2 &&
        parsed.data &&
        typeof parsed.data === "object"
      ) {
        parsed = parsed.data as Record<string, unknown>;
      }

      const frame = parseStreamFrame(parsed);

      if (frame.streamId) {
        streamId = frame.streamId;
        onStreamMeta?.({
          streamId: frame.streamId,
          seq: frame.seq,
          requestId: frame.requestId,
        });
      } else if (frame.requestId) {
        onStreamMeta?.({
          streamId: streamId ?? "",
          requestId: frame.requestId,
          seq: frame.seq,
        });
      }

      if (frame.error) {
        finished = true;
        window.clearTimeout(timeoutTimer);
        es.close();
        onError(new ApiError(frame.error));
        return;
      }

      if (frame.phase === "rag_citations" && frame.citations?.length) {
        onRagCitations?.(frame.citations);
        return;
      }

      if (
        frame.phase === "agent_start" ||
        frame.phase === "agent_step" ||
        frame.phase === "agent_done"
      ) {
        onAgentStep?.({
          phase: frame.phase,
          step: frame.step,
          maxSteps: frame.maxSteps,
          steps: frame.steps,
        });
        return;
      }

      if (frame.phase === "tool_call" && frame.tool && frame.args) {
        onToolCall?.({
          tool: frame.tool,
          args: frame.args,
          step: frame.step,
          toolCallId: frame.toolCallId,
        });
        return;
      }

      if (frame.phase === "tool_result" && frame.tool && frame.result) {
        onToolResult?.({
          tool: frame.tool,
          result: frame.result,
          error: frame.error,
          step: frame.step,
          toolCallId: frame.toolCallId,
        });
        return;
      }

      if (frame.thinkingDelta) accThinking += frame.thinkingDelta;
      if (frame.contentDelta) accResponse += frame.contentDelta;
      if (frame.thinking !== undefined) accThinking = frame.thinking;
      if (frame.response !== undefined) accResponse = frame.response;

      const reply = normalizeReply({
        thinking: accThinking,
        response: accResponse,
        fromCache: frame.fromCache,
        promptTokens: frame.promptTokens,
        completionTokens: frame.completionTokens,
      });

      if (frame.done && reply.fromCache) {
        finished = true;
        completed = true;
        window.clearTimeout(timeoutTimer);
        es.close();
        cancelTypewriter = playCacheTypewriter(reply, { onUpdate, onDone });
        return;
      }

      onUpdate(reply);

      if (frame.done) {
        finishStream();
      }
    } catch {
      onUpdate({
        thinking: "",
        response: cleanReplyText(event.data),
      });
    }
  };

  es.onerror = () => {
    window.clearTimeout(timeoutTimer);
    if (finished || completed) return;

    const wasConnecting = es.readyState === EventSource.CONNECTING;
    es.close();
    finished = true;

    if (!wasConnecting && (accThinking || accResponse)) {
      if (streamId && onStreamInterrupted) {
        onStreamInterrupted(streamId);
        return;
      }

      onUpdate(
        normalizeReply({
          thinking: accThinking,
          response: accResponse,
        })
      );
      finishStream();
      return;
    }

    const err = new ApiError(
      wasConnecting
        ? "无法建立 SSE 连接，请检查是否已登录、API 地址与 CORS 配置"
        : "AI 流式响应中断，请稍后重试或更换模型（如 qwen3:8b）",
      { status: wasConnecting ? 0 : 500 }
    );

    if (wasConnecting && !hasReceivedData && onConnectionFailed) {
      onConnectionFailed(err);
      return;
    }

    onError(err);
  };

  return () => {
    finished = true;
    completed = true;
    window.clearTimeout(timeoutTimer);
    es.close();
    cancelTypewriter?.();
  };
}

export function buildStreamUrl(
  baseUrl: string,
  request: {
    conversationId: number;
    content?: string;
    resumeStreamId?: string;
    promptId?: string;
    knowledgeBaseIds?: number[];
    regenerate?: boolean;
    model?: string;
    streamTicket: string;
  }
): string {
  const params = new URLSearchParams();

  if (request.resumeStreamId) {
    params.set("streamId", request.resumeStreamId);
  } else if (request.content) {
    params.set("content", request.content);
  }

  if (request.promptId) params.set("promptId", request.promptId);
  if (request.knowledgeBaseIds?.length) {
    params.set("knowledgeBaseIds", request.knowledgeBaseIds.join(","));
  }
  if (request.regenerate) params.set("regenerate", "1");
  if (request.model) params.set("model", request.model);

  const ticket = request.streamTicket?.trim();
  if (!ticket) {
    throw new ApiError("缺少流式 ticket，请重新登录后重试", { status: 401 });
  }
  params.set("ticket", ticket);

  return `${baseUrl}/conversations/${request.conversationId}/stream?${params.toString()}`;
}
