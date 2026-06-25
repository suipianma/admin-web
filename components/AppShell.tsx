"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "antd";
import {
  BookOutlined,
  CloseOutlined,
  HomeOutlined,
  MenuOutlined,
  MessageOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { NAV_ITEMS, type NavIconKey } from "@/config/nav";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { useUserInfo } from "@/hooks/useUserInfo";
import { clearAuth, getUserInfo } from "@/utils/auth";
import { logout } from "@/services/auth";

const PUBLIC_PATHS = ["/login", "/register"];

const NAV_ICONS: Record<NavIconKey, React.ReactNode> = {
  home: <HomeOutlined />,
  users: <TeamOutlined />,
  chat: <MessageOutlined />,
  book: <BookOutlined />,
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userInfo = useUserInfo();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentNav = useMemo(
    () => NAV_ITEMS.find((item) => item.href === pathname),
    [pathname]
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  async function handleLogout() {
    const user = getUserInfo();
    if (user?.userId) {
      try {
        await logout(user.userId);
      } catch {
        // 退出接口失败也清除本地登录态
      }
    }
    clearAuth();
    router.replace("/login");
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="app-layout">
      {/* 移动端顶栏 */}
      <header className="mobile-header">
        <Button
          type="text"
          className="mobile-menu-btn"
          icon={menuOpen ? <CloseOutlined /> : <MenuOutlined />}
          onClick={() => setMenuOpen((prev) => !prev)}
        />
        <div className="mobile-header-center">
          <div className="mobile-header-title">
            {currentNav?.icon ? NAV_ICONS[currentNav.icon] : null}
            <span>{currentNav?.label ?? "AI Admin"}</span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* 桌面端侧边栏 */}
      <aside className="desktop-sidebar">
        <Sidebar
          pathname={pathname}
          userInfo={userInfo}
          onLogout={handleLogout}
        />
      </aside>

      <main className="app-main">{children}</main>

      {/* 移动端遮罩 + 侧滑菜单 */}
      <div
        className={`mobile-mask ${menuOpen ? "is-visible" : ""}`}
        onClick={closeMenu}
        aria-hidden={!menuOpen}
      />
      <div
        className={`mobile-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <Sidebar
          pathname={pathname}
          userInfo={userInfo}
          onNavigate={closeMenu}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}
