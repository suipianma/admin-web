import type { ReactNode } from "react";
import type { InlineNode } from "./types";

/** 安全渲染行内 AST（React 自动转义文本节点） */
export function renderInlineNodes(
  nodes: InlineNode[],
  keyPrefix = "i"
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.type) {
      case "plain":
        return node.value ? <span key={key}>{node.value}</span> : null;
      case "strong":
        return (
          <strong key={key}>{renderInlineNodes(node.children, key)}</strong>
        );
      case "emphasis":
        return <em key={key}>{renderInlineNodes(node.children, key)}</em>;
      case "delete":
        return <del key={key}>{renderInlineNodes(node.children, key)}</del>;
      case "inline_code":
        return (
          <code key={key} className="msg-ast-inline-code">
            {node.value}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={node.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="msg-ast-link"
          >
            {renderInlineNodes(node.children, key)}
          </a>
        );
      case "image_inline":
        return (
          <img
            key={key}
            src={node.url}
            alt={node.alt}
            className="msg-ast-image msg-ast-image--inline"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        );
      case "break":
        return <br key={key} />;
      default:
        return null;
    }
  });
}
