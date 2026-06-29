"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Avatar, Button, Drawer, Spin } from "antd";
import {
  CodeOutlined,
  DownloadOutlined,
  MenuOutlined,
  MessageOutlined,
  RobotOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import ChatObservabilityPanel from "@/components/chat/ChatObservabilityPanel";
import ConversationSidebar from "@/components/ConversationSidebar";
import ChatFullscreenButton from "@/components/chat/ChatFullscreenButton";
import ChatMessageArea from "@/components/chat/ChatMessageArea";
import {
  PromptTemplateChip,
  PromptTemplateMenu,
  PromptTemplatePicker,
  toggleTemplate,
} from "@/components/chat/PromptTemplatePicker";
import { useAuth } from "@/hooks/useAuth";
import { useUserInfo } from "@/hooks/useUserInfo";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useStreamBuffer } from "@/hooks/useStreamBuffer";
import { streamChat } from "@/services/ai";
import { validateOutgoingMessage } from "@/lib/security/promptGuard";
import { getPromptTemplates, type PromptTemplateItem } from "@/services/prompt";
import {
  createConversation,
  cancelStreamSession,
  deleteAllConversations,
  deleteConversation,
  getActiveStreamSession,
  getConversations,
  exportConversation,
  setConversationPinned,
  setMessageFeedback,
  resumeStreamChat,
  updateConversation,
  type Conversation,
} from "@/services/conversation";
import { getUserInfo } from "@/utils/auth";
import {
  clearActiveStream,
  loadActiveStream,
  saveActiveStream,
} from "@/utils/streamSessionStorage";
import { useChatStreamBus } from "@/hooks/useChatStreamBus";
import type { StreamMeta } from "@/lib/stream";
import { observabilityStore } from "@/lib/observability";
import { useChatComposer } from "@/hooks/useChatComposer";
import ModelSelector from "@/components/chat/ModelSelector";
import { getKnowledgeBases, type KnowledgeBase } from "@/services/knowledge-base";
import KnowledgeBasePicker from "@/components/chat/KnowledgeBasePicker";

const SUGGESTIONS = [
  { text: "你好，介绍一下自己", icon: <MessageOutlined /> },
  { text: "NestJS 有哪些核心概念？", icon: <ThunderboltOutlined /> },
  { text: "帮我写一段登录接口示例", icon: <CodeOutlined /> },
];

import {
  resolveInitialConversationId,
  setLastConversationId,
} from "@/utils/chatStorage";

const LIMIT_ERROR_MSG = "会话消息已达上限，请新建会话";

function getUserAvatarText(username?: string) {
  if (!username) return "我";
  return username.slice(0, 1).toUpperCase();
}

