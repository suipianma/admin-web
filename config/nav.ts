export type NavIconKey = "home" | "users" | "chat";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  roles?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "首页", icon: "home" },
  {
    href: "/users",
    label: "用户管理",
    icon: "users",
    roles: ["admin"],
  },
  { href: "/chat", label: "AI 聊天", icon: "chat" },
];

export function filterNavByRole(userInfo: { role: string } | null) {
  return NAV_ITEMS.filter(
    (item) =>
      !item.roles || (!!userInfo && item.roles.includes(userInfo.role))
  );
}
