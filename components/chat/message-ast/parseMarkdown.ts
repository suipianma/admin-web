import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type { Content, ListItem, PhrasingContent, Root, Table, TableRow } from "mdast";
import type { InlineNode, MarkdownBlock } from "./types";
import {
  normalizePlainText,
  sanitizeImageUrl,
  sanitizeUrl,
} from "./security";
import { normalizeMarkdownInput } from "./normalizeMarkdown";

const markdownParser = remark().use(remarkGfm);

function phrasingToInlines(nodes: PhrasingContent[]): InlineNode[] {
  const result: InlineNode[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        result.push({ type: "plain", value: normalizePlainText(node.value) });
        break;
      case "strong":
        result.push({
          type: "strong",
          children: phrasingToInlines(node.children),
        });
        break;
      case "emphasis":
        result.push({
          type: "emphasis",
          children: phrasingToInlines(node.children),
        });
        break;
      case "delete":
        result.push({
          type: "delete",
          children: phrasingToInlines(node.children),
        });
        break;
      case "inlineCode":
        result.push({
          type: "inline_code",
          value: normalizePlainText(node.value),
        });
        break;
      case "link": {
        const url = sanitizeUrl(node.url);
        const children = phrasingToInlines(node.children);
        if (url) {
          result.push({ type: "link", url, children });
        } else {
          result.push(...children);
        }
        break;
      }
      case "image": {
        const url = sanitizeImageUrl(node.url);
        if (url) {
          result.push({
            type: "image_inline",
            url,
            alt: normalizePlainText(node.alt || ""),
          });
        }
        break;
      }
      case "break":
        result.push({ type: "break" });
        break;
      default:
        // 丢弃 html、脚注等未知节点，防止注入
        break;
    }
  }

  return result;
}

function phrasingToPlain(nodes: PhrasingContent[]): string {
  return phrasingToInlines(nodes)
    .map((node) => {
      if (node.type === "plain") return node.value;
      if (node.type === "inline_code") return node.value;
      if (node.type === "break") return "\n";
      if ("children" in node) {
        return node.children
          .map((c) => (c.type === "plain" ? c.value : ""))
          .join("");
      }
      return "";
    })
    .join("");
}

function tableRowToCells(row: TableRow): string[] {
  return row.children.map((cell) =>
    phrasingToPlain(cell.children as PhrasingContent[])
  );
}

function convertTable(node: Table): MarkdownBlock {
  const rows = node.children.map(tableRowToCells);
  const headers = rows[0] ?? [];
  const body = rows.slice(1);
  return { type: "table", headers, rows: body };
}

function listItemToInlines(item: ListItem): InlineNode[] {
  const parts: PhrasingContent[] = [];
  for (const child of item.children) {
    if (child.type === "paragraph") {
      parts.push(...child.children);
    }
  }
  return phrasingToInlines(parts);
}

function convertBlock(node: Content): MarkdownBlock[] {
  switch (node.type) {
    case "paragraph":
      return [{ type: "text", inlines: phrasingToInlines(node.children) }];
    case "heading":
      return [
        {
          type: "text",
          heading: node.depth as 1 | 2 | 3 | 4 | 5 | 6,
          inlines: phrasingToInlines(node.children),
        },
      ];
    case "code":
      return [
        {
          type: "code",
          language: node.lang ? normalizePlainText(node.lang) : null,
          value: node.value,
        },
      ];
    case "table":
      return [convertTable(node)];
    case "image": {
      const url = sanitizeImageUrl(node.url);
      if (!url) return [];
      return [
        {
          type: "image",
          url,
          alt: normalizePlainText(node.alt || ""),
        },
      ];
    }
    case "blockquote":
      return [
        {
          type: "blockquote",
          blocks: node.children.flatMap((child) => convertBlock(child)),
        },
      ];
    case "list":
      return [
        {
          type: "list",
          ordered: node.ordered ?? false,
          items: node.children.map((item) => listItemToInlines(item)),
        },
      ];
    case "thematicBreak":
      return [{ type: "hr" }];
    case "html":
      // 明确丢弃原始 HTML
      return [];
    default:
      return [];
  }
}

/** 将 Markdown 字符串解析为安全 AST 块列表 */
export function parseMarkdownToBlocks(markdown: string): MarkdownBlock[] {
  const trimmed = normalizeMarkdownInput(markdown);
  if (!trimmed) return [];

  const tree = markdownParser.parse(trimmed) as Root;
  return tree.children.flatMap((node) => convertBlock(node));
}