export default function ChatPage() {
  useAuth();
  const { message } = App.useApp();
  const userInfo = useUserInfo();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [convLoading, setConvLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const {
    input,
    setInput,
    selectedModel,
    setSelectedModel,
    inputRef,
    handleInput,
    clearInput,
    resetInputHeight,
  } = useChatComposer();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [obsPanelOpen, setObsPanelOpen] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateItem[]>(
    []
  );
  const [selectedPrompt, setSelectedPrompt] =
    useState<PromptTemplateItem | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<
    number[]
  >([]);
  const [convSearch, setConvSearch] = useState("");

  const streamStopsRef = useRef<Map<number, () => void>>(new Map());
  const streamIdsRef = useRef<Map<number, string>>(new Map());
  const streamMetaRef = useRef<Map<number, StreamMeta>>(new Map());
  const activeConversationIdRef = useRef<number | null>(null);
  const initDoneRef = useRef(false);
  const assistantIdRef = useRef<number | null>(null);
  const [streamingConversationIds, setStreamingConversationIds] = useState<
    Set<number>
  >(() => new Set());

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const {
    messages,
    hasMore,
    total,
    loading: messagesLoading,
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
    reset: resetMessages,
    saveDraft,
    hasDraft,
    restoreDraft,
    clearDraft,
    mutateDraftMessages,
  } = useChatMessages();

  const refreshConversations = useCallback(
    async (keepActiveId?: number, search?: string) => {
      try {
        const q = (search ?? convSearch).trim();
        const res = await getConversations(q ? { q } : undefined);
        setConversations(res.data);
        if (keepActiveId != null) setActiveConversationId(keepActiveId);
      } catch (err) {
        message.error(
          err instanceof Error ? err.message : "获取会话列表失败"
        );
      }
    },
    [message, convSearch]
  );

  const handleStreamFlush = useCallback(
    (reply: { thinking: string; response: string; fromCache?: boolean }) => {
      const assistantId = assistantIdRef.current;
      const streamConvId = activeConversationIdRef.current;
      if (assistantId == null || streamConvId == null) {
        return;
      }
      // 用 ref 判断，避免 setState 未完成时误判为非流式而丢弃增量
      const meta = streamMetaRef.current.get(streamConvId);
      if (!meta || meta.assistantId !== assistantId) {
        return;
      }
      updateMessage(assistantId, {
        thinking: reply.thinking ? reply.thinking : undefined,
        content: reply.response,
        fromCache: reply.fromCache,
      });
    },
    [updateMessage]
  );

  const { push: pushStream, flushNow, reset: resetStream, cancel: cancelStream } =
    useStreamBuffer(handleStreamFlush);

  function isViewingConversation(conversationId: number) {
    return activeConversationIdRef.current === conversationId;
  }

  function markConversationStreaming(conversationId: number, streaming: boolean) {
    setStreamingConversationIds((prev) => {
      const next = new Set(prev);
      if (streaming) next.add(conversationId);
      else next.delete(conversationId);
      return next;
    });
  }

  function clearStreamingState(conversationId: number) {
    streamStopsRef.current.delete(conversationId);
    streamIdsRef.current.delete(conversationId);
    streamMetaRef.current.delete(conversationId);
    markConversationStreaming(conversationId, false);
    clearDraft(conversationId);
    if (activeConversationIdRef.current === conversationId) {
      assistantIdRef.current = null;
    }
    const active = loadActiveStream();
    if (active?.conversationId === conversationId) {
      clearActiveStream();
    }
  }

  function attachStreamRefs(conversationId: number) {
    const meta = streamMetaRef.current.get(conversationId);
    if (!meta) return;
    assistantIdRef.current = meta.assistantId;
  }

  /** 切换会话时断开 SSE，后台 detached 生成继续 */
  function detachStreamClient(conversationId: number) {
    streamStopsRef.current.get(conversationId)?.();
    streamStopsRef.current.delete(conversationId);
    if (activeConversationIdRef.current === conversationId) {
      assistantIdRef.current = null;
    }
  }

  function finishStreamForConversation(conversationId: number) {
    if (isViewingConversation(conversationId)) {
      flushNow();
    }
    clearStreamingState(conversationId);

    if (isViewingConversation(conversationId)) {
      void syncFromServer(conversationId).then(() => {
        void refreshConversations(conversationId);
      });
    } else {
      void refreshConversations();
    }
  }

  const handleStopGeneration = useCallback(async () => {
    const convId = activeConversationId;
    if (convId == null || !streamingConversationIds.has(convId)) return;

    observabilityStore.ingest({ type: "stream_cancelled", conversationId: convId });

    const streamId = streamIdsRef.current.get(convId);
    const meta = streamMetaRef.current.get(convId);
    const userContent =
      meta?.userMsgId != null
        ? messages.find((m) => m.id === meta.userMsgId)?.content
        : [...messages].reverse().find((m) => m.role === "user")?.content;

    detachStreamClient(convId);
    cancelStream();
    flushNow();

    if (streamId) {
      try {
        await cancelStreamSession(convId, streamId);
      } catch {
        // 后端取消失败时仍同步本地
      }
    }

    streamStopsRef.current.delete(convId);
    streamIdsRef.current.delete(convId);
    streamMetaRef.current.delete(convId);
    markConversationStreaming(convId, false);
    clearDraft(convId);
    assistantIdRef.current = null;
    const active = loadActiveStream();
    if (active?.conversationId === convId) {
      clearActiveStream();
    }

    await syncAfterStop(convId);

    if (userContent) {
      setInput(userContent);
    }
  }, [
    activeConversationId,
    cancelStream,
    flushNow,
    messages,
    streamingConversationIds,
    syncAfterStop,
  ]);

  const { createHandlers } = useChatStreamBus({
    isViewingConversation,
    streamMetaRef,
    assistantIdRef,
    streamIdsRef,
    streamStopsRef,
    pushStream,
    updateMessage,
    mutateDraftMessages,
    appendToolCall,
    completeToolCall,
    appendAgentStep,
    flushNow,
    clearStreamingState,
    finishStreamForConversation,
    cancelStream,
    resetStream,
    removeMessages,
    syncFromServer,
    saveActiveStream,
    message,
    limitErrorMsg: LIMIT_ERROR_MSG,
  });

  const startStreamClient = useCallback(
    (
      conversationId: number,
      content: string | undefined,
      meta: StreamMeta,
      options?: {
        resumeStreamId?: string;
        promptId?: string;
        knowledgeBaseIds?: number[];
        regenerate?: boolean;
        model?: string;
        rollbackUserMsgId?: number;
        rollbackAssistantId?: number;
      }
    ) => {
      streamStopsRef.current.get(conversationId)?.();

      const handlers = createHandlers({
        conversationId,
        assistantId: meta.assistantId,
        rollback:
          options?.rollbackUserMsgId != null &&
          options?.rollbackAssistantId != null
            ? {
                userMsgId: options.rollbackUserMsgId,
                assistantId: options.rollbackAssistantId,
              }
            : undefined,
      });
      const stop = options?.resumeStreamId
        ? resumeStreamChat(conversationId, options.resumeStreamId, handlers)
        : streamChat(conversationId, content, {
            promptId: options?.promptId,
            knowledgeBaseIds: options?.knowledgeBaseIds,
            regenerate: options?.regenerate,
            model: options?.model,
            ...handlers,
          });

      streamStopsRef.current.set(conversationId, stop);
    },
    [createHandlers]
  );

  const tryRecoverActiveStream = useCallback(
    async (conversationId: number) => {
      if (streamingConversationIds.has(conversationId) && hasDraft(conversationId)) {
        restoreDraft(conversationId);
        attachStreamRefs(conversationId);
        if (!streamStopsRef.current.has(conversationId)) {
          const streamId = streamIdsRef.current.get(conversationId);
          const meta = streamMetaRef.current.get(conversationId);
          if (streamId && meta) {
            resetStream();
            startStreamClient(conversationId, undefined, meta, {
              resumeStreamId: streamId,
              rollbackAssistantId: meta.assistantId,
            });
          }
        }
        return;
      }

      try {
        const activeRes = await getActiveStreamSession(conversationId);
        const active = activeRes.data;
        if (!active || active.done) {
          if (active?.done) {
            await syncFromServer(conversationId);
          }
          return;
        }

        saveActiveStream(conversationId, active.streamId);
        streamIdsRef.current.set(conversationId, active.streamId);

        const assistantId = appendOptimistic("assistant", active.response || "");
        const meta: StreamMeta = {
          assistantId,
          buffer: {
            thinking: active.thinking || "",
            response: active.response || "",
            fromCache: active.fromCache,
          },
        };
        streamMetaRef.current.set(conversationId, meta);
        markConversationStreaming(conversationId, true);
        assistantIdRef.current = assistantId;
        updateMessage(assistantId, {
          thinking: active.thinking || undefined,
          content: active.response,
          fromCache: active.fromCache || undefined,
        });

        resetStream();
        startStreamClient(conversationId, undefined, meta, {
          resumeStreamId: active.streamId,
          rollbackAssistantId: assistantId,
        });
      } catch {
        clearActiveStream();
      }
    },
    [
      appendOptimistic,
      hasDraft,
      resetStream,
      restoreDraft,
      startStreamClient,
      streamingConversationIds,
      syncFromServer,
      updateMessage,
    ]
  );

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    async function init() {
      setConvLoading(true);
      try {
        const res = await getConversations();
        const list = res.data;
        setConversations(list);

        if (list.length > 0) {
          const userId = getUserInfo()?.userId ?? null;
          const initialId = resolveInitialConversationId(list, userId);
          if (initialId != null) {
            setActiveConversationId(initialId);
            await loadInitial(initialId);
            await tryRecoverActiveStream(initialId);
          }
        } else {
          const created = await createConversation();
          setConversations([created.data]);
          setActiveConversationId(created.data.id);
          resetMessages();
        }
      } catch (err) {
        message.error(
          err instanceof Error ? err.message : "初始化会话失败"
        );
      } finally {
        setConvLoading(false);
      }
    }

    void init();
  }, [loadInitial, message, resetMessages, tryRecoverActiveStream]);

  useEffect(() => {
    if (!initDoneRef.current) return;
    const timer = window.setTimeout(() => {
      void refreshConversations(activeConversationId ?? undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [convSearch, activeConversationId, refreshConversations]);

  useEffect(() => {
    getPromptTemplates()
      .then((res) => setPromptTemplates(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getKnowledgeBases()
      .then((res) => setKnowledgeBases(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      streamStopsRef.current.forEach((stop) => stop());
      streamStopsRef.current.clear();
    };
  }, []);

  // 选中模板后聚焦输入框
  useEffect(() => {
    if (selectedPrompt && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedPrompt]);

  // 切换会话时记录上次查看
  useEffect(() => {
    if (activeConversationId == null) return;
    const userId = getUserInfo()?.userId;
    if (userId != null) {
      setLastConversationId(userId, activeConversationId);
    }
  }, [activeConversationId]);

  // 全屏模式：锁定页面滚动，Esc 退出
  useEffect(() => {
    if (!isFullscreen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev);
  }

  async function handleSelectConversation(id: number) {
    if (id === activeConversationId) return;

    const leavingId = activeConversationId;
    if (leavingId != null && streamingConversationIds.has(leavingId)) {
      saveDraft(leavingId);
      if (activeConversationIdRef.current === leavingId) {
        assistantIdRef.current = null;
      }
    }

    setActiveConversationId(id);
    setInput("");
    setSelectedPrompt(null);
    setDrawerOpen(false);

    if (streamingConversationIds.has(id) && hasDraft(id)) {
      restoreDraft(id);
      attachStreamRefs(id);
      return;
    }

    await loadInitial(id);
    await tryRecoverActiveStream(id);
  }

  async function handleCreateConversation() {
    try {
      const res = await createConversation();
      setConversations((prev) => [res.data, ...prev]);
      setActiveConversationId(res.data.id);
      resetMessages();
      setInput("");
      setSelectedPrompt(null);
      setDrawerOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "新建会话失败");
    }
  }

  async function handleRenameConversation(id: number, title: string) {
    try {
      const res = await updateConversation(id, { title });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? res.data : c))
      );
      message.success("重命名成功");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "重命名失败");
    }
  }

  async function handleDeleteConversation(id: number) {
    if (streamingConversationIds.has(id)) {
      const streamId = streamIdsRef.current.get(id);
      detachStreamClient(id);
      clearStreamingState(id);
      if (streamId) {
        try {
          await cancelStreamSession(id, streamId);
        } catch {
          // 忽略取消失败
        }
      }
    }

    try {
      await deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);

      if (activeConversationId === id) {
        if (remaining.length > 0) {
          const nextId = remaining[0].id;
          resetMessages();
          setActiveConversationId(nextId);
          await loadInitial(nextId);
        } else {
          const created = await createConversation();
          setConversations([created.data]);
          setActiveConversationId(created.data.id);
          resetMessages();
        }
        setDrawerOpen(false);
      }

      message.success("会话已删除");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除会话失败");
    }
  }

  function handlePromptSelect(item: PromptTemplateItem) {
    setSelectedPrompt((prev) => toggleTemplate(prev, item));
  }

  function getStoppedAssistantMessage() {
    if (
      activeConversationId != null &&
      streamingConversationIds.has(activeConversationId)
    ) {
      return null;
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.id >= 0) return null;
    return last;
  }

  function doSend(
    content: string,
    conversationId: number,
    promptId?: string,
    options?: { regenerate?: boolean }
  ) {
    const isRegenerate = options?.regenerate === true;

    clearInput();

    let userMsgId: number | undefined;
    let rollbackUserMsgId: number | undefined;

    if (isRegenerate) {
      const userMsg = [...messages].reverse().find((m) => m.role === "user");
      userMsgId = userMsg?.id;
    } else {
      userMsgId = appendOptimistic("user", content);
      rollbackUserMsgId = userMsgId;
    }

    const assistantId = appendOptimistic("assistant", "");
    const meta: StreamMeta = {
      assistantId,
      userMsgId,
      buffer: { thinking: "", response: "" },
    };
    streamMetaRef.current.set(conversationId, meta);
    markConversationStreaming(conversationId, true);
    assistantIdRef.current = assistantId;
    resetStream();

    startStreamClient(conversationId, content, meta, {
      promptId,
      knowledgeBaseIds:
        selectedKnowledgeBaseIds.length > 0
          ? selectedKnowledgeBaseIds
          : undefined,
      regenerate: isRegenerate,
      model: selectedModel,
      rollbackUserMsgId,
      rollbackAssistantId: assistantId,
    });
  }

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || activeConversationId == null) return;
    if (streamingConversationIds.has(activeConversationId)) return;

    const validation = validateOutgoingMessage(content);
    if (!validation.ok) {
      message.warning(validation.message ?? "消息不符合要求");
      return;
    }

    if (total >= 200) {
      message.warning(LIMIT_ERROR_MSG);
      return;
    }

    // 停止后再次发送：编辑问题并重新生成，不新增 user 消息
    const stoppedAssistant = getStoppedAssistantMessage();
    if (stoppedAssistant) {
      const userMsg = messages[messages.length - 2];
      if (!userMsg || userMsg.role !== "user") return;

      clearInput();

      if (content !== userMsg.content) {
        updateMessage(userMsg.id, { content });
      }
      removeMessages([stoppedAssistant.id]);
      doSend(content, activeConversationId, selectedPrompt?.id, {
        regenerate: true,
      });
      return;
    }

    doSend(content, activeConversationId, selectedPrompt?.id);
  }

  function handleCopyMessage(text: string) {
    void navigator.clipboard.writeText(text).then(
      () => message.success("已复制"),
      () => message.error("复制失败")
    );
  }

  async function handlePinConversation(id: number, pinned: boolean) {
    try {
      await setConversationPinned(id, pinned);
      await refreshConversations(activeConversationId ?? undefined);
      message.success(pinned ? "已置顶" : "已取消置顶");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "置顶操作失败");
    }
  }

  async function handleExportConversation() {
    if (activeConversationId == null) return;
    try {
      const res = await exportConversation(activeConversationId);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${activeConversationId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success("会话已导出");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "导出失败");
    }
  }

  async function handleMessageFeedback(
    msgId: number,
    feedback: "up" | "down" | null
  ) {
    if (activeConversationId == null) return;
    try {
      await setMessageFeedback(activeConversationId, msgId, feedback);
      updateMessage(msgId, { feedback: feedback ?? undefined });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "反馈提交失败");
    }
  }

  function handleRegenerateMessage(msgId: number) {
    if (activeConversationId == null) return;
    if (streamingConversationIds.has(activeConversationId)) return;

    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex < 0 || messages[msgIndex].role !== "assistant") return;

    let userMsg = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) return;

    removeMessages([msgId]);
    doSend(userMsg.content, activeConversationId, selectedPrompt?.id, {
      regenerate: true,
    });
  }

  async function handleDeleteAllConversations() {
    for (const id of [...streamingConversationIds]) {
      const streamId = streamIdsRef.current.get(id);
      detachStreamClient(id);
      if (streamId) {
        try {
          await cancelStreamSession(id, streamId);
        } catch {
          // 忽略取消失败
        }
      }
      clearStreamingState(id);
    }

    try {
      await deleteAllConversations();
      const created = await createConversation();
      setConversations([created.data]);
      setActiveConversationId(created.data.id);
      resetMessages();
      setInput("");
      setSelectedPrompt(null);
      setDrawerOpen(false);
      message.success("已删除全部会话");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除全部会话失败");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isActiveConvStreaming =
    activeConversationId != null &&
    streamingConversationIds.has(activeConversationId);

  const sidebarProps = {
    conversations,
    activeId: activeConversationId,
    loading: convLoading,
    streamingIds: [...streamingConversationIds],
    onSelect: handleSelectConversation,
    onCreate: handleCreateConversation,
    onRename: handleRenameConversation,
    onDelete: handleDeleteConversation,
    onDeleteAll: handleDeleteAllConversations,
    onPin: handlePinConversation,
    searchQuery: convSearch,
    onSearchChange: setConvSearch,
  };

  const activeTitle =
    conversations.find((c) => c.id === activeConversationId)?.title ??
    "AI 聊天";

  const userAvatarText = getUserAvatarText(userInfo?.username);

  return (
    <div
      className={`page-container page-container-full chat-page${isFullscreen ? " chat-page--fullscreen" : ""}`}
    >
      <div className="chat-mobile-header">
        <Button
          type="text"
          className="chat-mobile-menu-btn"
          icon={<MenuOutlined />}
          onClick={() => setDrawerOpen(true)}
          aria-label="打开会话列表"
        />
        <div className="chat-mobile-header-main">
          <span className="chat-mobile-title">{activeTitle}</span>
          {isActiveConvStreaming && <span className="chat-status-pill">生成中</span>}
        </div>
        <ChatFullscreenButton
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
        />
        <Button
          type="text"
          className="chat-mobile-menu-btn"
          icon={<RadarChartOutlined />}
          onClick={() => setObsPanelOpen(true)}
          aria-label="打开 Observability 面板"
        />
      </div>

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <ConversationSidebar {...sidebarProps} />
        </aside>

        <Drawer
          title="会话列表"
          placement="left"
          open={drawerOpen}
          size={300}
          className="chat-drawer"
          onClose={() => setDrawerOpen(false)}
        >
          <ConversationSidebar {...sidebarProps} />
        </Drawer>

        <main className="chat-main">
          <header className="chat-panel-header">
            <div className="chat-panel-header-main">
              <div className="chat-panel-icon">
                <RobotOutlined />
              </div>
              <div className="chat-panel-titles">
                <h1 className="chat-panel-title">{activeTitle}</h1>
                <p className="chat-panel-subtitle">
                  {isActiveConvStreaming
                    ? "AI 正在回复..."
                    : messages.length > 0
                      ? `共 ${total} 条消息`
                      : "开始一段新对话"}
                </p>
              </div>
            </div>
            <div className="chat-panel-header-actions">
              {isActiveConvStreaming && (
                <>
                  <span className="chat-status-pill chat-status-pill--desktop">
                    生成中
                  </span>
                  <Button
                    size="small"
                    danger
                    icon={<StopOutlined />}
                    onClick={() => void handleStopGeneration()}
                  >
                    停止
                  </Button>
                </>
              )}
              <ChatFullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
              />
              {activeConversationId != null && messages.length > 0 && (
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => void handleExportConversation()}
                >
                  导出
                </Button>
              )}
              <Button
                size="small"
                type="text"
                icon={<RadarChartOutlined />}
                onClick={() => setObsPanelOpen(true)}
                aria-label="打开 Observability 面板"
                title="Observability"
              />
            </div>
          </header>

          <ChatObservabilityPanel
            open={obsPanelOpen}
            conversationId={activeConversationId}
            onClose={() => setObsPanelOpen(false)}
          />

          <div className="chat-panel">
            <div className="chat-body">
              {messagesLoading ? (
                <div className="chat-messages-loading">
                  <Spin description="加载消息..." />
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-stream">
                  <div className="chat-welcome">
                    <div className="chat-welcome-glow" aria-hidden />
                    <div className="chat-welcome-hero">
                      <Avatar
                        size={64}
                        className="chat-welcome-avatar"
                        icon={<RobotOutlined />}
                      />
                      <h2 className="chat-welcome-title">有什么可以帮你的？</h2>
                      <p className="chat-welcome-desc">
                        解答技术问题、梳理架构思路、生成可运行代码
                      </p>
                    </div>
                    <div className="chat-welcome-section">
                      <p className="chat-welcome-section-label">快捷对话</p>
                      <div className="chat-welcome-list">
                        {SUGGESTIONS.map((item) => (
                          <button
                            key={item.text}
                            type="button"
                            className="chat-suggestion-btn"
                            disabled={
                              isActiveConvStreaming ||
                              activeConversationId == null
                            }
                            onClick={() => handleSend(item.text)}
                          >
                            <span className="chat-suggestion-icon">
                              {item.icon}
                            </span>
                            <span className="chat-suggestion-text">
                              {item.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <PromptTemplatePicker
                      templates={promptTemplates}
                      selected={selectedPrompt}
                      disabled={
                        isActiveConvStreaming || activeConversationId == null
                      }
                      onSelect={handlePromptSelect}
                      onClear={() => setSelectedPrompt(null)}
                    />
                  </div>
                </div>
              ) : (
                <ChatMessageArea
                  key={activeConversationId ?? "none"}
                  messages={messages}
                  firstItemIndex={firstItemIndex}
                  streaming={isActiveConvStreaming}
                  loadingMore={loadingMore}
                  hasMore={hasMore}
                  userAvatarText={userAvatarText}
                  onCopy={handleCopyMessage}
                  onRegenerate={handleRegenerateMessage}
                  onFeedback={handleMessageFeedback}
                  onLoadOlder={() => {
                    if (activeConversationId) {
                      void loadOlder(activeConversationId);
                    }
                  }}
                />
              )}
            </div>

            <div className="chat-footer">
              <div className="chat-composer-wrap">
                <KnowledgeBasePicker
                  compact
                  options={knowledgeBases}
                  value={selectedKnowledgeBaseIds}
                  disabled={isActiveConvStreaming || activeConversationId == null}
                  onChange={setSelectedKnowledgeBaseIds}
                />
                <PromptTemplateChip
                  selected={selectedPrompt}
                  disabled={isActiveConvStreaming || activeConversationId == null}
                  onClear={() => setSelectedPrompt(null)}
                />
                <ModelSelector
                  value={selectedModel}
                  disabled={isActiveConvStreaming || activeConversationId == null}
                  onChange={setSelectedModel}
                />
                <div className="chat-composer">
                  <PromptTemplateMenu
                    templates={promptTemplates}
                    selected={selectedPrompt}
                    disabled={isActiveConvStreaming || activeConversationId == null}
                    onSelect={handlePromptSelect}
                  />
                  <textarea
                    ref={inputRef}
                    className="chat-composer-input"
                    value={input}
                    rows={1}
                    placeholder={
                      isActiveConvStreaming
                        ? "AI 正在回复，请稍候..."
                        : getStoppedAssistantMessage()
                          ? "可编辑问题后重新发送，不会新增消息"
                          : selectedPrompt
                            ? `已启用「${selectedPrompt.name}」，填写${selectedPrompt.contextLabel}`
                            : "输入消息，Enter 发送，Shift + Enter 换行"
                    }
                    disabled={isActiveConvStreaming || activeConversationId == null}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="button"
                    className={`chat-composer-send${isActiveConvStreaming ? " chat-composer-send--loading" : ""}`}
                    onClick={() =>
                      isActiveConvStreaming
                        ? void handleStopGeneration()
                        : void handleSend()
                    }
                    disabled={
                      !isActiveConvStreaming &&
                      (!input.trim() || activeConversationId == null)
                    }
                    aria-label={
                      isActiveConvStreaming ? "停止生成" : "发送消息"
                    }
                  >
                    {isActiveConvStreaming ? (
                      <StopOutlined />
                    ) : (
                      <SendOutlined />
                    )}
                  </button>
                </div>
                <p className="chat-footer-tip">内容由 AI 生成，请自行甄别</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
