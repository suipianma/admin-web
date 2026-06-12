"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Avatar, Button, Drawer, Spin } from "antd";
import {
  BulbOutlined,
  MenuOutlined,
  RobotOutlined,
  SendOutlined,
} from "@ant-design/icons";
import ChatMarkdown from "@/components/ChatMarkdown";
import ConversationSidebar from "@/components/ConversationSidebar";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useUserInfo } from "@/hooks/useUserInfo";
import { streamChat } from "@/services/ai";
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  getConversations,
  updateConversation,
  type Conversation,
  type ConversationMessage,
} from "@/services/conversation";
import { ApiError } from "@/utils/apiError";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  fromCache?: boolean;
}

const SUGGESTIONS = [
  "你好，介绍一下自己",
  "NestJS 有哪些核心概念？",
  "帮我写一段登录接口示例",
];

// 与后端 CONVERSATION_MAX_MESSAGES 默认值一致
const MAX_MESSAGES_LIMIT = 200;

const LIMIT_ERROR_MSG = "会话消息已达上限，请新建会话";

function getUserAvatarText(username?: string) {
  if (!username) return "我";
  return username.slice(0, 1).toUpperCase();
}

/** 后端消息 → 页面 ChatMessage */
function mapConversationMessage(msg: ConversationMessage): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    thinking: msg.thinking ?? undefined,
    fromCache: msg.fromCache || undefined,
  };
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
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const msgIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const initDoneRef = useRef(false);

  // 刷新会话列表（发送成功后 updatedAt 会变化）
  const refreshConversations = useCallback(async (keepActiveId?: number) => {
    try {
      const res = await getConversations();
      setConversations(res.data);
      if (keepActiveId != null) {
        setActiveConversationId(keepActiveId);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "获取会话列表失败");
    }
  }, [message]);

  const loadMessages = useCallback(async (conversationId: number) => {
    setMessagesLoading(true);
    try {
      const res = await getConversationMessages(conversationId);
      const mapped = res.data.map(mapConversationMessage);
      setMessages(mapped);
      // 避免本地临时 id 与后端 id 冲突
      msgIdRef.current = mapped.reduce((max, m) => Math.max(max, m.id), 0);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载消息失败");
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [message]);

  // 初始化：拉列表 → 选第一个并 loadMessages；无则 createConversation
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
          const firstId = list[0].id;
          setActiveConversationId(firstId);
          await loadMessages(firstId);
        } else {
          const created = await createConversation();
          setConversations([created.data]);
          setActiveConversationId(created.data.id);
          setMessages([]);
        }
      } catch (err) {
        message.error(err instanceof Error ? err.message : "初始化会话失败");
      } finally {
        setConvLoading(false);
      }
    }

    void init();
  }, [loadMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    return () => stopStreamRef.current?.();
  }, []);

  function appendMessage(
    role: ChatMessage["role"],
    content: string,
    thinking?: string
  ) {
    msgIdRef.current += 1;
    const msg = { id: msgIdRef.current, role, content, thinking };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  }

  function updateAssistantMessage(
    id: number,
    payload: { content: string; thinking?: string; fromCache?: boolean }
  ) {
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
  }

  /** 流式失败时移除乐观追加的用户/助手消息 */
  function removeOptimisticMessages(userId: number, assistantId: number) {
    setMessages((prev) =>
      prev.filter((msg) => msg.id !== userId && msg.id !== assistantId)
    );
  }

  function handleClear() {
    if (streaming) return;
    setMessages([]);
    setInput("");
  }

  async function handleSelectConversation(id: number) {
    if (streaming || id === activeConversationId) return;
    setActiveConversationId(id);
    setInput("");
    setDrawerOpen(false);
    await loadMessages(id);
  }

  async function handleCreateConversation() {
    if (streaming) return;
    try {
      const res = await createConversation();
      setConversations((prev) => [res.data, ...prev]);
      setActiveConversationId(res.data.id);
      setMessages([]);
      setInput("");
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

      // 删除当前会话：切换至下一个或新建
      if (remaining.length > 0) {
        const nextId = remaining[0].id;
        setActiveConversationId(nextId);
        await loadMessages(nextId);
      } else {
        const created = await createConversation();
        setConversations([created.data]);
        setActiveConversationId(created.data.id);
        setMessages([]);
      }
      setDrawerOpen(false);
      message.success("会话已删除");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除会话失败");
    }
  }

  function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || activeConversationId == null) return;

    // 前端预检消息上限
    if (messages.length >= MAX_MESSAGES_LIMIT) {
      message.warning(LIMIT_ERROR_MSG);
      return;
    }

    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const userMsgId = appendMessage("user", content);
    const assistantId = appendMessage("assistant", "");
    setStreaming(true);

    stopStreamRef.current?.();

    stopStreamRef.current = streamChat(activeConversationId, content, {
      onUpdate: (reply) => {
        updateAssistantMessage(assistantId, {
          thinking: reply.thinking ? reply.thinking : undefined,
          content: reply.response,
          fromCache: reply.fromCache,
        });
      },
      onDone: () => {
        setStreaming(false);
        stopStreamRef.current = null;
        setMessages((prev) => {
          const target = prev.find((msg) => msg.id === assistantId);
          if (target && !target.content && !target.thinking) {
            return prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: "模型未返回有效内容" }
                : msg
            );
          }
          return prev;
        });
        // 发送成功后刷新列表（updatedAt 排序）
        void refreshConversations(activeConversationId);
      },
      onError: (err) => {
        setStreaming(false);
        stopStreamRef.current = null;
        const errMsg =
          err instanceof ApiError ? err.displayMessage : err.message;

        removeOptimisticMessages(userMsgId, assistantId);

        if (errMsg.includes("已达上限")) {
          message.warning(LIMIT_ERROR_MSG);
        } else {
          message.error(errMsg);
        }
      },
    });
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

  return (
    <div className="page-container page-container-full">
      {/* 移动端顶栏：打开会话 Drawer */}
      <div className="chat-mobile-header">
        <Button
          type="text"
          className="chat-mobile-menu-btn"
          icon={<MenuOutlined />}
          disabled={streaming}
          onClick={() => setDrawerOpen(true)}
          aria-label="打开会话列表"
        />
        <span className="chat-mobile-title">{activeTitle}</span>
        <Button
          type="text"
          size="small"
          disabled={streaming || messages.length === 0}
          onClick={handleClear}
        >
          清空
        </Button>
      </div>

      <div className="chat-layout">
        {/* 桌面端侧边栏 */}
        <aside className="chat-sidebar">
          <ConversationSidebar {...sidebarProps} />
        </aside>

        {/* 移动端 Drawer */}
        <Drawer
          title="会话列表"
          placement="left"
          open={drawerOpen}
          size={280}
          className="chat-drawer"
          onClose={() => setDrawerOpen(false)}
        >
          <ConversationSidebar {...sidebarProps} />
        </Drawer>

        <main className="chat-main">
          <PageHeader
            title="AI 聊天"
            extra={
              <Button
                onClick={handleClear}
                disabled={streaming || messages.length === 0}
              >
                清空
              </Button>
            }
          />

          <div className="chat-panel">
            <div ref={listRef} className="chat-body">
              {messagesLoading ? (
                <div className="chat-messages-loading">
                  <Spin description="加载消息..." />
                </div>
              ) : (
                <div className="chat-stream">
                  {messages.length === 0 ? (
                    <div className="chat-welcome">
                      <Avatar
                        size={56}
                        className="chat-welcome-avatar"
                        icon={<RobotOutlined />}
                      />
                      <h2 className="chat-welcome-title">有什么可以帮你的？</h2>
                      <p className="chat-welcome-desc">
                        我是 AI 助手，可以解答技术问题、生成代码示例
                      </p>
                      <div className="chat-welcome-list">
                        {SUGGESTIONS.map((text) => (
                          <button
                            key={text}
                            type="button"
                            className="chat-suggestion-btn"
                            disabled={streaming || activeConversationId == null}
                            onClick={() => handleSend(text)}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const isUser = msg.role === "user";
                      const isLast = index === messages.length - 1;
                      const isWaiting =
                        streaming &&
                        isLast &&
                        !isUser &&
                        !msg.content &&
                        !msg.thinking;

                      if (isUser) {
                        return (
                          <div key={msg.id} className="chat-row chat-row-user">
                            <div className="chat-row-main">
                              <div className="chat-meta chat-meta-user">我</div>
                              <div className="chat-bubble chat-bubble-user">
                                {msg.content}
                              </div>
                            </div>
                            <Avatar
                              className="chat-avatar chat-avatar-user"
                              size={36}
                            >
                              {getUserAvatarText(userInfo?.username)}
                            </Avatar>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className="chat-row chat-row-ai">
                          <Avatar
                            className="chat-avatar chat-avatar-ai"
                            size={36}
                            icon={<RobotOutlined />}
                          />
                          <div className="chat-row-main">
                            <div className="chat-meta chat-meta-ai">
                              AI 助手
                              {msg.fromCache && (
                                <span className="chat-cache-tag">缓存</span>
                              )}
                            </div>
                            <div className="chat-bubble chat-bubble-ai">
                              {isWaiting ? (
                                <span className="chat-loading">
                                  <Spin size="small" />
                                  <span>思考中...</span>
                                </span>
                              ) : (
                                <div className="chat-ai-content">
                                  {msg.thinking && (
                                    <details className="chat-thinking" open>
                                      <summary className="chat-thinking-summary">
                                        <BulbOutlined />
                                        <span>思考过程</span>
                                      </summary>
                                      <div
                                        className={`chat-thinking-body${
                                          streaming && isLast && !msg.content
                                            ? " chat-thinking-body--streaming"
                                            : ""
                                        }`}
                                      >
                                        <ChatMarkdown
                                          content={msg.thinking}
                                          className="chat-markdown-thinking"
                                        />
                                      </div>
                                    </details>
                                  )}
                                  {msg.content && (
                                    <div
                                      className={`chat-answer${
                                        streaming && isLast
                                          ? " chat-answer--streaming"
                                          : ""
                                      }`}
                                    >
                                      {msg.thinking && (
                                        <div className="chat-answer-label">
                                          回答
                                        </div>
                                      )}
                                      <ChatMarkdown content={msg.content} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="chat-footer">
              <div className="chat-composer">
                <textarea
                  ref={inputRef}
                  className="chat-composer-input"
                  value={input}
                  rows={1}
                  placeholder="输入消息，Enter 发送，Shift + Enter 换行"
                  disabled={streaming || activeConversationId == null}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                />
                <button
                  type="button"
                  className="chat-composer-send"
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
        </main>
      </div>
    </div>
  );
}
