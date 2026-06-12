export interface ApiErrorMeta {
  code?: number;
  status?: number;
}

export class ApiError extends Error {
  code?: number;
  status?: number;

  constructor(message: string, meta: ApiErrorMeta = {}) {
    super(message);
    this.name = "ApiError";
    this.code = meta.code;
    this.status = meta.status;
  }

  get displayMessage(): string {
    return this.message;
  }
}

interface ApiErrorBody {
  message?: string | string[];
  code?: number;
}

export function normalizeErrorMessage(
  message: unknown,
  fallback = "请求失败"
): string {
  if (Array.isArray(message)) {
    return message.join("，");
  }
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return fallback;
}

export function createApiErrorFromBody(
  body: ApiErrorBody | undefined,
  fallbackMessage: string,
  status?: number
): ApiError {
  return new ApiError(normalizeErrorMessage(body?.message, fallbackMessage), {
    code: body?.code ?? status,
    status,
  });
}

export function createTimeoutError(): ApiError {
  return new ApiError("请求超时，请稍后重试", {
    code: 408,
    status: 408,
  });
}
