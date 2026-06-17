"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Avatar, Button, Drawer, Spin } from "antd";
import {
  CodeOutlined,
  MenuOutlined,
  MessageOutlined,
  RobotOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
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
import { getPromptTemplates, type PromptTemplateItem } from "@/services/prompt";
import {
  createConversation,
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
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateItem[]>(
    []
  );
  const [selectedPrompt, setSelectedPrompt] =
    useState<PromptTemplateItem | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const initDoneRef = useRef(false);
  const assistantIdRef = useRef<number | null>(null);

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
    appendOptimistic,
    updateMessage,
    removeMessages,
    reset: resetMessages,
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
    return () => stopStreamRef.current?.();
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

  const handleStreamFlush = useCallback(
    (reply: { thinking: string; response: string; fromCache?: boolean }) => {
      const assistantId = assistantIdRef.current;
      if (assistantId == null) return;
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

  async function handleSelectConversation(id: number) {
    if (streaming || id === activeConversationId) return;
    setActiveConversationId(id);
    setInput("");
    setSelectedPrompt(null);
    setDrawerOpen(false);
    await loadInitial(id);
  }

  async function handleCreateConversation() {
    if (streaming) return;
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
    if (streaming) return;
    try {
      await deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);

      if (activeConversationId !== id) return;

      if (remaining.length > 0) {
        const nextId = remaining[0].id;
        setActiveConversationId(nextId);
        await loadInitial(nextId);
      } else {
        const created = await createConversation();
        setConversations([created.data]);
        setActiveConversationId(created.data.id);
        resetMessages();
      }
      setDrawerOpen(false);
      message.success("会话已删除");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除会话失败");
    }
  }

  function handlePromptSelect(item: PromptTemplateItem) {
    setSelectedPrompt((prev) => toggleTemplate(prev, item));
  }

  function doSend(
    content: string,
    conversationId: number,
    promptId?: string
  ) {
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const userMsgId = appendOptimistic("user", content);
    const assistantId = appendOptimistic("assistant", "");
    assistantIdRef.current = assistantId;
    setStreaming(true);
    resetStream();

    stopStreamRef.current?.();

    stopStreamRef.current = streamChat(conversationId, content, {
      promptId,
      onUpdate: (reply) => pushStream(reply),
      onDone: () => {
        flushNow();
        setStreaming(false);
        stopStreamRef.current = null;
        assistantIdRef.current = null;

        void syncFromServer(conversationId).then(() => {
          void refreshConversations(conversationId);
        });
      },
      onError: (err) => {
        cancelStream();
        resetStream();
        setStreaming(false);
        stopStreamRef.current = null;
        assistantIdRef.current = null;

        removeMessages([userMsgId, assistantId]);

        const errMsg =
          err instanceof ApiError ? err.displayMessage : err.message;
        if (errMsg.includes("已达上限")) {
          message.warning(LIMIT_ERROR_MSG);
        } else {
          message.error(errMsg);
        }
      },
    });
  }

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || activeConversationId == null) return;

    if (total >= 200) {
      message.warning(LIMIT_ERROR_MSG);
      return;
    }

    // 选中模板则本次发送带 promptId，未选中则普通对话
    await doSend(content, activeConversationId, selectedPrompt?.id);
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

  const sidebarProps = {
    conversations,
    activeId: activeConversationId,
    loading: convLoading,
    disabled: streaming,
    onSelect: handleSelectConversation,
    onCreate: handleCreateConversation,
    onRename: handleRenameConversation,
    onDelete: handleDeleteConversation,
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
          disabled={streaming}
          onClick={() => setDrawerOpen(true)}
          aria-label="打开会话列表"
        />
        <div className="chat-mobile-header-main">
          <span className="chat-mobile-title">{activeTitle}</span>
          {streaming && <span className="chat-status-pill">生成中</span>}
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
                  {streaming
                    ? "AI 正在回复..."
                    : messages.length > 0
                      ? `共 ${total} 条消息`
                      : "开始一段新对话"}
                </p>
              </div>
            </div>
            <div className="chat-panel-header-actions">
              {streaming && (
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
                            disabled={streaming || activeConversationId == null}
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
                      disabled={streaming || activeConversationId == null}
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
                  streaming={streaming}
                  loadingMore={loadingMore}
                  hasMore={hasMore}
                  userAvatarText={userAvatarText}
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
                  disabled={streaming || activeConversationId == null}
                  onClear={() => setSelectedPrompt(null)}
                />
                <div className="chat-composer">
                  <PromptTemplateMenu
                    templates={promptTemplates}
                    selected={selectedPrompt}
                    disabled={streaming || activeConversationId == null}
                    onSelect={handlePromptSelect}
                  />
                  <textarea
                    ref={inputRef}
                    className="chat-composer-input"
                    value={input}
                    rows={1}
                    placeholder={
                      streaming
                        ? "AI 正在回复，请稍候..."
                        : selectedPrompt
                          ? `已启用「${selectedPrompt.name}」，填写${selectedPrompt.contextLabel}`
                          : "输入消息，Enter 发送，Shift + Enter 换行"
                    }
                    disabled={streaming || activeConversationId == null}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="button"
                    className={`chat-composer-send${streaming ? " chat-composer-send--loading" : ""}`}
                    onClick={() => handleSend()}
                    disabled={
                      streaming || !input.trim() || activeConversationId == null
                    }
                    aria-label="发送消息"
                  >
                    {streaming ? <Spin size="small" /> : <SendOutlined />}
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
