"use client";

import { Button } from "antd";
import { CompressOutlined, ExpandOutlined } from "@ant-design/icons";

interface ChatFullscreenButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
}

export default function ChatFullscreenButton({
  isFullscreen,
  onToggle,
}: ChatFullscreenButtonProps) {
  return (
    <Button
      type="text"
      className="chat-fullscreen-btn"
      icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
      onClick={onToggle}
      aria-label={isFullscreen ? "退出全屏" : "全屏"}
      title={isFullscreen ? "退出全屏 (Esc)" : "全屏"}
    />
  );
}
