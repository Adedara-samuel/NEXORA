import { Injectable } from "@nestjs/common";
import type { AccessTokenPayload, OrganisationActivityEntry, OrganisationDashboardSummary } from "@nexora/types";
import type { AttendanceStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const PRESENT_STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "HALF_DAY"];
const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 8;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The Organisation Desktop home dashboard. Same shape as the platform
 * DashboardService: one shared endpoint, but each section is computed only
 * if the caller's own JWT permissions unlock it — so a user without
 * `payroll:read` never receives payroll figures. Every value is an
 * aggregate over real records; nothing is estimated or placeholder.
 *
 * Dates are compared as UTC calendar days throughout, matching how
 * @db.Date columns are stored and returned by Prisma.
 */
@Injectable()
export class OrganisationDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organisationId: string, actor: AccessTokenPayload): Promise<OrganisationDashboardSummary> {
    const permissions = new Set(actor.permissions ?? []);
    const summary: OrganisationDashboardSummary = { generatedAt: new Date().toISOString() };

    if (permissions.has("employees:read")) summary.employees = await this.getEmployees(organisationId);
    if (permissions.has("attendance:read")) summary.attendance = await this.getAttendance(organisationId);
    if (permissions.has("leave:read")) summary.leave = await this.getLeave(organisationId);
    if (permissions.has("payroll:read")) summary.payroll = await this.getPayroll(organisationId);
    if (permissions.has("documents:read")) summary.documents = await this.getDocuments(organisationId);
    if (permissions.has("compliance:read")) summary.compliance = await this.getCompliance(organisationId);
    if (permissions.has("assistant:use")) summary.assistant = await this.getAssistant(organisationId);
    if (permissions.has("audit:read")) summary.recentActivity = await this.getRecentActivity(organisationId);

