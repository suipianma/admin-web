"use client";

import { useEffect, useRef, useState } from "react";
import { Spin } from "antd";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import ChatMessageItem, { type ChatMessage } from "./ChatMessageItem";
import { resolveActiveNavIdFromViewport } from "./ChatMessageNavigator";

export interface ChatMessageScrollApi {
  scrollToMessageId: (messageId: number) => void;
  scrollToBottom: () => void;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  firstItemIndex: number;
  streaming: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  userAvatarText: string;
  onLoadOlder: () => void;
  scrollApiRef?: React.MutableRefObject<ChatMessageScrollApi | null>;
  onActiveNavChange?: (messageId: number | null) => void;
  onAtBottomChange?: (isAtBottom: boolean) => void;
}

export default function ChatMessageList({
  messages,
  firstItemIndex,
  streaming,
  loadingMore,
  hasMore,
  userAvatarText,
  onLoadOlder,
  scrollApiRef,
  onActiveNavChange,
  onAtBottomChange,
}: ChatMessageListProps) {
  const listRef = useRef<VirtuosoHandle>(null);
  const [scrollerEl, setScrollerEl] = useState<HTMLElement | null>(null);
  const atBottomRef = useRef(true);
  // 流式期间用户主动上滑则暂停跟随
  const userScrolledUpRef = useRef(false);
  const prevLenRef = useRef(0);
  const prevFirstIdxRef = useRef(firstItemIndex);
  // 导航跳转：等待 Virtuoso 测量高度后再精确对齐
  const pendingScrollRef = useRef<{
    messageId: number;
    arrayIndex: number;
  } | null>(null);
  const scrollTimersRef = useRef<number[]>([]);
  // 导航平滑滚动进行中，避免 itemsRendered 等回调二次硬跳
  const navScrollingRef = useRef(false);

  const getTopOffset = () => (hasMore ? 52 : 12);

  const clearScrollTimers = () => {
    scrollTimersRef.current.forEach((id) => window.clearTimeout(id));
    scrollTimersRef.current = [];
  };

  const scheduleScrollTimer = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    scrollTimersRef.current.push(id);
  };

  const finishPendingScroll = (messageId: number) => {
    pendingScrollRef.current = null;
    navScrollingRef.current = false;
    clearScrollTimers();
    onActiveNavChange?.(messageId);
  };

  /** 滚动结束后轻微对齐，避免生硬跳变 */
  const nudgeMessageToTop = (
    messageId: number,
    behavior: ScrollBehavior = "smooth"
  ): boolean => {
    const scroller = scrollerEl;
    const target = scroller?.querySelector(
      `[data-message-id="${messageId}"]`
    ) as HTMLElement | null;
    if (!scroller || !target) return false;

    const topOffset = getTopOffset();
    const delta =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top -
      topOffset;

    if (Math.abs(delta) <= 6) return true;

    scroller.scrollTo({
      top: scroller.scrollTop + delta,
      behavior: Math.abs(delta) < 24 ? "auto" : behavior,
    });
    return false;
  };

  const emitActiveNav = () => {
    if (pendingScrollRef.current) {
      onActiveNavChange?.(pendingScrollRef.current.messageId);
      return;
    }
    onActiveNavChange?.(
      resolveActiveNavIdFromViewport(scrollerEl, messages, getTopOffset())
    );
  };

  const scrollToBottom = (behavior: "auto" | "smooth" = "auto") => {
    if (messages.length === 0) return;
    pendingScrollRef.current = null;
    clearScrollTimers();
    userScrolledUpRef.current = false;
    listRef.current?.scrollToIndex({
      index: "LAST",
      behavior,
      align: "end",
    });
  };

  const scrollToMessageId = (messageId: number) => {
    const arrayIndex = messages.findIndex((m) => m.id === messageId);
    if (arrayIndex < 0) return;

    userScrolledUpRef.current = true;
    clearScrollTimers();
    pendingScrollRef.current = { messageId, arrayIndex };
    navScrollingRef.current = true;
    onActiveNavChange?.(messageId);

    const topOffset = getTopOffset();
    // 单次平滑滚动，避免多次 auto 硬跳
    listRef.current?.scrollToIndex({
      index: arrayIndex,
      align: "start",
      behavior: "smooth",
      offset: -topOffset,
    });

    // 等平滑滚动结束后再做最多一次轻量校正
    scheduleScrollTimer(() => {
      if (pendingScrollRef.current?.messageId !== messageId) return;

      if (nudgeMessageToTop(messageId, "smooth")) {
        finishPendingScroll(messageId);
        return;
      }

      scheduleScrollTimer(() => {
        if (pendingScrollRef.current?.messageId !== messageId) return;
        nudgeMessageToTop(messageId, "auto");
        finishPendingScroll(messageId);
      }, 380);
    }, 480);
  };

  useEffect(() => () => clearScrollTimers(), []);

  // 滚动时按 DOM 位置更新导航高亮
  useEffect(() => {
    if (!scrollerEl) return;

    let rafId = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => emitActiveNav());
    };

    scrollerEl.addEventListener("scroll", onScroll, { passive: true });
    emitActiveNav();

    return () => {
      scrollerEl.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollerEl, messages, hasMore, onActiveNavChange]);

  useEffect(() => {
    if (!scrollApiRef) return;

    scrollApiRef.current = {
      scrollToMessageId,
      scrollToBottom: () => scrollToBottom("smooth"),
    };

    return () => {
      scrollApiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, firstItemIndex, hasMore, scrollApiRef]);

  // 开始流式时重置「用户上滑」标记，默认跟随
  useEffect(() => {
    if (streaming) {
      userScrolledUpRef.current = false;
      atBottomRef.current = true;
    }
  }, [streaming]);

  // 尾部追加新消息时滚到底（prepend 历史消息不滚）
  useEffect(() => {
    if (messages.length === 0) {
      prevLenRef.current = 0;
      return;
    }

    const grew = messages.length > prevLenRef.current;
    const prepended = firstItemIndex < prevFirstIdxRef.current;
    prevLenRef.current = messages.length;
    prevFirstIdxRef.current = firstItemIndex;

    if (grew && !prepended) {
      scrollToBottom("auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, firstItemIndex]);

  // 流式内容变长时跟随（同一 lastId，仅 content/thinking 变化）
  const lastMsg = messages[messages.length - 1];
  const streamFingerprint = lastMsg
    ? `${lastMsg.content.length}:${lastMsg.thinking?.length ?? 0}`
    : "";

  useEffect(() => {
    if (!streaming || userScrolledUpRef.current) return;
    // 等 DOM 撑高后再滚，避免 Virtuoso 高度未更新
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToBottom("auto"));
    });
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamFingerprint, streaming]);

  return (
    <div className="chat-messages-viewport">
      <Virtuoso
        ref={listRef}
        className="chat-virtuoso"
        style={{ height: "100%" }}
        scrollerRef={(el) => {
          setScrollerEl(el as HTMLElement | null);
        }}
        data={messages}
        firstItemIndex={firstItemIndex}
        computeItemKey={(_index, msg) => String(msg.id)}
        defaultItemHeight={120}
        increaseViewportBy={{ top: 400, bottom: 400 }}
        atBottomThreshold={150}
        initialTopMostItemIndex={
          messages.length > 0 ? { index: "LAST", align: "end" } : 0
        }
        followOutput={(isAtBottom) => {
          if (streaming && !userScrolledUpRef.current) return "auto";
          return isAtBottom ? "smooth" : false;
        }}
        itemsRendered={() => {
          emitActiveNav();
        }}
        atBottomStateChange={(isAtBottom) => {
          atBottomRef.current = isAtBottom;
          onAtBottomChange?.(isAtBottom);
          if (streaming && !isAtBottom) {
            userScrolledUpRef.current = true;
          }
          if (isAtBottom) {
            userScrolledUpRef.current = false;
          }
        }}
        totalListHeightChanged={() => {
          if (navScrollingRef.current) return;
          emitActiveNav();
          // 列表总高度变化（流式撑高）时跟随
          if (streaming && !userScrolledUpRef.current) {
            scrollToBottom("auto");
          }
        }}
        startReached={() => {
          if (messages.length > 0 && hasMore && !loadingMore) {
            onLoadOlder();
          }
        }}
        components={{
          Header: () => {
            if (loadingMore) {
              return (
                <div className="chat-load-older">
                  <Spin size="small" />
                  <span>加载更早消息...</span>
                </div>
              );
            }
            if (hasMore) {
              return (
                <div className="chat-load-older chat-load-older-hint">
                  上滑加载更多
                </div>
              );
            }
            return null;
          },
        }}
        itemContent={(_index, msg) => {
          if (!msg) return null;
          const isLast = msg.id === messages[messages.length - 1]?.id;
          return (
            <div className="chat-virtuoso-item" data-message-id={msg.id}>
              <ChatMessageItem
                msg={msg}
                isLast={isLast}
                isStreaming={streaming}
                userAvatarText={userAvatarText}
              />
            </div>
          );
        }}
      />
    </div>
  );
}
