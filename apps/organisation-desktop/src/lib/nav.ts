import type { LucideIcon } from "lucide-react";
import { Users, CalendarCheck, CalendarClock, Wallet, FileText, ShieldCheck, Building2, UserCog, KeyRound } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Employees", href: "/employees", icon: Users, permission: "employees:read" },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck, permission: "attendance:read" },
  { label: "Leave", href: "/leave", icon: CalendarClock, permission: "leave:read" },
  { label: "Payroll", href: "/payroll", icon: Wallet, permission: "payroll:read" },
  { label: "Documents", href: "/documents", icon: FileText, permission: "documents:read" },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck, permission: "compliance:read" },
  { label: "Structure", href: "/structure", icon: Building2, permission: "departments:read" },
  { label: "Users", href: "/users", icon: UserCog, permission: "org_users:read" },
  { label: "Roles", href: "/roles", icon: KeyRound, permission: "org_roles:read" },
];
