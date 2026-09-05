"use client";

import Link from "next/link";
import { Building2, CreditCard, ShieldCheck, Users } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle, Reveal } from "@nexora/ui";
import { AppShell } from "@/components/app-shell";
import { useAuthStore } from "@/store/auth-store";

const SECTIONS = [
  {
    href: "/organisations",
    icon: Building2,
    title: "Organisations",
    description: "Onboard organisations and manage their lifecycle status.",
    permission: "organisations:read",
  },
  {
    href: "/billing",
    icon: CreditCard,
    title: "Billing",
    description: "Manage plans, subscriptions, renewals and receipts.",
    permission: "billing:read",
  },
  {
    href: "/platform-users",
    icon: Users,
    title: "Platform Users",
    description: "Manage Control Center operators and their role assignments.",
    permission: "platform_users:read",
  },
  {
    href: "/roles",
    icon: ShieldCheck,
    title: "Roles",
    description: "Create roles and choose exactly which permissions each one grants.",
    permission: "platform_roles:read",
  },
];

export default function DashboardPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const roles = useAuthStore((state) => state.roles);
  const visibleSections = SECTIONS.filter((section) => permissions.includes(section.permission));

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>
                Signed in with {roles.length > 0 ? roles.join(", ") : "no roles assigned"}. The sections below reflect
                exactly what your roles grant access to.
              </CardDescription>
            </CardHeader>
          </Card>
        </Reveal>

        {visibleSections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No roles are assigned to your account yet — ask a Super Admin to assign one.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleSections.map((section) => (
              <Link key={section.href} href={section.href}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader>
                    <section.icon className="mb-2 h-5 w-5 text-accent" />
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
