import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, CalendarCheck, CalendarClock, Wallet, FileText, ShieldCheck, Building2, UserCog, KeyRound, Bot } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  /** Which Plan module (see prisma/seed.ts's MODULES catalog) this feature belongs to — hidden if the organisation's plan doesn't include it, independent of role permissions. */
  moduleKey?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Employees", href: "/employees", icon: Users, permission: "employees:read", moduleKey: "employees" },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck, permission: "attendance:read", moduleKey: "attendance" },
  { label: "Leave", href: "/leave", icon: CalendarClock, permission: "leave:read", moduleKey: "leave" },
  { label: "Payroll", href: "/payroll", icon: Wallet, permission: "payroll:read", moduleKey: "payroll" },
  { label: "Assistant", href: "/assistant", icon: Bot, permission: "assistant:use", moduleKey: "assistant" },
  { label: "Documents", href: "/documents", icon: FileText, permission: "documents:read", moduleKey: "documents" },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck, permission: "compliance:read", moduleKey: "compliance" },
  { label: "Structure", href: "/structure", icon: Building2, permission: "departments:read" },
  { label: "Users", href: "/users", icon: UserCog, permission: "org_users:read" },
  { label: "Roles", href: "/roles", icon: KeyRound, permission: "org_roles:read" },
];
