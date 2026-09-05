import type { LucideIcon } from "lucide-react";
import { Users, CalendarCheck, CalendarClock, Wallet } from "lucide-react";

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
];
