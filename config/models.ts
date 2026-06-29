/** 可选 AI 模型列表（NEXT_PUBLIC_AI_MODELS 逗号分隔，如 qwen3:8b,llama3:8b） */
const raw = process.env.NEXT_PUBLIC_AI_MODELS ?? "qwen3:8b";

export const AI_MODEL_OPTIONS = raw
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

export const DEFAULT_AI_MODEL = AI_MODEL_OPTIONS[0] ?? "qwen3:8b";
