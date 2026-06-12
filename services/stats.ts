import request from "./request";

export interface TokenDailyPoint {
  date: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

export interface TokenUsageStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  todayTokens: number;
  aiReplyCount: number;
  cachedReplyCount: number;
  conversationCount: number;
  hasEstimated: boolean;
  dailyTrend: TokenDailyPoint[];
}

/** 获取当前用户 AI 对话 token 消耗统计 */
export function getTokenUsageStats() {
  return request.get<TokenUsageStats>("/conversations/stats/token-usage");
}
