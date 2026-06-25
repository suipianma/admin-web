"use client";

import { Select } from "antd";
import type { KnowledgeBase } from "@/services/knowledge-base";

interface KnowledgeBasePickerProps {
  options: KnowledgeBase[];
  value: number[];
  disabled?: boolean;
  onChange: (ids: number[]) => void;
}

export default function KnowledgeBasePicker({
  options,
  value,
  disabled,
  onChange,
}: KnowledgeBasePickerProps) {
  return (
    <div className="chat-kb-picker">
      <div className="chat-welcome-section-label">RAG 知识库</div>
      <Select
        mode="multiple"
        value={value}
        disabled={disabled}
        placeholder="选择要检索的知识库（可多选）"
        style={{ width: "100%" }}
        maxTagCount="responsive"
        options={options.map((item) => ({ label: item.name, value: item.id }))}
        onChange={(ids) => onChange(ids as number[])}
      />
    </div>
  );
}
