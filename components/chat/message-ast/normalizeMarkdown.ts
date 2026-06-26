/** 规范化 AI 输出的 Markdown，补全缺失换行以便正确解析 AST */
export function normalizeMarkdownInput(markdown: string): string {
  let text = markdown.replace(/\r\n/g, "\n");

  // 代码围栏前后补换行
  text = text.replace(/([^\n])```/g, "$1\n```");
  text = text.replace(/```\s*([a-zA-Z0-9+#-]*)\s*([^\n])/g, "```$1\n$2");
  text = text.replace(/([^\n])```\s*(\n|$)/g, "$1\n```$2");

  // 标题、表格前补换行
  text = text.replace(/([^\n])(#{1,6}\s)/g, "$1\n$2");
  text = text.replace(/([^\n])\n?(\|[^\n]+\|)/g, "$1\n$2");

  const lines = text.split("\n");
  const normalized: string[] = [];

  for (const line of lines) {
    const ulExpanded = expandCompactUlLine(line);
    if (ulExpanded.includes("\n")) {
      normalized.push(...ulExpanded.split("\n"));
      continue;
    }

    const olExpanded = expandCompactOlLine(line);
    if (olExpanded.includes("\n")) {
      normalized.push(...olExpanded.split("\n"));
      continue;
    }

    // 段落末尾粘连「- 列表」或「1. 列表」
    const splitMixed = line.replace(
      /([^\n])(\s+)(?=(?:[-*+]\s|\d+\.\s))/g,
      "$1\n"
    );
    if (splitMixed.includes("\n")) {
      normalized.push(...splitMixed.split("\n"));
      continue;
    }

    normalized.push(line);
  }

  return normalized.join("\n").trim();
}

/** 同一行多个无序列表：`- A - B` → 两行 */
function expandCompactUlLine(line: string): string {
  if (!/^\s*[-*+]\s/.test(line)) return line;
  const parts = line.split(/\s+-\s+/);
  if (parts.length <= 1) return line;

  return parts
    .map((part) => {
      const cleaned = part.replace(/^\s*[-*+]\s*/, "").trim();
      return cleaned ? `- ${cleaned}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/** 同一行多个有序列表：`1. A 2. B` → 两行 */
function expandCompactOlLine(line: string): string {
  if (!/^\s*\d+\.\s/.test(line)) return line;
  const parts = line.split(/\s+(?=\d+\.\s)/);
  if (parts.length <= 1) return line;
  return parts.join("\n");
}
