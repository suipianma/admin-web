import request from "./request";

export interface PromptTemplateItem {
  id: string;
  name: string;
  description: string;
  contextLabel: string;
  contextPlaceholder?: string;
}

/** 获取 Prompt 模板列表 */
export function getPromptTemplates() {
  return request.get<PromptTemplateItem[]>("/ai/prompts");
}
