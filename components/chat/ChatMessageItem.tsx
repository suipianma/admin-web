"use client";

import { memo } from "react";
import { Avatar } from "antd";
import { BulbOutlined, RobotOutlined } from "@ant-design/icons";
import ChatMarkdown from "@/components/ChatMarkdown";
import ToolCallBlock from "@/components/chat/ToolCallBlock";
import AgentStepBlock from "@/components/chat/AgentStepBlock";
import CitationBlock from "@/components/chat/CitationBlock";
import type { RagCitation } from "@/services/ai";

export interface ToolCallItem {
  tool: string;
  args: Record<string, string>;
  result?: string;
  status: "calling" | "done" | "error";
}

export interface AgentStepItem {
  step: number;
  type: "start" | "step" | "tool_call" | "tool_result" | "done";
  tool?: string;
  args?: Record<string, string>;
  result?: string;
  error?: string;
  maxSteps?: number;
  totalSteps?: number;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  fromCache?: boolean;
  toolCalls?: ToolCallItem[];
  agentSteps?: AgentStepItem[];
  citations?: RagCitation[];
}

interface ChatMessageItemProps {
  msg: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
  userAvatarText: string;
}

function TypingIndicator() {
  return (
    <span className="chat-typing" aria-label="思考中">
      <span className="chat-typing-dot" />
      <span className="chat-typing-dot" />
      <span className="chat-typing-dot" />
    </span>
  );
}

function ChatMessageItem({
  msg,
  isLast,
  isStreaming,
  userAvatarText,
}: ChatMessageItemProps) {
  const isUser = msg.role === "user";
  const isWaiting =
    isStreaming &&
    isLast &&
    !isUser &&
    !msg.content &&
    !msg.thinking &&
    !msg.toolCalls?.length &&
    !msg.agentSteps?.length;
  const isStreamingMsg = isStreaming && isLast && !isUser;

  if (isUser) {
    return (
      <div className="chat-row chat-row-user">
        <div className="chat-row-main">
          <div className="chat-bubble chat-bubble-user">{msg.content}</div>
        </div>
        <Avatar className="chat-avatar chat-avatar-user" size={32}>
          {userAvatarText}
        </Avatar>
      </div>
    );
  }

  return (
    <div className="chat-row chat-row-ai">
      <Avatar
        className="chat-avatar chat-avatar-ai"
        size={32}
        icon={<RobotOutlined />}
      />
      <div className="chat-row-main">
        <div className="chat-ai-header">
          <span className="chat-ai-name">AI 助手</span>
          {msg.fromCache && <span className="chat-cache-tag">缓存</span>}
          {isStreamingMsg && (
            <span className="chat-streaming-tag">
              {msg.toolCalls?.some((t) => t.status === "calling")
                ? "调用工具"
                : msg.agentSteps?.length
                  ? "Agent 推理"
                  : msg.content
                  ? "输出中"
                  : msg.thinking
                    ? "思考中"
                    : "生成中"}
            </span>
          )}
        </div>
        <div className="chat-bubble chat-bubble-ai">
          {isWaiting ? (
            <div className="chat-loading">
              <TypingIndicator />
              <span>正在思考</span>
            </div>
          ) : (
            <div className="chat-ai-content">
              {msg.agentSteps && msg.agentSteps.length > 0 && (
                <AgentStepBlock steps={msg.agentSteps} />
              )}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <ToolCallBlock toolCalls={msg.toolCalls} />
              )}
              {msg.citations && msg.citations.length > 0 && (
                <CitationBlock citations={msg.citations} />
              )}
              {msg.thinking && (
                <details className="chat-thinking" open={isStreamingMsg}>
                  <summary className="chat-thinking-summary">
                    <BulbOutlined />
                    <span>思考过程</span>
                  </summary>
                  <div
                    className={`chat-thinking-body${
                      isStreamingMsg && !msg.content
                        ? " chat-thinking-body--streaming"
                        : ""
                    }`}
                  >
                    <ChatMarkdown
                      content={msg.thinking}
                      className="chat-markdown-thinking"
                      streaming={isStreamingMsg && !msg.content}
                      forceParse={!isStreamingMsg}
                    />
                  </div>
                </details>
              )}
              {msg.content && (
                <div
                  className={`chat-answer${
                    isStreamingMsg ? " chat-answer--streaming" : ""
                  }`}
                >
                  {msg.thinking && <div className="chat-answer-label">回答</div>}
                  <ChatMarkdown
                    content={msg.content}
                    streaming={isStreamingMsg}
                    forceParse={!isStreamingMsg}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ChatMessageItem, (prev, next) => {
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.content === next.msg.content &&
    prev.msg.thinking === next.msg.thinking &&
    prev.msg.fromCache === next.msg.fromCache &&
    JSON.stringify(prev.msg.toolCalls) === JSON.stringify(next.msg.toolCalls) &&
    JSON.stringify(prev.msg.agentSteps) === JSON.stringify(next.msg.agentSteps) &&
    JSON.stringify(prev.msg.citations) === JSON.stringify(next.msg.citations) &&
    prev.isLast === next.isLast &&
    prev.isStreaming === next.isStreaming &&
    prev.userAvatarText === next.userAvatarText
  );
});
