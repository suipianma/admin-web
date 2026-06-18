import { useCallback, useRef, useState } from "react";
import {
  getConversationMessages,
  type ConversationMessage,
} from "@/services/conversation";
import type { ChatMessage } from "@/components/chat/ChatMessageItem";

export const MESSAGE_PAGE_SIZE = 30;

const INITIAL_FIRST_ITEM_INDEX = 100_000;

interface MessagesPageResult {
  items: ConversationMessage[];
  hasMore: boolean;
  total: number;
}

/** 兼容分页对象与旧版数组响应 */
function normalizePage(data: unknown): MessagesPageResult {
  if (Array.isArray(data)) {
    return { items: data, hasMore: false, total: data.length };
  }
  if (data && typeof data === "object" && "items" in data) {
    const page = data as MessagesPageResult;
    return {
      items: Array.isArray(page.items) ? page.items : [],
      hasMore: !!page.hasMore,
      total: typeof page.total === "number" ? page.total : page.items?.length ?? 0,
    };
  }
  return { items: [], hasMore: false, total: 0 };
}

function mapMessage(msg: ConversationMessage): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    thinking: msg.thinking ?? undefined,
    fromCache: msg.fromCache || undefined,
  };
}

/** 会话消息分页状态：DB 为准，支持向上加载更早消息 */
export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_ITEM_INDEX);
  const tempIdRef = useRef(0);

  const reset = useCallback(() => {
    setMessages([]);
    setHasMore(false);
    setTotal(0);
    setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
    tempIdRef.current = 0;
  }, []);

  const loadInitial = useCallback(async (conversationId: number) => {
    setLoading(true);
    try {
      const res = await getConversationMessages(conversationId, {
        limit: MESSAGE_PAGE_SIZE,
      });
      const page = normalizePage(res.data);
      const items = page.items.map(mapMessage);
      setMessages(items);
      setHasMore(page.hasMore);
      setTotal(page.total);
      setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOlder = useCallback(
    async (conversationId: number) => {
      if (loadingMore || !hasMore || messages.length === 0) return;

      setLoadingMore(true);
      try {
        const res = await getConversationMessages(conversationId, {
          limit: MESSAGE_PAGE_SIZE,
          beforeId: messages[0].id,
        });
        const page = normalizePage(res.data);
        const older = page.items.map(mapMessage);
        if (older.length === 0) {
          setHasMore(false);
          return;
        }
        const existing = new Set(messages.map((m) => m.id));
        const uniqueOlder = older.filter((m) => !existing.has(m.id));
        if (uniqueOlder.length === 0) {
          setHasMore(page.hasMore);
          return;
        }
        setMessages((prev) => [...uniqueOlder, ...prev]);
        setHasMore(page.hasMore);
        setFirstItemIndex((prev) => prev - uniqueOlder.length);
      } finally {
        setLoadingMore(false);
      }
    },
    [hasMore, loadingMore, messages]
  );

  /** 流式结束后与 DB 同步：移除临时消息，合并服务端最新一页 */
  const syncFromServer = useCallback(async (conversationId: number) => {
    const res = await getConversationMessages(conversationId, {
      limit: MESSAGE_PAGE_SIZE,
    });
    const page = normalizePage(res.data);
    const serverItems = page.items.map(mapMessage);

    setMessages((prev) => {
      const stable = prev.filter((m) => m.id > 0);
      const merged = new Map(stable.map((m) => [m.id, m]));
      serverItems.forEach((m) => merged.set(m.id, m));
      return Array.from(merged.values()).sort((a, b) => a.id - b.id);
    });
    setHasMore(page.hasMore);
    setTotal(page.total);
  }, []);

  const appendOptimistic = useCallback(
    (role: ChatMessage["role"], content: string, thinking?: string) => {
      tempIdRef.current -= 1;
      const id = tempIdRef.current;
      const msg: ChatMessage = { id, role, content, thinking };
      setMessages((prev) => [...prev, msg]);
      return id;
    },
    []
  );

  const updateMessage = useCallback(
    (
      id: number,
      payload: { content: string; thinking?: string; fromCache?: boolean }
    ) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id
            ? {
                ...msg,
                content: payload.content,
                thinking: payload.thinking,
                fromCache: payload.fromCache,
              }
            : msg
        )
      );
    },
    []
  );

  const removeMessages = useCallback((ids: number[]) => {
    const idSet = new Set(ids);
    setMessages((prev) => prev.filter((m) => !idSet.has(m.id)));
  }, []);

  return {
    messages,
    hasMore,
    total,
    loading,
    loadingMore,
    firstItemIndex,
    loadInitial,
    loadOlder,
    syncFromServer,
    appendOptimistic,
    updateMessage,
    removeMessages,
    reset,
  };
}
