import { Injectable } from "@nestjs/common";
import type { CreateLeaveRequestInput, DecideLeaveRequestInput, ListLeaveRequestsQuery } from "@nexora/validation";
import type { LeaveRequest, PaginatedResult } from "@nexora/types";
import type { LeaveRequest as PrismaLeaveRequest, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organisationId: string, query: ListLeaveRequestsQuery): Promise<PaginatedResult<LeaveRequest>> {
    const where: Prisma.LeaveRequestWhereInput = {
      organisationId,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, requests] = await this.prisma.$transaction([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: requests.map((request) => this.toLeaveRequest(request)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(organisationId: string, id: string): Promise<LeaveRequest> {
    const request = await this.getOwned(organisationId, id);
    return this.toLeaveRequest(request);
  }

  async create(organisationId: string, input: CreateLeaveRequestInput, actorId: string): Promise<LeaveRequest> {
    await this.assertEmployeeOwned(organisationId, input.employeeId);

    const request = await this.prisma.leaveRequest.create({
      data: {
        organisationId,
        employeeId: input.employeeId,
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "LEAVE_REQUESTED",
        resourceType: "LeaveRequest",
        resourceId: request.id,
        metadata: { employeeId: request.employeeId, leaveType: request.leaveType },
      },
    });

    return this.toLeaveRequest(request);
  }

  async decide(organisationId: string, id: string, input: DecideLeaveRequestInput, actorId: string): Promise<LeaveRequest> {
    const existing = await this.getOwned(organisationId, id);
    if (existing.status !== "PENDING") {
      throw new ValidationApiException("Only a pending leave request can be approved, rejected or cancelled");
    }

    const request = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: input.status,
        rejectionReason: input.status === "REJECTED" ? input.rejectionReason : null,
        approvedById: input.status === "APPROVED" ? actorId : null,
        approvedAt: input.status === "APPROVED" ? new Date() : null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: `LEAVE_${input.status}`,
        resourceType: "LeaveRequest",
        resourceId: request.id,
        metadata: { rejectionReason: request.rejectionReason },
      },
    });

    return this.toLeaveRequest(request);
  }

  private async getOwned(organisationId: string, id: string): Promise<PrismaLeaveRequest> {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request || request.organisationId !== organisationId) {
      throw new NotFoundApiException("Leave request not found", "LEAVE_REQUEST_NOT_FOUND");
    }
    return request;
  }

  private async assertEmployeeOwned(organisationId: string, employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.organisationId !== organisationId) {
      throw new ValidationApiException("employeeId does not exist in this organisation");
    }
  }

  private toLeaveRequest(request: PrismaLeaveRequest): LeaveRequest {
    return {
      id: request.id,
      organisationId: request.organisationId,
      employeeId: request.employeeId,
      leaveType: request.leaveType,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      reason: request.reason,
      status: request.status,
      approvedById: request.approvedById,
      approvedAt: request.approvedAt?.toISOString() ?? null,
      rejectionReason: request.rejectionReason,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}
