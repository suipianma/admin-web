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

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { preference, setTheme } = useTheme();
  const current = THEME_OPTIONS.find((item) => item.key === preference);

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
        selectedKeys: [preference],
        onClick: handleMenuClick,
      }}
      trigger={["click"]}
      placement="topRight"
      destroyOnHidden
    >
      <Tooltip title={`主题：${THEME_LABEL[preference]}`}>
        <Button
          type="text"
          className={`theme-toggle-btn ${className ?? ""}`}
          icon={current?.icon}
          aria-label={`当前主题：${THEME_LABEL[preference]}`}
        />
      </Tooltip>
    </Dropdown>
  );
}
