"use client";

import { useState } from "react";
import { DownOutlined, RobotOutlined } from "@ant-design/icons";
import type { AgentStepItem } from "@/components/chat/ChatMessageItem";

interface AgentStepBlockProps {
  steps: AgentStepItem[];
}

export default function AgentStepBlock({ steps }: AgentStepBlockProps) {
  const [open, setOpen] = useState(true);

  if (steps.length === 0) return null;

  const startStep = steps.find((item) => item.type === "start");
  const doneStep = steps.find((item) => item.type === "done");

  return (
    <div className="chat-agent-steps">
      <button
        type="button"
        className="chat-agent-steps-toggle"
        onClick={() => setOpen((prev) => !prev)}
      >
        <RobotOutlined />
        <span>
          Agent 推理
          {startStep?.maxSteps != null ? `（最多 ${startStep.maxSteps} 步）` : ""}
          {doneStep?.totalSteps != null ? ` · 已执行 ${doneStep.totalSteps} 步` : ""}
        </span>
        <DownOutlined
          className={`chat-agent-steps-chevron${open ? " chat-agent-steps-chevron--open" : ""}`}
        />
      </button>
      {open && (
        <div className="chat-agent-steps-body">
          {steps.map((item, index) => (
            <div key={`${item.type}-${item.step}-${index}`} className="chat-agent-step">
              {item.type === "start" && (
                <span className="chat-agent-step-label">开始推理</span>
              )}
              {item.type === "step" && (
                <span className="chat-agent-step-label">
                  第 {item.step}/{item.maxSteps} 步
                </span>
              )}
              {item.type === "tool_call" && (
                <>
                  <span className="chat-agent-step-label">
                    第 {item.step} 步 · 调用 {item.tool}
                  </span>
                  {item.args && (
                    <div className="chat-agent-step-detail">
                      {Object.entries(item.args)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(" · ")}
                    </div>
                  )}
                </>
              )}
              {item.type === "tool_result" && item.result && (
                <div className="chat-agent-step-detail">
                  {item.tool} 结果：{item.result.slice(0, 120)}
                  {item.result.length > 120 ? "…" : ""}
                </div>
              )}
              {item.type === "done" && (
                <span className="chat-agent-step-label">推理完成，生成回答</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
