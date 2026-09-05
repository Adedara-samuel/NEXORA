import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Building2, Users, ShieldCheck } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Omit for items every authenticated platform user can see. */
  permission?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Organisations", href: "/organisations", icon: Building2, permission: "organisations:read" },
  { label: "Platform Users", href: "/platform-users", icon: Users, permission: "platform_users:read" },
  { label: "Roles", href: "/roles", icon: ShieldCheck, permission: "platform_roles:read" },
];
