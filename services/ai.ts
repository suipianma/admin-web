import {
  AI_STREAM_TIMEOUT_MS,
  API_BASE,
} from "@/config/api";
import { getToken } from "@/utils/auth";
import { ApiError } from "@/utils/apiError";
import { playCacheTypewriter } from "@/utils/cacheTypewriter";

export interface ChatReplyResult {
  thinking: string;
  response: string;
  fromCache?: boolean;
}

export interface StreamChatOptions {
  onUpdate: (reply: ChatReplyResult) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  promptId?: string;
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
  done?: boolean;
  fromCache?: boolean;
}): ChatReplyResult {
  if (raw.error) {
    throw new Error(raw.error);
  }

  return {
    thinking: cleanText(raw.thinking ?? ""),
    response: cleanReplyText(raw.response ?? ""),
    fromCache: raw.fromCache,
  };
}

// Nest SSE：GET /conversations/:id/stream?content=xxx&token=JWT
export function streamChat(
  conversationId: number,
  content: string,
  { onUpdate, onDone, onError, promptId }: StreamChatOptions
): () => void {
  const token = getToken();
  const params = new URLSearchParams({ content });
  if (promptId) {
    params.set("promptId", promptId);
  }
  // EventSource 无法带 Authorization header，token 放 query
  if (token) {
    params.set("token", token);
  }

  const url = `${API_BASE}/conversations/${conversationId}/stream?${params.toString()}`;
  const es = new EventSource(url);
  let finished = false;
  let completed = false;
  let cancelTypewriter: (() => void) | null = null;
  let accThinking = "";
  let accResponse = "";

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
  }, AI_STREAM_TIMEOUT_MS);

  es.onmessage = (event) => {
    try {
      let parsed = JSON.parse(event.data) as {
        thinking?: string;
        response?: string;
        thinkingDelta?: string;
        contentDelta?: string;
        error?: string;
        done?: boolean;
        fromCache?: boolean;
        data?: {
          thinking?: string;
          response?: string;
          thinkingDelta?: string;
          contentDelta?: string;
          error?: string;
          done?: boolean;
          fromCache?: boolean;
        };
      };

      if (parsed.data && typeof parsed.data === "object") {
        parsed = parsed.data;
      }

      if (parsed.error) {
        finished = true;
        window.clearTimeout(timeoutTimer);
        es.close();
        onError(new ApiError(parsed.error));
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
      // 连接正常关闭但未收到 done：用已有内容结束，避免误报错
      onUpdate(
        normalizeReply({
          thinking: accThinking,
          response: accResponse,
        })
      );
      finishStream();
      return;
    }

    onError(
      new ApiError(
        wasConnecting
          ? "无法建立 SSE 连接，请检查是否已登录、API 地址与 CORS 配置"
          : "AI 流式响应中断，请稍后重试或更换模型（如 qwen3:8b）"
      )
    );
  };

  return () => {
    finished = true;
    completed = true;
    window.clearTimeout(timeoutTimer);
    es.close();
    cancelTypewriter?.();
  };
}
