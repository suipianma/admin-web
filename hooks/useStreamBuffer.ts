import { useCallback, useRef } from "react";
import type { ChatReplyResult } from "@/services/ai";

const FLUSH_INTERVAL_MS = 50;

/** SSE 流式更新批量合并，降低 setState 频率 */
export function useStreamBuffer(onFlush: (reply: ChatReplyResult) => void) {
  const bufferRef = useRef<ChatReplyResult>({ thinking: "", response: "" });
  const timerRef = useRef<number | null>(null);
  const fromCacheRef = useRef(false);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onFlush({ ...bufferRef.current, fromCache: fromCacheRef.current });
    }, FLUSH_INTERVAL_MS);
  }, [onFlush]);

  const push = useCallback(
    (reply: ChatReplyResult) => {
      bufferRef.current = {
        thinking: reply.thinking,
        response: reply.response,
      };
      if (reply.fromCache) fromCacheRef.current = true;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const flushNow = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onFlush({ ...bufferRef.current, fromCache: fromCacheRef.current });
  }, [onFlush]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    bufferRef.current = { thinking: "", response: "" };
    fromCacheRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { push, flushNow, reset, cancel };
}
