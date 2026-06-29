"use client";

import { Select } from "antd";
import { AI_MODEL_OPTIONS, DEFAULT_AI_MODEL } from "@/config/models";

interface ModelSelectorProps {
  value: string;
  disabled?: boolean;
  onChange: (model: string) => void;
}

/** Composer 模型选择器 */
export default function ModelSelector({
  value,
  disabled,
  onChange,
}: ModelSelectorProps) {
  if (AI_MODEL_OPTIONS.length <= 1) {
    return null;
  }

  return (
    <div className="chat-model-picker chat-model-picker--compact">
      <Select
        value={value || DEFAULT_AI_MODEL}
        disabled={disabled}
        size="small"
        style={{ minWidth: 140 }}
        options={AI_MODEL_OPTIONS.map((model) => ({
          label: model,
          value: model,
        }))}
        onChange={onChange}
      />
    </div>
  );
}
