import { useCallback, useEffect, useRef } from "react";

const BOTTOM_THRESHOLD = 80;
const SCROLL_THROTTLE_MS = 100;

/** 仅当用户在底部附近时，节流自动滚到底部 */
export function useChatAutoScroll(containerRef: React.RefObject<HTMLElement | null>) {
  const userPinnedRef = useRef(false);
  const throttleTimerRef = useRef<number | null>(null);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      userPinnedRef.current = !isNearBottom();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, isNearBottom]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = containerRef.current;
      if (!el || userPinnedRef.current) return;

      if (throttleTimerRef.current) {
        window.clearTimeout(throttleTimerRef.current);
      }

      throttleTimerRef.current = window.setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior });
        throttleTimerRef.current = null;
      }, SCROLL_THROTTLE_MS);
    },
    [containerRef]
  );

  const forceScrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    userPinnedRef.current = false;
    el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [containerRef]);

  return { scrollToBottom, forceScrollToBottom };
}
