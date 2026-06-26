/**
 * 与后端 PromptGuard 对齐的客户端预检（减轻无效请求，非安全边界）
 */
import { normalizePlainText } from "@/components/chat/message-ast/security";

const BLOCK_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(the\s+)?(system|above)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /override\s+(the\s+)?system\s+prompt/i,
  /role\s*:\s*['"]?system['"]?/i,
  /<\s*\/?\s*system\s*>/i,
  /\{\s*"tool"\s*:\s*"/i,
];

const MAX_LENGTH = 16_000;

export interface OutgoingValidation {
  ok: boolean;
  message?: string;
}

export function validateOutgoingMessage(raw: string): OutgoingValidation {
  const content = normalizePlainText(raw).trim();
  if (!content) {
    return { ok: false, message: "消息内容不能为空" };
  }
  if (content.length > MAX_LENGTH) {
    return { ok: false, message: "消息过长，请缩短后重试" };
  }
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(content)) {
      return {
        ok: false,
        message: "消息包含不允许的内容，请修改后重试",
      };
    }
  }
  return { ok: true };
}
