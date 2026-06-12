"use client";

import { useEffect, useRef } from "react";
import { Spin } from "antd";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import ChatMessageItem, { type ChatMessage } from "./ChatMessageItem";

interface ChatMessageListProps {
  messages: ChatMessage[];
  firstItemIndex: number;
  streaming: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  userAvatarText: string;
  onLoadOlder: () => void;
  virtuosoRef?: React.RefObject<VirtuosoHandle | null>;
}

export default function ChatMessageList({
  messages,
  firstItemIndex,
  streaming,
  loadingMore,
  hasMore,
  userAvatarText,
  onLoadOlder,
  virtuosoRef,
}: ChatMessageListProps) {
  const internalRef = useRef<VirtuosoHandle>(null);
  const listRef = virtuosoRef ?? internalRef;
  const atBottomRef = useRef(true);
  // 流式期间用户主动上滑则暂停跟随
  const userScrolledUpRef = useRef(false);
  const prevLenRef = useRef(0);
  const prevFirstIdxRef = useRef(firstItemIndex);

  const scrollToBottom = (behavior: "auto" | "smooth" = "auto") => {
    if (messages.length === 0) return;
    listRef.current?.scrollToIndex({
      index: firstItemIndex + messages.length - 1,
      behavior,
      align: "end",
    });
  };

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
        data={messages}
        firstItemIndex={firstItemIndex}
        defaultItemHeight={100}
        increaseViewportBy={{ top: 200, bottom: 400 }}
        alignToBottom
        atBottomThreshold={150}
        initialTopMostItemIndex={
          messages.length > 0 ? firstItemIndex + messages.length - 1 : 0
        }
        followOutput={(isAtBottom) => {
          if (streaming && !userScrolledUpRef.current) return "auto";
          return isAtBottom ? "smooth" : false;
        }}
        atBottomStateChange={(isAtBottom) => {
          atBottomRef.current = isAtBottom;
          if (streaming && !isAtBottom) {
            userScrolledUpRef.current = true;
          }
          if (isAtBottom) {
            userScrolledUpRef.current = false;
          }
        }}
        totalListHeightChanged={() => {
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
            <div className="chat-virtuoso-item">
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
