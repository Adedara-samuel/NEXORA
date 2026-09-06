import { Injectable } from "@nestjs/common";
import type { RunPayrollInput, UpdateTaxSettingsInput } from "@nexora/validation";
import type { OrganisationTaxSettings, PaginatedResult, PayrollRun, PayrollRunWithPayslips, Payslip, PayslipBreakdown, TaxBandDefinition } from "@nexora/types";
import type { PayrollRun as PrismaPayrollRun, Payslip as PrismaPayslip, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";
import { computePayslip, DEFAULT_PENSION_RATE_PERCENT_BY_COUNTRY } from "./payroll-tax.util";

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async getTaxSettings(organisationId: string): Promise<OrganisationTaxSettings> {
    const organisation = await this.prisma.organisation.findUniqueOrThrow({ where: { id: organisationId } });
    const settings = await this.prisma.organisationTaxSettings.findUnique({ where: { organisationId } });

    const customBands = (settings?.customBands as TaxBandDefinition[] | null) ?? null;
    const effectiveBands = customBands ?? (await this.getCountryBands(organisation.countryCode));
    const effectivePensionRatePercent = settings?.pensionRatePercent ?? DEFAULT_PENSION_RATE_PERCENT_BY_COUNTRY[organisation.countryCode] ?? 0;

    return {
      organisationId,
      countryCode: organisation.countryCode,
      customBands,
      pensionRatePercent: settings?.pensionRatePercent ?? null,
      effectiveBands,
      effectivePensionRatePercent,
    };
  }

  async updateTaxSettings(organisationId: string, input: UpdateTaxSettingsInput, actorId: string): Promise<OrganisationTaxSettings> {
    await this.prisma.organisationTaxSettings.upsert({
      where: { organisationId },
      update: {
        ...(input.customBands !== undefined ? { customBands: input.customBands as unknown as Prisma.InputJsonValue } : {}),
        ...(input.pensionRatePercent !== undefined ? { pensionRatePercent: input.pensionRatePercent } : {}),
      },
      create: {
        organisationId,
        customBands: (input.customBands ?? null) as unknown as Prisma.InputJsonValue,
        pensionRatePercent: input.pensionRatePercent ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "PAYROLL_TAX_SETTINGS_UPDATED",
        resourceType: "OrganisationTaxSettings",
        resourceId: organisationId,
        metadata: { customBandsChanged: input.customBands !== undefined, pensionRatePercentChanged: input.pensionRatePercent !== undefined },
      },
    });

    return this.getTaxSettings(organisationId);
  }

  async listRuns(organisationId: string, query: { page: number; pageSize: number }): Promise<PaginatedResult<PayrollRun>> {
    const where: Prisma.PayrollRunWhereInput = { organisationId };
    const [total, runs] = await this.prisma.$transaction([
      this.prisma.payrollRun.count({ where }),
      this.prisma.payrollRun.findMany({
        where,
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { items: runs.map((run) => this.toPayrollRun(run)), total, page: query.page, pageSize: query.pageSize };
  }

  async getRun(organisationId: string, id: string): Promise<PayrollRunWithPayslips> {
    const run = await this.prisma.payrollRun.findUnique({ where: { id }, include: { payslips: true } });
    if (!run || run.organisationId !== organisationId) {
      throw new NotFoundApiException("Payroll run not found", "PAYROLL_RUN_NOT_FOUND");
    }
    return { ...this.toPayrollRun(run), payslips: run.payslips.map((payslip) => this.toPayslip(payslip)) };
  }

  async run(organisationId: string, input: RunPayrollInput, actorId: string): Promise<PayrollRunWithPayslips> {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { organisationId_periodYear_periodMonth: { organisationId, periodYear: input.periodYear, periodMonth: input.periodMonth } },
    });
    if (existing) throw new ConflictApiException("A payroll run already exists for this period", "PAYROLL_RUN_ALREADY_EXISTS");

    const taxSettings = await this.getTaxSettings(organisationId);
    if (taxSettings.effectiveBands.length === 0) {
      throw new ValidationApiException(
        `No tax bands are configured for country "${taxSettings.countryCode}". Set customBands via PUT /organisation/payroll/tax-settings before running payroll.`,
      );
    }

    const employees = await this.prisma.employee.findMany({ where: { organisationId, status: "ACTIVE" } });
    const payable = employees.filter((employee) => employee.salaryMinor !== null);
    const skippedEmployeeCount = employees.length - payable.length;

    const computed = payable.map((employee) => {
      const { pensionMinor, payeMinor, breakdown } = computePayslip({
        monthlySalaryMinor: employee.salaryMinor!,
        bands: taxSettings.effectiveBands,
        pensionRatePercent: taxSettings.effectivePensionRatePercent,
      });
      const netMinor = employee.salaryMinor! - pensionMinor - payeMinor;
      return { employee, grossMinor: employee.salaryMinor!, pensionMinor, payeMinor, netMinor, breakdown };
    });

    const totals = computed.reduce(
      (acc, item) => ({
        totalGrossMinor: acc.totalGrossMinor + item.grossMinor,
        totalDeductionsMinor: acc.totalDeductionsMinor + item.pensionMinor + item.payeMinor,
        totalNetMinor: acc.totalNetMinor + item.netMinor,
      }),
      { totalGrossMinor: 0, totalDeductionsMinor: 0, totalNetMinor: 0 },
    );

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payrollRun.create({
        data: {
          organisationId,
          periodYear: input.periodYear,
          periodMonth: input.periodMonth,
          currency: "NGN",
          skippedEmployeeCount,
          createdById: actorId,
          ...totals,
        },
      });

      for (const item of computed) {
        await tx.payslip.create({
          data: {
            payrollRunId: created.id,
            organisationId,
            employeeId: item.employee.id,
            grossMinor: item.grossMinor,
            pensionMinor: item.pensionMinor,
            payeMinor: item.payeMinor,
            netMinor: item.netMinor,
            currency: "NGN",
            breakdown: item.breakdown as unknown as Prisma.InputJsonValue,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          actorType: "ORGANISATION_USER",
          organisationId,
          action: "PAYROLL_RUN_CREATED",
          resourceType: "PayrollRun",
          resourceId: created.id,
          metadata: { periodYear: input.periodYear, periodMonth: input.periodMonth, employeeCount: computed.length, skippedEmployeeCount },
        },
      });

      return created;
    });

    return this.getRun(organisationId, run.id);
  }

  async cancel(organisationId: string, id: string, actorId: string): Promise<PayrollRun> {
    const existing = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!existing || existing.organisationId !== organisationId) {
      throw new NotFoundApiException("Payroll run not found", "PAYROLL_RUN_NOT_FOUND");
    }
    if (existing.status === "CANCELLED") {
      throw new ValidationApiException("This payroll run is already cancelled");
    }

    const run = await this.prisma.payrollRun.update({ where: { id }, data: { status: "CANCELLED" } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "PAYROLL_RUN_CANCELLED",
        resourceType: "PayrollRun",
        resourceId: run.id,
        metadata: { periodYear: run.periodYear, periodMonth: run.periodMonth },
      },
    });

    return this.toPayrollRun(run);
  }

  private async getCountryBands(countryCode: string): Promise<TaxBandDefinition[]> {
    const bands = await this.prisma.taxBand.findMany({ where: { countryCode }, orderBy: { order: "asc" } });
    return bands.map((band) => ({ upToMajor: band.upToMajor, ratePercent: band.ratePercent }));
  }

  private toPayrollRun(run: PrismaPayrollRun): PayrollRun {
    return {
      id: run.id,
      organisationId: run.organisationId,
      periodYear: run.periodYear,
      periodMonth: run.periodMonth,
      status: run.status,
      currency: run.currency,
      totalGrossMinor: run.totalGrossMinor,
      totalDeductionsMinor: run.totalDeductionsMinor,
      totalNetMinor: run.totalNetMinor,
      skippedEmployeeCount: run.skippedEmployeeCount,
      disbursementStatus: run.disbursementStatus,
      disbursementBatchReference: run.disbursementBatchReference,
      disbursementAttempts: run.disbursementAttempts,
      createdById: run.createdById,
      createdAt: run.createdAt.toISOString(),
    };
  }

  private toPayslip(payslip: PrismaPayslip): Payslip {
    return {
      id: payslip.id,
      payrollRunId: payslip.payrollRunId,
      organisationId: payslip.organisationId,
      employeeId: payslip.employeeId,
      grossMinor: payslip.grossMinor,
      pensionMinor: payslip.pensionMinor,
      payeMinor: payslip.payeMinor,
      otherDeductionsMinor: payslip.otherDeductionsMinor,
      netMinor: payslip.netMinor,
      currency: payslip.currency,
      breakdown: payslip.breakdown as unknown as PayslipBreakdown,
      disbursementStatus: payslip.disbursementStatus,
      disbursementFailureReason: payslip.disbursementFailureReason,
      createdAt: payslip.createdAt.toISOString(),
    };
  }
}
