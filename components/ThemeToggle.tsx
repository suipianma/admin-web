"use client";

import { Button, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
  DesktopOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { useTheme } from "@/components/ThemeProvider";
import type { ThemePreference } from "@/utils/theme";

const THEME_OPTIONS: Array<{
  key: ThemePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "light", label: "浅色", icon: <SunOutlined /> },
  { key: "dark", label: "深色", icon: <MoonOutlined /> },
  { key: "system", label: "跟随系统", icon: <DesktopOutlined /> },
];

const THEME_LABEL: Record<ThemePreference, string> = {
  light: "浅色模式",
  dark: "深色模式",
  system: "跟随系统",
};

// 与服务端首屏一致，避免 hydration 不匹配
const SSR_THEME_ICON = <DesktopOutlined />;
const SSR_THEME_LABEL = "跟随系统";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { preference, setTheme, ready } = useTheme();
  const current = THEME_OPTIONS.find((item) => item.key === preference);
  const icon = ready ? current?.icon : SSR_THEME_ICON;
  const label = ready ? THEME_LABEL[preference] : SSR_THEME_LABEL;

  const menuItems: MenuProps["items"] = THEME_OPTIONS.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
  }));

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    setTheme(key as ThemePreference);
  };

  return (
    <Dropdown
      menu={{
        items: menuItems,
        selectable: true,
        selectedKeys: ready ? [preference] : [],
        onClick: handleMenuClick,
      }}
      trigger={["click"]}
      placement="topRight"
      destroyOnHidden
    >
      <Tooltip title={`主题：${label}`}>
        <Button
          type="text"
          className={`theme-toggle-btn ${className ?? ""}`}
          icon={icon}
          aria-label={`当前主题：${label}`}
        />
      </Tooltip>
    </Dropdown>
  );
}
