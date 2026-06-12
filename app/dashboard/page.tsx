"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Col, Row, Spin, Tag } from "antd";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useUserInfo } from "@/hooks/useUserInfo";
import { filterNavByRole } from "@/config/nav";
import { getTokenUsageStats, type TokenUsageStats } from "@/services/stats";

const TokenUsageChart = dynamic(() => import("@/components/TokenUsageChart"), {
  ssr: false,
  loading: () => (
    <div className="token-chart-empty">
      <Spin />
    </div>
  ),
});

const QUICK_LINK_DESC: Record<string, string> = {
  "/users": "管理系统用户账号",
  "/chat": "与 AI 助手流式对话",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function getRoleTag(role?: string) {
  if (role === "admin") return <Tag color="gold">管理员</Tag>;
  return <Tag color="blue">普通用户</Tag>;
}

/** 千分位格式化 token 数量 */
function formatTokenCount(value: number) {
  return value.toLocaleString("zh-CN");
}

export default function DashboardPage() {
  useAuth();
  const userInfo = useUserInfo();
  const [greeting, setGreeting] = useState("你好");
  const [tokenStats, setTokenStats] = useState<TokenUsageStats | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    let cancelled = false;

    getTokenUsageStats()
      .then((res) => {
        if (!cancelled) setTokenStats(res.data);
      })
      .catch(() => {
        if (!cancelled) setTokenStats(null);
      })
      .finally(() => {
        if (!cancelled) setTokenLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const quickLinks = filterNavByRole(userInfo).filter(
    (item) => item.href !== "/dashboard"
  );

  return (
    <div className="page-container">
      <PageHeader
        title={`${greeting}，${userInfo?.username ?? "用户"}`}
        description="欢迎回到 AI 后台管理系统"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <div className="stat-card">
            <div className="stat-label">当前账号</div>
            <div className="stat-value">{userInfo?.username ?? "-"}</div>
            <div className="stat-desc">{getRoleTag(userInfo?.role)}</div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <div className="stat-card">
            <div className="stat-label">用户 ID</div>
            <div className="stat-value">{userInfo?.userId ?? "-"}</div>
            <div className="stat-desc">从登录 Token 解析</div>
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="stat-card">
            <div className="stat-label">可用功能</div>
            <div className="stat-value">{quickLinks.length} 项</div>
            <div className="stat-desc">根据角色动态展示菜单</div>
          </div>
        </Col>
      </Row>

      <h2 className="section-title">Token 消耗</h2>

      <Spin spinning={tokenLoading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <div className="stat-card">
              <div className="stat-label">累计消耗</div>
              <div className="stat-value">
                {formatTokenCount(tokenStats?.totalTokens ?? 0)}
              </div>
              <div className="stat-desc">
                输入 {formatTokenCount(tokenStats?.promptTokens ?? 0)} / 输出{" "}
                {formatTokenCount(tokenStats?.completionTokens ?? 0)}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="stat-card">
              <div className="stat-label">今日消耗</div>
              <div className="stat-value">
                {formatTokenCount(tokenStats?.todayTokens ?? 0)}
              </div>
              <div className="stat-desc">按服务器当日 0 点起算</div>
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="stat-card">
              <div className="stat-label">AI 回复次数</div>
              <div className="stat-value">{tokenStats?.aiReplyCount ?? 0}</div>
              <div className="stat-desc">
                缓存命中 {tokenStats?.cachedReplyCount ?? 0} 次
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="stat-card">
              <div className="stat-label">会话数</div>
              <div className="stat-value">
                {tokenStats?.conversationCount ?? 0}
              </div>
              <div className="stat-desc">
                {tokenStats?.hasEstimated
                  ? "部分历史消息为估算值"
                  : "数据来自 Ollama 统计"}
              </div>
            </div>
          </Col>
        </Row>

        <TokenUsageChart data={tokenStats?.dailyTrend ?? []} />
      </Spin>

      <h2 className="section-title">快捷入口</h2>

      <Row gutter={[16, 16]}>
        {quickLinks.map((item) => (
          <Col xs={24} sm={12} key={item.href}>
            <Link href={item.href} className="quick-link-card">
              <div className="quick-link-icon">{item.label.slice(0, 1)}</div>
              <div>
                <div className="quick-link-title">{item.label}</div>
                <div className="quick-link-desc">
                  {QUICK_LINK_DESC[item.href] ?? "进入功能页面"}
                </div>
              </div>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  );
}
