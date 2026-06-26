import { AI_STREAM_TIMEOUT_MS, API_BASE } from "@/config/api";
import { getToken } from "@/utils/auth";
import { ApiError } from "@/utils/apiError";
import { playCacheTypewriter } from "@/utils/cacheTypewriter";
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
}) {
  if (raw.error) {
    throw new Error(raw.error);
  }
  return {
    thinking: cleanText(raw.thinking ?? ""),
    response: cleanReplyText(raw.response ?? ""),
    fromCache: raw.fromCache,
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

  const { onUpdate, onDone, onError, onToolCall, onToolResult } = handlers;

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
      let parsed = JSON.parse(event.data) as {
        thinking?: string;
        response?: string;
        thinkingDelta?: string;
        contentDelta?: string;
        error?: string;
        done?: boolean;
        fromCache?: boolean;
        phase?: "tool_call" | "tool_result";
        tool?: string;
        args?: Record<string, string>;
        result?: string;
        step?: number;
        data?: Record<string, unknown>;
      };

      if (parsed.data && typeof parsed.data === "object") {
        parsed = parsed.data as typeof parsed;
      }

      if (parsed.error) {
        finished = true;
        window.clearTimeout(timeoutTimer);
        es.close();
        onError(new ApiError(parsed.error));
        return;
      }

      if (parsed.phase === "tool_call" && parsed.tool && parsed.args) {
        onToolCall?.({
          tool: parsed.tool,
          args: parsed.args,
          step: parsed.step,
        });
        return;
      }

      if (parsed.phase === "tool_result" && parsed.tool && parsed.result) {
        onToolResult?.({
          tool: parsed.tool,
          result: parsed.result,
          error: parsed.error,
          step: parsed.step,
        });
        return;
      }

      if (parsed.thinkingDelta) accThinking += parsed.thinkingDelta;
      if (parsed.contentDelta) accResponse += parsed.contentDelta;
      if (parsed.thinking !== undefined) accThinking = parsed.thinking;
      if (parsed.response !== undefined) accResponse = parsed.response;

      const reply = normalizeReply({
        thinking: accThinking,
        response: accResponse,
        fromCache: parsed.fromCache,
      });

      if (parsed.done && reply.fromCache) {
        finished = true;
        completed = true;
        window.clearTimeout(timeoutTimer);
        es.close();
        cancelTypewriter = playCacheTypewriter(reply, { onUpdate, onDone });
        return;
      }

      onUpdate(reply);

      if (parsed.done) {
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
    content: string;
    promptId?: string;
    knowledgeBaseIds?: number[];
    regenerate?: boolean;
    model?: string;
  }
): string {
  const token = getToken();
  const params = new URLSearchParams({ content: request.content });
  if (request.promptId) params.set("promptId", request.promptId);
  if (request.knowledgeBaseIds?.length) {
    params.set("knowledgeBaseIds", request.knowledgeBaseIds.join(","));
  }
  if (request.regenerate) params.set("regenerate", "1");
  if (request.model) params.set("model", request.model);
  if (token) params.set("token", token);

  return `${baseUrl}/conversations/${request.conversationId}/stream?${params.toString()}`;
}
