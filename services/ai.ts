import {
  AI_STREAM_TIMEOUT_MS,
  API_BASE,
} from "@/config/api";
import { getUserInfo } from "@/utils/auth";
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

// Nest SSE：GET /ai/stream?prompt=xxx&userId=xxx
export function streamChat(
  prompt: string,
  { onUpdate, onDone, onError }: StreamChatOptions
): () => void {
  const userId = getUserInfo()?.userId;
  const params = new URLSearchParams({ prompt });
  if (userId) {
    params.set("userId", String(userId));
  }

  const url = `${API_BASE}/ai/stream?${params.toString()}`;
  const es = new EventSource(url);
  let finished = false;
  let cancelTypewriter: (() => void) | null = null;

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
        error?: string;
        done?: boolean;
        data?: {
          thinking?: string;
          response?: string;
          error?: string;
          done?: boolean;
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

      const reply = normalizeReply(parsed);

      if (parsed.done && reply.fromCache) {
        finished = true;
        window.clearTimeout(timeoutTimer);
        es.close();
        cancelTypewriter = playCacheTypewriter(reply, { onUpdate, onDone });
        return;
      }

      onUpdate(reply);

      if (parsed.done) {
        finished = true;
        window.clearTimeout(timeoutTimer);
        es.close();
        onDone();
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
    es.close();
    if (!finished) {
      onError(new ApiError("SSE 连接中断"));
    }
  };

  return () => {
    finished = true;
    window.clearTimeout(timeoutTimer);
    es.close();
    cancelTypewriter?.();
  };
}
