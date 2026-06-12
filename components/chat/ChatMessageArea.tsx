"use client";

import { useCallback, useRef, useState } from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import ChatMessageList from "./ChatMessageList";
import ChatMessageNavigator, {
  resolveActiveNavId,
} from "./ChatMessageNavigator";
import type { ChatMessage } from "./ChatMessageItem";

interface ChatMessageAreaProps {
  messages: ChatMessage[];
  firstItemIndex: number;
  streaming: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  userAvatarText: string;
  onLoadOlder: () => void;
}

export default function ChatMessageArea({
  messages,
  firstItemIndex,
  streaming,
  loadingMore,
  hasMore,
  userAvatarText,
  onLoadOlder,
}: ChatMessageAreaProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [activeNavId, setActiveNavId] = useState<number | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      setActiveNavId(
        resolveActiveNavId(messages, range.startIndex, firstItemIndex)
      );
    },
    [messages, firstItemIndex]
  );

  const handleAtBottomChange = useCallback((isAtBottom: boolean) => {
    setShowScrollBottom(!isAtBottom);
  }, []);

  const handleScrollToBottom = useCallback(() => {
    if (messages.length === 0) return;
    virtuosoRef.current?.scrollToIndex({
      index: firstItemIndex + messages.length - 1,
      align: "end",
      behavior: "smooth",
    });
  }, [messages.length, firstItemIndex]);

  return (
    <div className="chat-body-with-nav">
      <div className="chat-messages-column">
      <ChatMessageList
        messages={messages}
        firstItemIndex={firstItemIndex}
        streaming={streaming}
        loadingMore={loadingMore}
        hasMore={hasMore}
        userAvatarText={userAvatarText}
        virtuosoRef={virtuosoRef}
        onLoadOlder={onLoadOlder}
        onRangeChanged={handleRangeChanged}
        onAtBottomChange={handleAtBottomChange}
      />
      </div>
      <ChatMessageNavigator
        messages={messages}
        firstItemIndex={firstItemIndex}
        activeMessageId={activeNavId}
        virtuosoRef={virtuosoRef}
        showScrollBottom={showScrollBottom}
        onScrollToBottom={handleScrollToBottom}
      />
    </div>
  );
}
