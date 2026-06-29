"use client";

import { useCallback, useRef, useState } from "react";
import ChatMessageList, {
  type ChatMessageScrollApi,
} from "./ChatMessageList";
import ChatMessageNavigator from "./ChatMessageNavigator";
import type { ChatMessage } from "./ChatMessageItem";

interface ChatMessageAreaProps {
  messages: ChatMessage[];
  firstItemIndex: number;
  streaming: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  userAvatarText: string;
  onLoadOlder: () => void;
  onCopy?: (text: string) => void;
  onRegenerate?: (msgId: number) => void;
  onFeedback?: (msgId: number, feedback: "up" | "down" | null) => void;
}

export default function ChatMessageArea({
  messages,
  firstItemIndex,
  streaming,
  loadingMore,
  hasMore,
  userAvatarText,
  onLoadOlder,
  onCopy,
  onRegenerate,
  onFeedback,
}: ChatMessageAreaProps) {
  const scrollApiRef = useRef<ChatMessageScrollApi | null>(null);
  const [activeNavId, setActiveNavId] = useState<number | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const handleActiveNavChange = useCallback((messageId: number | null) => {
    setActiveNavId(messageId);
  }, []);

  const handleAtBottomChange = useCallback((isAtBottom: boolean) => {
    setShowScrollBottom(!isAtBottom);
  }, []);

  const handleScrollToMessage = useCallback((messageId: number) => {
    setActiveNavId(messageId);
    scrollApiRef.current?.scrollToMessageId(messageId);
  }, []);

  const handleScrollToBottom = useCallback(() => {
    scrollApiRef.current?.scrollToBottom();
  }, []);

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
        scrollApiRef={scrollApiRef}
        onLoadOlder={onLoadOlder}
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        onFeedback={onFeedback}
        onActiveNavChange={handleActiveNavChange}
        onAtBottomChange={handleAtBottomChange}
      />
      </div>
      <ChatMessageNavigator
        messages={messages}
        firstItemIndex={firstItemIndex}
        activeMessageId={activeNavId}
        onScrollToMessage={handleScrollToMessage}
        showScrollBottom={showScrollBottom}
        onScrollToBottom={handleScrollToBottom}
      />
    </div>
  );
}
