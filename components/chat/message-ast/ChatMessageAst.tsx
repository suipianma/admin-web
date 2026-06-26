"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import MessageBlockList from "./MessageBlockList";
import { parseMarkdownToBlocks } from "./parseMarkdown";
import type { MessageBlock } from "./types";

interface ChatMessageAstProps {
  /** Markdown 源文本 */
  content: string;
  className?: string;
  /** 流式输出中：增量解析 AST，标题/列表实时结构化展示 */
  streaming?: boolean;
  /** 强制解析（流式结束） */
  forceParse?: boolean;
  /** 前置结构化块（tool / citation 等） */
  prefixBlocks?: MessageBlock[];
}

function ChatMessageAstInner({
  content,
  className,
  streaming = false,
  forceParse = false,
  prefixBlocks = [],
}: ChatMessageAstProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(forceParse);

  useEffect(() => {
    if (forceParse || streaming) {
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
  }, [forceParse, streaming]);

  const markdownBlocks = useMemo(() => {
    if (!content.trim()) return [];
    if (!streaming && !visible) return [];
    try {
      return parseMarkdownToBlocks(content);
    } catch {
      return [];
    }
  }, [content, streaming, visible]);

  const blocks = useMemo(
    () => [...prefixBlocks, ...markdownBlocks],
    [prefixBlocks, markdownBlocks]
  );

  if (streaming) {
    return (
      <div ref={rootRef}>
        {blocks.length > 0 ? (
          <MessageBlockList blocks={blocks} className={className} />
        ) : content ? (
          <div
            className={`msg-ast-root msg-ast-plain${className ? ` ${className}` : ""}`}
          >
            <div className="msg-ast-streaming-text">{content}</div>
          </div>
        ) : null}
      </div>
    );
  }

  if (!visible) {
    return (
      <div
        ref={rootRef}
        className={`msg-ast-root msg-ast-plain${className ? ` ${className}` : ""}`}
      >
        {content}
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <MessageBlockList blocks={blocks} className={className} />
    </div>
  );
}

export default memo(ChatMessageAstInner);
