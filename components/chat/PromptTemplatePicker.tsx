"use client";

import { useState } from "react";
import { CloseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Popover } from "antd";
import type { PromptTemplateItem } from "@/services/prompt";

interface PickerProps {
  templates: PromptTemplateItem[];
  selected: PromptTemplateItem | null;
  disabled?: boolean;
  onSelect: (template: PromptTemplateItem) => void;
  onClear: () => void;
}

function toggleTemplate(
  prev: PromptTemplateItem | null,
  item: PromptTemplateItem
): PromptTemplateItem | null {
  return prev?.id === item.id ? null : item;
}

/** 欢迎区：Prompt 模板卡片列表 */
export function PromptTemplatePicker({
  templates,
  selected,
  disabled,
  onSelect,
}: PickerProps) {
  if (templates.length === 0) return null;

  return (
    <div className="chat-welcome-section chat-prompt-section">
      <div className="chat-welcome-divider">
        <span>Prompt 模板</span>
      </div>
      <div className="chat-prompt-grid">
        {templates.map((item) => {
          const isActive = selected?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`chat-prompt-card${isActive ? " chat-prompt-card--active" : ""}`}
              disabled={disabled}
              onClick={() => onSelect(item)}
            >
              <span className="chat-prompt-card-icon" aria-hidden>
                <FileTextOutlined />
              </span>
              <span className="chat-prompt-card-body">
                <span className="chat-prompt-card-name">{item.name}</span>
                <span className="chat-prompt-card-desc">{item.description}</span>
              </span>
              {isActive && (
                <span className="chat-prompt-card-badge">已选</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 输入区工具栏：Prompt 模板 Popover（任意会话可用） */
export function PromptTemplateMenu({
  templates,
  selected,
  disabled,
  onSelect,
}: Omit<PickerProps, "onClear">) {
  const [open, setOpen] = useState(false);

  if (templates.length === 0) return null;

  const content = (
    <div className="chat-prompt-popover">
      <p className="chat-prompt-popover-title">选择 Prompt 模板</p>
      <p className="chat-prompt-popover-tip">
        选中后，本次发送将套用模板；再次点击可关闭
      </p>
      <ul className="chat-prompt-popover-list">
        {templates.map((item) => {
          const isActive = selected?.id === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`chat-prompt-popover-item${
                  isActive ? " chat-prompt-popover-item--active" : ""
                }`}
                disabled={disabled}
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
              >
                <span className="chat-prompt-popover-item-name">{item.name}</span>
                <span className="chat-prompt-popover-item-desc">
                  {item.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="topLeft"
      open={open}
      onOpenChange={setOpen}
      overlayClassName="chat-prompt-popover-overlay"
    >
      <button
        type="button"
        className={`chat-composer-tool${
          selected ? " chat-composer-tool--active" : ""
        }`}
        disabled={disabled}
        aria-label="选择 Prompt 模板"
        title="Prompt 模板"
      >
        <FileTextOutlined />
      </button>
    </Popover>
  );
}

/** 输入区上方：已选模板紧凑条 */
export function PromptTemplateChip({
  selected,
  disabled,
  onClear,
}: Pick<PickerProps, "selected" | "disabled" | "onClear">) {
  if (!selected) return null;

  return (
    <div className="chat-prompt-chip">
      <div className="chat-prompt-chip-main">
        <FileTextOutlined className="chat-prompt-chip-icon" />
        <span className="chat-prompt-chip-name">{selected.name}</span>
        <span className="chat-prompt-chip-hint">
          已启用 · 本次发送将使用此模板 · 填写{selected.contextLabel}
          {selected.contextPlaceholder
            ? `（如 ${selected.contextPlaceholder}）`
            : ""}
        </span>
      </div>
      <button
        type="button"
        className="chat-prompt-chip-clear"
        disabled={disabled}
        onClick={onClear}
        aria-label="取消模板"
      >
        <CloseOutlined />
      </button>
    </div>
  );
}

export { toggleTemplate };
