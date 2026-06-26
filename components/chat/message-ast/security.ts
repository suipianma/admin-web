const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const ALLOWED_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

/** 校验链接，拦截 javascript: / data: 等危险协议 */
export function sanitizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, "https://example.invalid");
    const protocol = parsed.protocol.toLowerCase();
    if (!ALLOWED_LINK_PROTOCOLS.has(protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** 图片仅允许 http(s) */
export function sanitizeImageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, "https://example.invalid");
    const protocol = parsed.protocol.toLowerCase();
    if (!ALLOWED_IMAGE_PROTOCOLS.has(protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** 剥离控制字符，避免不可见注入 */
export function normalizePlainText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
