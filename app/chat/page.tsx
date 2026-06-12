"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Button, message, Spin } from "antd";
import { BulbOutlined, RobotOutlined, SendOutlined } from "@ant-design/icons";
import ChatMarkdown from "@/components/ChatMarkdown";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useUserInfo } from "@/hooks/useUserInfo";
import { streamChat } from "@/services/ai";
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

function getUserAvatarText(username?: string) {
  if (!username) return "我";
  return username.slice(0, 1).toUpperCase();
}

export default function ChatPage() {
  useAuth();
  const userInfo = useUserInfo();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const msgIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

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

  function handleClear() {
    if (streaming) return;
    setMessages([]);
    setInput("");
  }

  function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    appendMessage("user", content);
    const assistantId = appendMessage("assistant", "");
    setStreaming(true);

    stopStreamRef.current?.();

    stopStreamRef.current = streamChat(content, {
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
      },
      onError: (err) => {
        setStreaming(false);
        stopStreamRef.current = null;
        const errMsg =
          err instanceof ApiError ? err.displayMessage : err.message;
        updateAssistantMessage(assistantId, { content: errMsg });
        message.error(errMsg);
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

  return (
    <div className="page-container page-container-full">
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
                      disabled={streaming}
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
                      <Avatar className="chat-avatar chat-avatar-user" size={36}>
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
                                  streaming && isLast ? " chat-answer--streaming" : ""
                                }`}
                              >
                                {msg.thinking && (
                                  <div className="chat-answer-label">回答</div>
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
        </div>

        <div className="chat-footer">
          <div className="chat-composer">
            <textarea
              ref={inputRef}
              className="chat-composer-input"
              value={input}
              rows={1}
              placeholder="输入消息，Enter 发送，Shift + Enter 换行"
              disabled={streaming}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="chat-composer-send"
              onClick={() => handleSend()}
              disabled={streaming || !input.trim()}
              aria-label="发送消息"
            >
              {streaming ? <Spin size="small" /> : <SendOutlined />}
            </button>
          </div>
          <p className="chat-footer-tip">内容由 AI 生成，请自行甄别</p>
        </div>
      </div>
    </div>
  );
}
