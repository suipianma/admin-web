"use client";

import { memo } from "react";
import { ToolOutlined, ReadOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import type { MessageBlock } from "./types";
import { renderInlineNodes } from "./renderInline";
import LazyCodeBlock from "./LazyCodeBlock";

interface MessageBlockListProps {
  blocks: MessageBlock[];
  className?: string;
}

function TextBlock({
  block,
}: {
  block: Extract<MessageBlock, { type: "text" }>;
}) {
  const Tag =
    block.heading === 1
      ? "h1"
      : block.heading === 2
        ? "h2"
        : block.heading === 3
          ? "h3"
          : block.heading === 4
            ? "h4"
            : block.heading === 5
              ? "h5"
              : block.heading === 6
                ? "h6"
                : "p";

  return (
    <Tag className={`msg-ast-text${block.heading ? " msg-ast-heading" : ""}`}>
      {renderInlineNodes(block.inlines)}
    </Tag>
  );
}

function CodeBlock({
  block,
}: {
  block: Extract<MessageBlock, { type: "code" }>;
}) {
  return <LazyCodeBlock language={block.language} value={block.value} />;
}

function TableBlock({
  block,
}: {
  block: Extract<MessageBlock, { type: "table" }>;
}) {
  return (
    <div className="msg-ast-table-wrap">
      <table className="msg-ast-table">
        {block.headers.length > 0 && (
          <thead>
            <tr>
              {block.headers.map((cell, i) => (
                <th key={i}>{cell}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImageBlock({
  block,
}: {
  block: Extract<MessageBlock, { type: "image" }>;
}) {
  return (
    <figure className="msg-ast-figure">
      <img
        src={block.url}
        alt={block.alt}
        className="msg-ast-image"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {block.alt && <figcaption>{block.alt}</figcaption>}
    </figure>
  );
}

function ListBlock({
  block,
}: {
  block: Extract<MessageBlock, { type: "list" }>;
}) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag className="msg-ast-list">
      {block.items.map((item, index) => (
        <li key={index}>{renderInlineNodes(item, `li-${index}`)}</li>
      ))}
    </Tag>
  );
}

function BlockquoteBlock({
  block,
}: {
  block: Extract<MessageBlock, { type: "blockquote" }>;
}) {
  return (
    <blockquote className="msg-ast-blockquote">
      <MessageBlockList blocks={block.blocks} />
    </blockquote>
  );
}

function ToolCallBlockAst({
  block,
}: {
  block: Extract<MessageBlock, { type: "tool_call" }>;
}) {
  return (
    <div className="msg-ast-tool-call">
      <div className="msg-ast-tool-call-header">
        <ToolOutlined />
        <span>调用工具 {block.tool}</span>
        {block.status === "calling" && (
          <span className="msg-ast-tool-call-status">执行中...</span>
        )}
        {block.status === "error" && (
          <span className="msg-ast-tool-call-status msg-ast-tool-call-status--error">
            失败
          </span>
        )}
      </div>
      <div className="msg-ast-tool-call-args">
        {Object.entries(block.args).map(([key, value]) => (
          <div key={key} className="msg-ast-tool-call-arg">
            <span className="msg-ast-tool-call-arg-key">{key}</span>
            <span className="msg-ast-tool-call-arg-value">{value}</span>
          </div>
        ))}
      </div>
      {block.result && (
        <pre className="msg-ast-tool-call-result">{block.result}</pre>
      )}
    </div>
  );
}

function CitationBlockAst({
  block,
}: {
  block: Extract<MessageBlock, { type: "citation" }>;
}) {
  return (
    <div className="msg-ast-citation">
      <div className="msg-ast-citation-title">
        <ReadOutlined />
        <span>知识库检索命中</span>
      </div>
      <div className="msg-ast-citation-list">
        {block.citations.map((item) => (
          <div key={item.chunkId} className="msg-ast-citation-item">
            <div className="msg-ast-citation-head">
              <span className="msg-ast-citation-doc">
                {item.documentName || "未知文档"}
              </span>
              {item.page != null && (
                <span className="msg-ast-citation-page">第 {item.page} 页</span>
              )}
              <span className="msg-ast-citation-score">
                相关度 {(item.score * 100).toFixed(0)}%
              </span>
            </div>
            <Typography.Paragraph
              className="msg-ast-citation-snippet"
              ellipsis={{ rows: 4, expandable: true, symbol: "展开" }}
              style={{ marginBottom: 0 }}
            >
              {item.snippet || "（无摘要）"}
            </Typography.Paragraph>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBlockItem({ block }: { block: MessageBlock }) {
  switch (block.type) {
    case "text":
      return <TextBlock block={block} />;
    case "code":
      return <CodeBlock block={block} />;
    case "table":
      return <TableBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "list":
      return <ListBlock block={block} />;
    case "blockquote":
      return <BlockquoteBlock block={block} />;
    case "hr":
      return <hr className="msg-ast-hr" />;
    case "tool_call":
      return <ToolCallBlockAst block={block} />;
    case "citation":
      return <CitationBlockAst block={block} />;
    default:
      return null;
  }
}

function MessageBlockList({ blocks, className }: MessageBlockListProps) {
  if (blocks.length === 0) return null;

  return (
    <div className={`msg-ast-root${className ? ` ${className}` : ""}`}>
      {blocks.map((block, index) => (
        <MessageBlockItem key={`${block.type}-${index}`} block={block} />
      ))}
    </div>
  );
}

export default memo(MessageBlockList);
