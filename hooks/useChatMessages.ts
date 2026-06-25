import { useCallback, useRef, useState } from "react";
import {
  getConversationMessages,
  type ConversationMessage,
} from "@/services/conversation";
import type { RagCitation } from "@/services/ai";
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
      payload: {
        content?: string;
        thinking?: string;
        fromCache?: boolean;
        toolCalls?: ChatMessage["toolCalls"];
        agentSteps?: ChatMessage["agentSteps"];
        citations?: RagCitation[];
      }
    ) => {
      setMessages((prev) =>
        prev.map((msg) => {
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
            ...(payload.agentSteps !== undefined
              ? { agentSteps: payload.agentSteps }
              : {}),
            ...(payload.citations !== undefined
              ? { citations: payload.citations }
              : {}),
          };
        })
      );
    },
    []
  );

  const appendAgentStart = useCallback((id: number, maxSteps: number) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== id) return msg;
        return {
          ...msg,
          agentSteps: [
            ...(msg.agentSteps ?? []),
            { step: 0, type: "start" as const, maxSteps },
          ],
        };
      })
    );
  }, []);

  const appendAgentStep = useCallback(
    (id: number, step: number, maxSteps: number) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== id) return msg;
          return {
            ...msg,
            agentSteps: [
              ...(msg.agentSteps ?? []),
              { step, type: "step" as const, maxSteps },
            ],
          };
        })
      );
    },
    []
  );

  const finishAgent = useCallback((id: number, totalSteps: number) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== id) return msg;
        return {
          ...msg,
          agentSteps: [
            ...(msg.agentSteps ?? []),
            { step: totalSteps, type: "done" as const, totalSteps },
          ],
        };
      })
    );
  }, []);

  const appendToolCall = useCallback(
    (
      id: number,
      tool: string,
      args: Record<string, string>,
      step?: number
    ) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== id) return msg;
          const toolCalls = msg.toolCalls ?? [];
          const agentSteps = msg.agentSteps ?? [];
          return {
            ...msg,
            toolCalls: [...toolCalls, { tool, args, status: "calling" as const }],
            agentSteps: step
              ? [
                  ...agentSteps,
                  { step, type: "tool_call" as const, tool, args },
                ]
              : agentSteps,
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
      error?: string,
      step?: number
    ) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== id) return msg;
          const agentSteps = msg.agentSteps ?? [];
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
            agentSteps: step
              ? [
                  ...agentSteps,
                  {
                    step,
                    type: "tool_result" as const,
                    tool,
                    result,
                    error,
                  },
                ]
              : agentSteps,
          };
        })
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
    appendAgentStart,
    appendAgentStep,
    finishAgent,
    appendToolCall,
    completeToolCall,
    removeMessages,
    reset,
  };
}
