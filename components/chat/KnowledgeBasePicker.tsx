"use client";

import { Select } from "antd";
import type { KnowledgeBase } from "@/services/knowledge-base";

interface KnowledgeBasePickerProps {
  options: KnowledgeBase[];
  value: number[];
  disabled?: boolean;
  compact?: boolean;
  onChange: (ids: number[]) => void;
}

export default function KnowledgeBasePicker({
  options,
  value,
  disabled,
  compact = false,
  onChange,
}: KnowledgeBasePickerProps) {
  return (
    <div className={compact ? "chat-kb-picker chat-kb-picker--compact" : "chat-kb-picker"}>
      {!compact && (
        <div className="chat-welcome-section-label">RAG 知识库</div>
      )}
      <Select
        mode="multiple"
        value={value}
        disabled={disabled}
        placeholder={compact ? "知识库 RAG（可多选）" : "选择要检索的知识库（可多选）"}
        style={{ width: "100%" }}
        maxTagCount={compact ? 2 : "responsive"}
        options={options.map((item) => ({ label: item.name, value: item.id }))}
        onChange={(ids) => onChange(ids as number[])}
      />
    </div>
  );
}
