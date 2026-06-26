import { useCallback, useRef, useState } from "react";
import {
  getConversationMessages,
  type ConversationMessage,
} from "@/services/conversation";
import type { AgentStepItem, ChatMessage } from "@/components/chat/ChatMessageItem";

export const MESSAGE_PAGE_SIZE = 30;

const INITIAL_FIRST_ITEM_INDEX = 100_000;

export interface ConversationDraft {
  messages: ChatMessage[];
  hasMore: boolean;
  total: number;
  firstItemIndex: number;
}

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
  const draftsRef = useRef<Map<number, ConversationDraft>>(new Map());
  const messagesRef = useRef(messages);
  const hasMoreRef = useRef(hasMore);
  const totalRef = useRef(total);
  const firstItemIndexRef = useRef(firstItemIndex);

  messagesRef.current = messages;
  hasMoreRef.current = hasMore;
  totalRef.current = total;
  firstItemIndexRef.current = firstItemIndex;

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
      const next = Array.from(merged.values()).sort((a, b) => a.id - b.id);
      messagesRef.current = next;
      return next;
    });
    setHasMore(page.hasMore);
    setTotal(page.total);
  }, []);

  /** 停止生成后同步：保留未落库的 assistant 草稿 */
  const syncAfterStop = useCallback(async (conversationId: number) => {
    const res = await getConversationMessages(conversationId, {
      limit: MESSAGE_PAGE_SIZE,
    });
    const page = normalizePage(res.data);
    const serverItems = page.items.map(mapMessage);

    setMessages((prev) => {
      const pendingAssistant = [...prev]
        .reverse()
        .find((m) => m.id < 0 && m.role === "assistant");
      const merged = new Map(serverItems.map((m) => [m.id, m]));
      if (pendingAssistant) {
        merged.set(pendingAssistant.id, pendingAssistant);
      }
      const next = Array.from(merged.values()).sort((a, b) => a.id - b.id);
      messagesRef.current = next;
      return next;
    });
    setHasMore(page.hasMore);
    setTotal(page.total);
  }, []);

  const appendOptimistic = useCallback(
    (role: ChatMessage["role"], content: string, thinking?: string) => {
      tempIdRef.current -= 1;
      const id = tempIdRef.current;
      const msg: ChatMessage = { id, role, content, thinking };
      setMessages((prev) => {
        const next = [...prev, msg];
        messagesRef.current = next;
        return next;
      });
      return id;
    },
    []
  );

  const updateMessage = useCallback(
    (
      id: number,
      payload: {
        content?: string;
        thinking?: string;
        fromCache?: boolean;
        toolCalls?: ChatMessage["toolCalls"];
      }
    ) => {
      setMessages((prev) => {
        const next = prev.map((msg) => {
          if (msg.id !== id) return msg;
          return {
            ...msg,
            ...(payload.content !== undefined
              ? { content: payload.content }
              : {}),
            ...(payload.thinking !== undefined
              ? { thinking: payload.thinking }
              : {}),
            ...(payload.fromCache !== undefined
              ? { fromCache: payload.fromCache }
              : {}),
            ...(payload.toolCalls !== undefined
              ? { toolCalls: payload.toolCalls }
              : {}),
          };
        });
        messagesRef.current = next;
        return next;
      });
    },
    []
  );

  const appendToolCall = useCallback(
    (id: number, tool: string, args: Record<string, string>) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== id) return msg;
          const toolCalls = msg.toolCalls ?? [];
          return {
            ...msg,
            toolCalls: [...toolCalls, { tool, args, status: "calling" as const }],
          };
        })
      );
    },
    []
  );

  const completeToolCall = useCallback(
    (
      id: number,
      tool: string,
      result: string,
      error?: string
    ) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== id) return msg;
          return {
            ...msg,
            toolCalls: (msg.toolCalls ?? []).map((item) =>
              item.tool === tool && item.status === "calling"
                ? {
                    ...item,
                    result,
                    status: error ? ("error" as const) : ("done" as const),
                  }
                : item
            ),
          };
        })
      );
    },
    []
  );

  const appendAgentStep = useCallback((id: number, step: AgentStepItem) => {
    setMessages((prev) => {
      const next = prev.map((msg) => {
        if (msg.id !== id) return msg;
        return {
          ...msg,
          agentSteps: [...(msg.agentSteps ?? []), step],
        };
      });
      messagesRef.current = next;
      return next;
    });
  }, []);

  const removeMessages = useCallback((ids: number[]) => {
    const idSet = new Set(ids);
    setMessages((prev) => {
      const next = prev.filter((m) => !idSet.has(m.id));
      messagesRef.current = next;
      return next;
    });
  }, []);

  /** 切换会话时保存流式草稿 */
  const saveDraft = useCallback((conversationId: number) => {
    setMessages((current) => {
      draftsRef.current.set(conversationId, {
        messages: current.map((m) => ({ ...m })),
        hasMore: hasMoreRef.current,
        total: totalRef.current,
        firstItemIndex: firstItemIndexRef.current,
      });
      messagesRef.current = current;
      return current;
    });
  }, []);

  const hasDraft = useCallback((conversationId: number) => {
    return draftsRef.current.has(conversationId);
  }, []);

  const restoreDraft = useCallback((conversationId: number): boolean => {
    const draft = draftsRef.current.get(conversationId);
    if (!draft) return false;
    const next = draft.messages.map((m) => ({ ...m }));
    setMessages(next);
    messagesRef.current = next;
    setHasMore(draft.hasMore);
    setTotal(draft.total);
    setFirstItemIndex(draft.firstItemIndex);
    setLoading(false);
    return true;
  }, []);

  const clearDraft = useCallback((conversationId: number) => {
    draftsRef.current.delete(conversationId);
  }, []);

  const mutateDraftMessages = useCallback(
    (
      conversationId: number,
      updater: (msgs: ChatMessage[]) => ChatMessage[]
    ) => {
      const draft = draftsRef.current.get(conversationId);
      if (!draft) return;
      draft.messages = updater(draft.messages);
      draftsRef.current.set(conversationId, draft);
    },
    []
  );

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
    syncAfterStop,
    appendOptimistic,
    updateMessage,
    appendToolCall,
    completeToolCall,
    appendAgentStep,
    removeMessages,
    reset,
    saveDraft,
    hasDraft,
    restoreDraft,
    clearDraft,
    mutateDraftMessages,
  };
}
