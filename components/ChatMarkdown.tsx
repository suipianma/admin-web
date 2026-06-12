"use client";

import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMarkdownProps {
  content: string;
  className?: string;
  /** 流式输出中：纯文本，不解析 Markdown */
  streaming?: boolean;
  /** 强制解析（流式结束） */
  forceParse?: boolean;
}

function ChatMarkdownInner({
  content,
  className,
  streaming = false,
  forceParse = false,
}: ChatMarkdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(forceParse);

  useEffect(() => {
    if (forceParse) {
      setVisible(true);
      return;
    }

    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [forceParse]);

  // 流式中走纯文本，避免频繁 Markdown 解析
  if (streaming) {
    return (
      <div
        ref={rootRef}
        className={`chat-markdown chat-markdown-plain ${className ?? ""}`}
      >
        {content}
      </div>
    );
  }

  if (!visible) {
    return (
      <div
        ref={rootRef}
        className={`chat-markdown chat-markdown-plain ${className ?? ""}`}
      >
        {content}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`chat-markdown ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default memo(ChatMarkdownInner);
