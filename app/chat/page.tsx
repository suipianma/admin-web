"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Spin } from "antd";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { streamChat } from "@/services/ai";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "你好，介绍一下自己",
  "NestJS 有哪些核心概念？",
  "帮我写一段登录接口示例",
];

export default function ChatPage() {
  useAuth();

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

  function appendMessage(role: ChatMessage["role"], content: string) {
    msgIdRef.current += 1;
    const msg = { id: msgIdRef.current, role, content };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
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
    setStreaming(true);

    const assistantId = appendMessage("assistant", "");
    stopStreamRef.current = streamChat(
      (char) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + char }
              : msg
          )
        );
      },
      () => {
        setStreaming(false);
        stopStreamRef.current = null;
      }
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
                <h2 className="chat-welcome-title">有什么可以帮你的？</h2>
                <div className="chat-welcome-list">
                  {SUGGESTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
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
                const isTyping =
                  streaming && isLast && !isUser && !msg.content;

                if (isUser) {
                  return (
                    <div key={msg.id} className="chat-item chat-item-user">
                      <div className="chat-bubble-user">{msg.content}</div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="chat-item chat-item-ai">
                    <div className="chat-bubble-ai">
                      {isTyping ? (
                        <Spin size="small" />
                      ) : (
                        <>
                          {msg.content}
                          {streaming && isLast && (
                            <span className="chat-cursor" />
                          )}
                        </>
                      )}
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
              placeholder="输入消息，Enter 发送"
              disabled={streaming}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="chat-composer-send"
              onClick={() => handleSend()}
              disabled={streaming || !input.trim()}
            >
              {streaming ? "..." : "发送"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
