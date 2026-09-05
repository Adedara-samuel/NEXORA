import { Injectable } from "@nestjs/common";
import type { CreateEmployeeInput, ListEmployeesQuery, UpdateEmployeeInput } from "@nexora/validation";
import type { Employee, PaginatedResult } from "@nexora/types";
import type { Employee as PrismaEmployee, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organisationId: string, query: ListEmployeesQuery): Promise<PaginatedResult<Employee>> {
    const where: Prisma.EmployeeWhereInput = {
      organisationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { employeeNumber: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, employees] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: employees.map((employee) => this.toEmployee(employee)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(organisationId: string, id: string): Promise<Employee> {
    const employee = await this.getOwned(organisationId, id);
    return this.toEmployee(employee);
  }

  async create(organisationId: string, input: CreateEmployeeInput, actorId: string): Promise<Employee> {
    const existing = await this.prisma.employee.findUnique({
      where: { organisationId_employeeNumber: { organisationId, employeeNumber: input.employeeNumber } },
    });
    if (existing) throw new ConflictApiException("An employee with this employee number already exists", "EMPLOYEE_NUMBER_TAKEN");

    if (input.departmentId) await this.assertDepartmentOwned(organisationId, input.departmentId);
    if (input.branchId) await this.assertBranchOwned(organisationId, input.branchId);

    const employee = await this.prisma.employee.create({
      data: {
        organisationId,
        employeeNumber: input.employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        position: input.position,
        departmentId: input.departmentId,
        branchId: input.branchId,
        hireDate: input.hireDate,
        salaryMinor: input.salaryMinor,
        currency: input.currency,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "EMPLOYEE_CREATED",
        resourceType: "Employee",
        resourceId: employee.id,
        metadata: { employeeNumber: employee.employeeNumber },
      },
    });

    return this.toEmployee(employee);
  }

  async update(organisationId: string, id: string, input: UpdateEmployeeInput, actorId: string): Promise<Employee> {
    await this.getOwned(organisationId, id);

    if (input.departmentId) await this.assertDepartmentOwned(organisationId, input.departmentId);
    if (input.branchId) await this.assertBranchOwned(organisationId, input.branchId);
    if (input.status === "TERMINATED" && !input.terminationDate) {
      throw new ValidationApiException("terminationDate is required when setting status to TERMINATED");
    }

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        position: input.position,
        departmentId: input.departmentId,
        branchId: input.branchId,
        status: input.status,
        terminationDate: input.terminationDate,
        salaryMinor: input.salaryMinor,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "EMPLOYEE_UPDATED",
        resourceType: "Employee",
        resourceId: employee.id,
        metadata: {
          status: input.status,
          departmentId: input.departmentId,
          branchId: input.branchId,
          terminationDate: input.terminationDate?.toISOString(),
        },
      },
    });

    return this.toEmployee(employee);
  }

  private async getOwned(organisationId: string, id: string): Promise<PrismaEmployee> {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee || employee.organisationId !== organisationId) {
      throw new NotFoundApiException("Employee not found", "EMPLOYEE_NOT_FOUND");
    }
    return employee;
  }

  private async assertDepartmentOwned(organisationId: string, departmentId: string): Promise<void> {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department || department.organisationId !== organisationId) {
      throw new ValidationApiException("departmentId does not exist in this organisation");
    }
  }

  private async assertBranchOwned(organisationId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.organisationId !== organisationId) {
      throw new ValidationApiException("branchId does not exist in this organisation");
    }
  }

  private toEmployee(employee: PrismaEmployee): Employee {
    return {
      id: employee.id,
      organisationId: employee.organisationId,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      departmentId: employee.departmentId,
      branchId: employee.branchId,
      organisationUserId: employee.organisationUserId,
      status: employee.status,
      hireDate: employee.hireDate.toISOString(),
      terminationDate: employee.terminationDate?.toISOString() ?? null,
      salaryMinor: employee.salaryMinor,
      currency: employee.currency,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    };
  }
}