    return summary;
  }

  private async getEmployees(organisationId: string): Promise<NonNullable<OrganisationDashboardSummary["employees"]>> {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const notTerminated = { organisationId, status: { not: "TERMINATED" as const } };

    const [total, hiredThisMonth, hiredLastMonth, byDepartmentGroups] = await Promise.all([
      this.prisma.employee.count({ where: notTerminated }),
      this.prisma.employee.count({ where: { organisationId, hireDate: { gte: startOfMonth } } }),
      this.prisma.employee.count({ where: { organisationId, hireDate: { gte: startOfLastMonth, lt: startOfMonth } } }),
      this.prisma.employee.groupBy({ by: ["departmentId"], where: notTerminated, _count: true }),
    ]);

    const departmentIds = byDepartmentGroups.map((group) => group.departmentId).filter((id): id is string => id !== null);
    const departments = departmentIds.length
      ? await this.prisma.department.findMany({ where: { organisationId, id: { in: departmentIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(departments.map((department) => [department.id, department.name]));

    const byDepartment = byDepartmentGroups
      .map((group) => ({
        departmentId: group.departmentId,
        name: group.departmentId ? (nameById.get(group.departmentId) ?? "Unknown") : "Unassigned",
        count: group._count,
      }))
      .sort((a, b) => b.count - a.count);

    return { total, hiredThisMonth, hiredLastMonth, byDepartment };
  }

  private async getAttendance(organisationId: string): Promise<NonNullable<OrganisationDashboardSummary["attendance"]>> {
    const today = startOfUtcDay(new Date());
    const trendStart = new Date(today.getTime() - (TREND_DAYS - 1) * DAY_MS);
    const expectedToday = await this.prisma.employee.count({ where: { organisationId, status: { not: "TERMINATED" } } });

    // Grouped by status too so a day can be told apart as "nothing recorded"
    // (no rows at all) versus "recorded, and everyone was absent" — those
    // are different facts and the chart/rates must not conflate them.
    const groups = await this.prisma.attendance.groupBy({
      by: ["date", "status"],
      where: { organisationId, date: { gte: trendStart, lte: today } },
      _count: true,
    });
    const recordedDates = new Set<string>();
    const presentByDate = new Map<string, number>();
    for (const group of groups) {
      const date = isoDate(group.date);
      recordedDates.add(date);
      if (PRESENT_STATUSES.includes(group.status)) presentByDate.set(date, (presentByDate.get(date) ?? 0) + group._count);
    }

    const trend = Array.from({ length: TREND_DAYS }, (_, index) => {
      const date = isoDate(new Date(trendStart.getTime() + index * DAY_MS));
      return { date, present: recordedDates.has(date) ? (presentByDate.get(date) ?? 0) : null };
    });

    const presentToday = presentByDate.get(isoDate(today)) ?? 0;

    // Windows are the last 7 calendar days (today included) and the 7 before.
    const windowRate = (fromOffset: number, toOffset: number): number | null => {
      const days = trend.slice(trend.length - fromOffset, trend.length - toOffset);
      // Only days with attendance actually recorded count, so weekends and
      // holidays with nothing entered aren't read as mass absence.
      const recordedDays = days.filter((day): day is { date: string; present: number } => day.present !== null);
      if (recordedDays.length === 0 || expectedToday === 0) return null;
      const presentTotal = recordedDays.reduce((sum, day) => sum + day.present, 0);
      return Math.min(1, presentTotal / (expectedToday * recordedDays.length));
    };

    return {
      presentToday,
      expectedToday,
      rateToday: expectedToday > 0 ? Math.min(1, presentToday / expectedToday) : null,
      rateLast7Days: windowRate(7, 0),
      ratePrevious7Days: windowRate(14, 7),
      trend,
    };
  }

  private async getLeave(organisationId: string): Promise<NonNullable<OrganisationDashboardSummary["leave"]>> {
    const today = startOfUtcDay(new Date());
    const [onLeave, pendingRequests] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: { organisationId, status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
        select: { employeeId: true },
        distinct: ["employeeId"],
      }),
      this.prisma.leaveRequest.count({ where: { organisationId, status: "PENDING" } }),
    ]);
    return { onLeaveToday: onLeave.length, pendingRequests };
  }

  private async getPayroll(organisationId: string): Promise<NonNullable<OrganisationDashboardSummary["payroll"]>> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { organisationId, status: "COMPLETED" },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    return {
      latestRun: run
        ? {
            id: run.id,
            periodYear: run.periodYear,
            periodMonth: run.periodMonth,
            totalNetMinor: run.totalNetMinor,
            currency: run.currency,
            disbursementStatus: run.disbursementStatus,
          }
        : null,
    };
  }

  private async getDocuments(organisationId: string): Promise<NonNullable<OrganisationDashboardSummary["documents"]>> {
    const today = startOfUtcDay(new Date());
    const in30Days = new Date(today.getTime() + 30 * DAY_MS);
    const [expiringWithin30Days, expired] = await Promise.all([
      this.prisma.document.count({ where: { organisationId, expiryDate: { gte: today, lte: in30Days } } }),
      this.prisma.document.count({ where: { organisationId, expiryDate: { lt: today } } }),
    ]);
    return { expiringWithin30Days, expired };
  }

  private async getCompliance(organisationId: string): Promise<NonNullable<OrganisationDashboardSummary["compliance"]>> {
    const today = startOfUtcDay(new Date());
    const needingAttention = await this.prisma.complianceRecord.count({
      where: {
        organisationId,
        OR: [{ status: { in: ["EXPIRED", "NON_COMPLIANT"] } }, { status: "PENDING", dueDate: { lt: today } }],
      },
    });
    return { needingAttention };
  }

  private async getAssistant(organisationId: string): Promise<NonNullable<OrganisationDashboardSummary["assistant"]>> {
    const pendingActions = await this.prisma.assistantActionRequest.count({ where: { organisationId, status: "PENDING_APPROVAL" } });
    return { pendingActions };
  }

  private async getRecentActivity(organisationId: string): Promise<OrganisationActivityEntry[]> {
    // Sign-ins are audit-logged (correctly) but would drown a business
    // activity feed — every page load after a login is one more "login
    // success" row pushing real events out of an 8-item window.
    const logs = await this.prisma.auditLog.findMany({
      where: { organisationId, NOT: { action: { contains: "LOGIN" } } },
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
    });

    const orgUserIds = [...new Set(logs.filter((log) => log.actorType === "ORGANISATION_USER" && log.actorId).map((log) => log.actorId as string))];
    const users = orgUserIds.length
      ? await this.prisma.organisationUser.findMany({ where: { organisationId, id: { in: orgUserIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const nameByUserId = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]));

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      // Platform staff are deliberately shown as the platform, never by name.
      actorName: log.actorType === "PLATFORM_USER" ? "NEXORA Platform" : log.actorId ? (nameByUserId.get(log.actorId) ?? null) : null,
      actorType: log.actorType,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
