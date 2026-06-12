"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import type { ChatMessage } from "./ChatMessageItem";

export interface ChatNavItem {
  id: number;
  index: number;
  label: string;
}

interface ChatMessageNavigatorProps {
  messages: ChatMessage[];
  firstItemIndex: number;
  activeMessageId: number | null;
  onScrollToMessage: (messageId: number) => void;
  showScrollBottom: boolean;
  onScrollToBottom: () => void;
}

function truncateText(text: string, max = 48) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "空消息";
  return oneLine.length > max ? `${oneLine.slice(0, max)}...` : oneLine;
}

/** 从用户消息生成导航锚点 */
export function buildChatNavItems(
  messages: ChatMessage[],
  firstItemIndex: number
): ChatNavItem[] {
  return messages
    .map((msg, arrayIndex) => ({ msg, arrayIndex }))
    .filter(({ msg }) => msg.role === "user")
    .map(({ msg, arrayIndex }) => ({
      id: msg.id,
      index: firstItemIndex + arrayIndex,
      label: truncateText(msg.content),
    }));
}

/** 根据视口内消息 DOM 位置推算当前激活的用户消息（比 rangeChanged 更准确） */
export function resolveActiveNavIdFromViewport(
  scroller: HTMLElement | null,
  messages: ChatMessage[],
  topOffset: number
): number | null {
  if (!scroller) return null;

  const anchorY = scroller.getBoundingClientRect().top + topOffset;
  let activeId: number | null = null;

  for (const msg of messages) {
    if (msg.role !== "user") continue;

    const el = scroller.querySelector(
      `[data-message-id="${msg.id}"]`
    ) as HTMLElement | null;
    if (!el) continue;

    // 取「已滚过顶部锚线」的最后一条用户消息 = 当前阅读位置
    if (el.getBoundingClientRect().top <= anchorY + 32) {
      activeId = msg.id;
    }
  }

  return activeId;
}

export default function ChatMessageNavigator({
  messages,
  firstItemIndex,
  activeMessageId,
  onScrollToMessage,
  showScrollBottom,
  onScrollToBottom,
}: ChatMessageNavigatorProps) {
  const [open, setOpen] = useState(true);

  // 移动端默认收起，避免占满屏幕
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setOpen(false);
    }
  }, []);

  const navItems = useMemo(
    () => buildChatNavItems(messages, firstItemIndex),
    [messages, firstItemIndex]
  );

  if (navItems.length < 2) return null;

  function scrollToItem(item: ChatNavItem) {
    onScrollToMessage(item.id);
  }

  return (
    <aside
      className={`chat-message-nav${open ? "" : " chat-message-nav--collapsed"}`}
      aria-label="对话导航"
    >
      <div className="chat-nav-toolbar">
        <button
          type="button"
          className="chat-nav-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "收起导航" : "展开导航"}
          title={open ? "收起导航" : "展开导航"}
        >
          {open ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
        </button>
        {open && <span className="chat-nav-toolbar-title">对话导航</span>}
      </div>

      {open && (
        <ul className="chat-nav-list">
          {navItems.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                className={`chat-nav-item${
                  activeMessageId === item.id ? " chat-nav-item--active" : ""
                }`}
                onClick={() => scrollToItem(item)}
                title={item.label}
              >
                <span className="chat-nav-item-index">{idx + 1}</span>
                <span className="chat-nav-item-text">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showScrollBottom && (
        <button
          type="button"
          className="chat-scroll-bottom-btn"
          aria-label="回到底部"
          title="回到底部"
          onClick={onScrollToBottom}
        >
          <DownOutlined />
        </button>
      )}
    </aside>
  );
}
