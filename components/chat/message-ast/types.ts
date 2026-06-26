import type { RagCitation } from "@/services/ai";
import type { ToolCallItem } from "@/components/chat/ChatMessageItem";

/** 行内节点（仅允许白名单格式，禁止原始 HTML） */
export type InlineNode =
  | { type: "plain"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "emphasis"; children: InlineNode[] }
  | { type: "delete"; children: InlineNode[] }
  | { type: "inline_code"; value: string }
  | { type: "link"; url: string; children: InlineNode[] }
  | { type: "image_inline"; url: string; alt: string }
  | { type: "break" };

/** Markdown 解析出的块级节点 */
export type MarkdownBlock =
  | { type: "text"; heading?: 1 | 2 | 3 | 4 | 5 | 6; inlines: InlineNode[] }
  | { type: "code"; language: string | null; value: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "image"; url: string; alt: string }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "blockquote"; blocks: MarkdownBlock[] }
  | { type: "hr" };

/** 结构化消息块（ChatGPT / Claude 风格） */
export type MessageBlock =
  | MarkdownBlock
  | {
      type: "tool_call";
      id: string;
      tool: string;
      args: Record<string, string>;
      result?: string;
      status: ToolCallItem["status"];
    }
  | { type: "citation"; citations: RagCitation[] };

export function toolCallsToBlocks(
  toolCalls: ToolCallItem[]
): Extract<MessageBlock, { type: "tool_call" }>[] {
  return toolCalls.map((item, index) => ({
    type: "tool_call",
    id: `${item.tool}-${index}`,
    tool: item.tool,
    args: item.args,
    result: item.result,
    status: item.status,
  }));
}

export function citationsToBlock(
  citations: RagCitation[]
): Extract<MessageBlock, { type: "citation" }> | null {
  if (citations.length === 0) return null;
  return { type: "citation", citations };
}
