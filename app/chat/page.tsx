"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Avatar, Button, Drawer, Spin } from "antd";
import {
  CodeOutlined,
  MenuOutlined,
  MessageOutlined,
  RobotOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import ConversationSidebar from "@/components/ConversationSidebar";
import ChatFullscreenButton from "@/components/chat/ChatFullscreenButton";
import ChatMessageArea from "@/components/chat/ChatMessageArea";
import KnowledgeBasePicker from "@/components/chat/KnowledgeBasePicker";
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
import { streamChat, type RagCitation } from "@/services/ai";
import { getKnowledgeBases, type KnowledgeBase } from "@/services/knowledge-base";
import { getPromptTemplates, type PromptTemplateItem } from "@/services/prompt";
import {
  createConversation,
  deleteAllConversations,
  deleteConversation,
  getConversations,
  updateConversation,
  type Conversation,
} from "@/services/conversation";
import { ApiError } from "@/utils/apiError";
import { getUserInfo } from "@/utils/auth";
import {
  resolveInitialConversationId,
  setLastConversationId,
} from "@/utils/chatStorage";

const SUGGESTIONS = [
  { text: "你好，介绍一下自己", icon: <MessageOutlined /> },
  { text: "NestJS 有哪些核心概念？", icon: <ThunderboltOutlined /> },
  { text: "帮我写一段登录接口示例", icon: <CodeOutlined /> },
];

const LIMIT_ERROR_MSG = "会话消息已达上限，请新建会话";

interface StreamMeta {
  assistantId: number;
  userMsgId?: number;
  buffer: { thinking: string; response: string; fromCache?: boolean };
}

function getUserAvatarText(username?: string) {
  if (!username) return "我";
  return username.slice(0, 1).toUpperCase();
}

function normalizeRagCitations(citations: RagCitation[]) {
  return citations.filter(
    (item) =>
      typeof item.chunkId === "number" &&
      typeof item.documentName === "string" &&
      typeof item.score === "number" &&
      typeof item.snippet === "string"
  );
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
  const [input, setInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateItem[]>(
    []
  );
  const [selectedPrompt, setSelectedPrompt] =
    useState<PromptTemplateItem | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<number[]>(
    []
  );

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamStopsRef = useRef<Map<number, () => void>>(new Map());
  const initDoneRef = useRef(false);
  const assistantIdRef = useRef<number | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);
  const streamingConversationIdRef = useRef<number | null>(null);
  const streamMetaRef = useRef<Map<number, StreamMeta>>(new Map());
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
    appendAgentStart,
    appendAgentStep,
    finishAgent,
    appendToolCall,
    completeToolCall,
    removeMessages,
    reset: resetMessages,
    saveDraft,
    hasDraft,
    restoreDraft,
    clearDraft,
    mutateDraftMessages,
  } = useChatMessages();

  const refreshConversations = useCallback(
    async (keepActiveId?: number) => {
      try {
        const res = await getConversations();
        setConversations(res.data);
        if (keepActiveId != null) setActiveConversationId(keepActiveId);
      } catch (err) {
        message.error(
          err instanceof Error ? err.message : "获取会话列表失败"
        );
      }
    },
    [message]
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
  }, [loadInitial, message, resetMessages]);

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

  useEffect(() => {
    setSelectedKnowledgeBaseIds([]);
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

  const handleStreamFlush = useCallback(
    (reply: { thinking: string; response: string; fromCache?: boolean }) => {
      const assistantId = assistantIdRef.current;
      const streamConvId = streamingConversationIdRef.current;
      if (
        assistantId == null ||
        streamConvId == null ||
        activeConversationIdRef.current !== streamConvId
      ) {
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
    markConversationStreaming(conversationId, false);
    streamMetaRef.current.delete(conversationId);
    clearDraft(conversationId);
    if (streamingConversationIdRef.current === conversationId) {
      streamingConversationIdRef.current = null;
      assistantIdRef.current = null;
    }
  }

  function attachStreamRefs(conversationId: number) {
    const meta = streamMetaRef.current.get(conversationId);
    if (!meta) return;
    assistantIdRef.current = meta.assistantId;
    streamingConversationIdRef.current = conversationId;
  }

  function applyBackgroundStreamReply(
    conversationId: number,
    assistantId: number,
    reply: { thinking: string; response: string; fromCache?: boolean }
  ) {
    const meta = streamMetaRef.current.get(conversationId);
    if (meta) meta.buffer = reply;

    mutateDraftMessages(conversationId, (msgs) =>
      msgs.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              thinking: reply.thinking ? reply.thinking : undefined,
              content: reply.response,
              fromCache: reply.fromCache,
            }
          : m
      )
    );
  }

  function isViewingConversation(conversationId: number) {
    return activeConversationIdRef.current === conversationId;
  }

  function handleStopGeneration() {
    const convId = activeConversationId;
    if (convId == null || !streamingConversationIds.has(convId)) return;

    streamStopsRef.current.get(convId)?.();
    streamStopsRef.current.delete(convId);
    flushNow();
    clearStreamingState(convId);

    void syncAfterStop(convId).then(() => {
      void refreshConversations(convId);
    });
  }

  /** 停止后未完成的 AI 回复（临时 id） */
  function getStoppedAssistantMessage() {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.id < 0) return last;
    return null;
  }

  function handleRegenerateFromUser(
    userMsg: (typeof messages)[number],
    assistantMsgId?: number
  ) {
    if (activeConversationId == null) return;
    if (streamingConversationIds.has(activeConversationId)) return;

    if (assistantMsgId != null) {
      removeMessages([assistantMsgId]);
    }

    doSend(userMsg.content, activeConversationId, undefined, selectedKnowledgeBaseIds, {
      regenerate: true,
    });
  }

  async function handleSelectConversation(id: number) {
    if (id === activeConversationId) return;

    const leavingId = activeConversationId;
    if (leavingId != null && streamingConversationIds.has(leavingId)) {
      saveDraft(leavingId);
    }

    setActiveConversationId(id);
    setInput("");
    setSelectedPrompt(null);
    setSelectedKnowledgeBaseIds([]);
    setDrawerOpen(false);

    if (streamingConversationIds.has(id) && hasDraft(id)) {
      restoreDraft(id);
      attachStreamRefs(id);
      return;
    }

    await loadInitial(id);
  }

  async function handleCreateConversation() {
    try {
      const res = await createConversation();
      setConversations((prev) => [res.data, ...prev]);
      setActiveConversationId(res.data.id);
      resetMessages();
      setInput("");
      setSelectedPrompt(null);
      setSelectedKnowledgeBaseIds([]);
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
      streamStopsRef.current.get(id)?.();
      streamStopsRef.current.delete(id);
      markConversationStreaming(id, false);
      streamMetaRef.current.delete(id);
      clearDraft(id);
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

  async function handleDeleteAllConversations() {
    streamStopsRef.current.forEach((stop) => stop());
    streamStopsRef.current.clear();
    setStreamingConversationIds(new Set());
    streamingConversationIdRef.current = null;
    assistantIdRef.current = null;
    streamMetaRef.current.clear();

    try {
      await deleteAllConversations();
      const created = await createConversation();
      setConversations([created.data]);
      setActiveConversationId(created.data.id);
      resetMessages();
      setInput("");
      setSelectedPrompt(null);
      setSelectedKnowledgeBaseIds([]);
      setDrawerOpen(false);
      message.success("已清空全部会话");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除全部会话失败");
    }
  }

  async function handleCopyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      message.success("已复制");
    } catch {
      message.error("复制失败");
    }
  }

  function handleRegenerateMessage(assistantMsgId: number) {
    if (
      activeConversationId == null ||
      streamingConversationIds.has(activeConversationId)
    ) {
      return;
    }

    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx <= 0) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== "user") return;

    handleRegenerateFromUser(userMsg, assistantMsgId);
  }

  function handlePromptSelect(item: PromptTemplateItem) {
    setSelectedPrompt((prev) => toggleTemplate(prev, item));
  }

  function doSend(
    content: string,
    conversationId: number,
    promptId?: string,
    knowledgeBaseIds?: number[],
    options?: { regenerate?: boolean }
  ) {
    const isRegenerate = options?.regenerate === true;

    if (!isRegenerate) {
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";
    }

    let userMsgId: number | null = null;
    if (!isRegenerate) {
      userMsgId = appendOptimistic("user", content);
    }

    const assistantId = appendOptimistic("assistant", "");
    streamMetaRef.current.set(conversationId, {
      assistantId,
      userMsgId: userMsgId ?? undefined,
      buffer: { thinking: "", response: "" },
    });
    markConversationStreaming(conversationId, true);
    resetStream();

    // 同一会话重复发送时，先中断上一次流
    streamStopsRef.current.get(conversationId)?.();

    const stop = streamChat(conversationId, content, {
      promptId,
      knowledgeBaseIds,
      regenerate: isRegenerate,
      onUpdate: (reply) => {
        if (isViewingConversation(conversationId)) {
          assistantIdRef.current = assistantId;
          streamingConversationIdRef.current = conversationId;
          pushStream(reply);
          return;
        }
        applyBackgroundStreamReply(conversationId, assistantId, reply);
      },
      onAgentStart: ({ maxSteps }) => {
        if (isViewingConversation(conversationId)) {
          appendAgentStart(assistantId, maxSteps);
          return;
        }
        mutateDraftMessages(conversationId, (msgs) =>
          msgs.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  agentSteps: [
                    ...(msg.agentSteps ?? []),
                    { step: 0, type: "start" as const, maxSteps },
                  ],
                }
              : msg
          )
        );
      },
      onAgentStep: ({ step, maxSteps }) => {
        if (isViewingConversation(conversationId)) {
          appendAgentStep(assistantId, step, maxSteps);
          return;
        }
        mutateDraftMessages(conversationId, (msgs) =>
          msgs.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  agentSteps: [
                    ...(msg.agentSteps ?? []),
                    { step, type: "step" as const, maxSteps },
                  ],
                }
              : msg
          )
        );
      },
      onAgentDone: ({ steps }) => {
        if (isViewingConversation(conversationId)) {
          finishAgent(assistantId, steps);
          return;
        }
        mutateDraftMessages(conversationId, (msgs) =>
          msgs.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  agentSteps: [
                    ...(msg.agentSteps ?? []),
                    { step: steps, type: "done" as const, totalSteps: steps },
                  ],
                }
              : msg
          )
        );
      },
      onToolCall: ({ tool, args, step }) => {
        if (isViewingConversation(conversationId)) {
          appendToolCall(assistantId, tool, args, step);
          return;
        }
        mutateDraftMessages(conversationId, (msgs) =>
          msgs.map((msg) => {
            if (msg.id !== assistantId) return msg;
            const toolCalls = msg.toolCalls ?? [];
            const agentSteps = msg.agentSteps ?? [];
            return {
              ...msg,
              toolCalls: [
                ...toolCalls,
                { tool, args, status: "calling" as const },
              ],
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
      onRagRetrieval: ({ citations }) => {
        const normalized = normalizeRagCitations(citations);
        if (isViewingConversation(conversationId)) {
          updateMessage(assistantId, { citations: normalized });
          return;
        }
        mutateDraftMessages(conversationId, (msgs) =>
          msgs.map((msg) =>
            msg.id === assistantId ? { ...msg, citations: normalized } : msg
          )
        );
      },
      onToolResult: ({ tool, result, error, step }) => {
        if (isViewingConversation(conversationId)) {
          completeToolCall(assistantId, tool, result, error, step);
          return;
        }
        mutateDraftMessages(conversationId, (msgs) =>
          msgs.map((msg) => {
            if (msg.id !== assistantId) return msg;
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
      onDone: () => {
        streamStopsRef.current.delete(conversationId);
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
      },
      onError: (err) => {
        streamStopsRef.current.delete(conversationId);
        if (isViewingConversation(conversationId)) {
          cancelStream();
          resetStream();
          const idsToRemove = isRegenerate
            ? [assistantId]
            : [userMsgId!, assistantId];
          removeMessages(idsToRemove);
        }
        clearStreamingState(conversationId);

        const errMsg =
          err instanceof ApiError ? err.displayMessage : err.message;
        if (errMsg.includes("已达上限")) {
          message.warning(LIMIT_ERROR_MSG);
        } else {
          message.error(errMsg);
        }
      },
    });
    streamStopsRef.current.set(conversationId, stop);
  }

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (
      !content ||
      activeConversationId == null ||
      streamingConversationIds.has(activeConversationId)
    ) {
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

      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";

      if (content !== userMsg.content) {
        updateMessage(userMsg.id, { content });
      }
      removeMessages([stoppedAssistant.id]);
      doSend(content, activeConversationId, selectedPrompt?.id, selectedKnowledgeBaseIds, {
        regenerate: true,
      });
      return;
    }

    await doSend(
      content,
      activeConversationId,
      selectedPrompt?.id,
      selectedKnowledgeBaseIds
    );
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
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
          {isActiveConvStreaming && (
            <span className="chat-status-pill">生成中</span>
          )}
        </div>
        <ChatFullscreenButton
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
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
                <span className="chat-status-pill chat-status-pill--desktop">
                  生成中
                </span>
              )}
              <ChatFullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
              />
            </div>
          </header>

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
                              isActiveConvStreaming || activeConversationId == null
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
                    <KnowledgeBasePicker
                      options={knowledgeBases}
                      value={selectedKnowledgeBaseIds}
                      disabled={
                        isActiveConvStreaming || activeConversationId == null
                      }
                      onChange={setSelectedKnowledgeBaseIds}
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
                <PromptTemplateChip
                  selected={selectedPrompt}
                  disabled={isActiveConvStreaming || activeConversationId == null}
                  onClear={() => setSelectedPrompt(null)}
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
                  {isActiveConvStreaming ? (
                    <button
                      type="button"
                      className="chat-composer-stop"
                      onClick={handleStopGeneration}
                      aria-label="停止生成"
                    >
                      <StopOutlined />
                      <span>停止</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="chat-composer-send"
                      onClick={() => handleSend()}
                      disabled={!input.trim() || activeConversationId == null}
                      aria-label="发送消息"
                    >
                      <SendOutlined />
                    </button>
                  )}
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
