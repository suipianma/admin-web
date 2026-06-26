"use client";

import Link from "next/link";
import { Button } from "antd";
import {
  HomeOutlined,
  MessageOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { filterNavByRole, type NavIconKey } from "@/config/nav";
import type { TokenPayload } from "@/utils/auth";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_ICONS: Record<NavIconKey, React.ReactNode> = {
  home: <HomeOutlined />,
  users: <TeamOutlined />,
  chat: <MessageOutlined />,
};

interface SidebarProps {
  pathname: string;
  userInfo: TokenPayload | null;
  onNavigate?: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  pathname,
  userInfo,
  onNavigate,
  onLogout,
}: SidebarProps) {
  const visibleItems = filterNavByRole(userInfo);

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">AI</div>
        <div>
          <div className="sidebar-title">AI Admin</div>
          <div className="sidebar-subtitle">后台管理系统</div>
        </div>
      </div>

      <div className="sidebar-section">主导航</div>

      <nav className="sidebar-nav">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              <span className="nav-link-icon">{NAV_ICONS[item.icon]}</span>
              <span className="nav-link-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-name">
          {userInfo?.username ?? "-"}
        </div>
        <ThemeToggle />
        <Button type="link" size="small" className="sidebar-logout-btn" onClick={onLogout}>
          退出
        </Button>
      </div>
    </div>
  );
}
