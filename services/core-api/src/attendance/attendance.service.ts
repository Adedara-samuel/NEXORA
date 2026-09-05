import { Injectable } from "@nestjs/common";
import type { CreateAttendanceInput, ListAttendanceQuery, UpdateAttendanceInput } from "@nexora/validation";
import type { Attendance, PaginatedResult } from "@nexora/types";
import type { Attendance as PrismaAttendance, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organisationId: string, query: ListAttendanceQuery): Promise<PaginatedResult<Attendance>> {
    const where: Prisma.AttendanceWhereInput = {
      organisationId,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.toAttendance(record)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(organisationId: string, id: string): Promise<Attendance> {
    const record = await this.getOwned(organisationId, id);
    return this.toAttendance(record);
  }

  async create(organisationId: string, input: CreateAttendanceInput, actorId: string): Promise<Attendance> {
    await this.assertEmployeeOwned(organisationId, input.employeeId);

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: input.employeeId, date: input.date } },
    });
    if (existing) throw new ConflictApiException("An attendance record already exists for this employee on this date", "ATTENDANCE_ALREADY_RECORDED");

    const record = await this.prisma.attendance.create({
      data: {
        organisationId,
        employeeId: input.employeeId,
        date: input.date,
        status: input.status,
        clockInAt: input.clockInAt,
        clockOutAt: input.clockOutAt,
        notes: input.notes,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "ATTENDANCE_RECORDED",
        resourceType: "Attendance",
        resourceId: record.id,
        metadata: { employeeId: record.employeeId, date: record.date.toISOString(), status: record.status },
      },
    });

    return this.toAttendance(record);
  }

  async update(organisationId: string, id: string, input: UpdateAttendanceInput, actorId: string): Promise<Attendance> {
    await this.getOwned(organisationId, id);

    const record = await this.prisma.attendance.update({
      where: { id },
      data: {
        status: input.status,
        clockInAt: input.clockInAt,
        clockOutAt: input.clockOutAt,
        notes: input.notes,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "ATTENDANCE_UPDATED",
        resourceType: "Attendance",
        resourceId: record.id,
        metadata: { status: record.status },
      },
    });

    return this.toAttendance(record);
  }

  private async getOwned(organisationId: string, id: string): Promise<PrismaAttendance> {
    const record = await this.prisma.attendance.findUnique({ where: { id } });
    if (!record || record.organisationId !== organisationId) {
      throw new NotFoundApiException("Attendance record not found", "ATTENDANCE_NOT_FOUND");
    }
    return record;
  }

  private async assertEmployeeOwned(organisationId: string, employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.organisationId !== organisationId) {
      throw new ValidationApiException("employeeId does not exist in this organisation");
    }
  }

  private toAttendance(record: PrismaAttendance): Attendance {
    return {
      id: record.id,
      organisationId: record.organisationId,
      employeeId: record.employeeId,
      date: record.date.toISOString(),
      status: record.status,
      clockInAt: record.clockInAt?.toISOString() ?? null,
      clockOutAt: record.clockOutAt?.toISOString() ?? null,
      notes: record.notes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
