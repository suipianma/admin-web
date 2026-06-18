"use client";

import { ToolOutlined } from "@ant-design/icons";
import type { ToolCallItem } from "@/components/chat/ChatMessageItem";

interface ToolCallBlockProps {
  toolCalls: ToolCallItem[];
}

export default function ToolCallBlock({ toolCalls }: ToolCallBlockProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="chat-tool-calls">
      {toolCalls.map((item, index) => (
        <div key={`${item.tool}-${index}`} className="chat-tool-call">
          <div className="chat-tool-call-header">
            <ToolOutlined />
            <span>调用工具 {item.tool}</span>
            {item.status === "calling" && (
              <span className="chat-tool-call-status">执行中...</span>
            )}
            {item.status === "error" && (
              <span className="chat-tool-call-status chat-tool-call-status--error">
                失败
              </span>
            )}
          </div>
          <div className="chat-tool-call-args">
            {Object.entries(item.args).map(([key, value]) => (
              <div key={key} className="chat-tool-call-arg">
                <span className="chat-tool-call-arg-key">{key}</span>
                <span className="chat-tool-call-arg-value">{value}</span>
              </div>
            ))}
          </div>
          {item.result && (
            <div className="chat-tool-call-result">
              <span className="chat-tool-call-result-label">结果</span>
              <span>{item.result}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
