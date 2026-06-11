"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Col, Row, Tag } from "antd";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useUserInfo } from "@/hooks/useUserInfo";
import { filterNavByRole } from "@/config/nav";

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

export default function DashboardPage() {
  useAuth();
  const userInfo = useUserInfo();
  const [greeting, setGreeting] = useState("你好");

  useEffect(() => {
    setGreeting(getGreeting());
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
