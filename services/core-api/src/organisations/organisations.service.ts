import { Injectable } from "@nestjs/common";
import type {
  CreateOrganisationInput,
  ListOrganisationsQuery,
  UpdateOrganisationInput,
  UpdateOrganisationStatusInput,
} from "@nexora/validation";
import type { Organisation, PaginatedResult, RecentActivityEntry } from "@nexora/types";
import type { Organisation as PrismaOrganisation, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";
import { slugify } from "../common/utils/slugify";

/** Terminal/lifecycle rules for organisation status transitions. ARCHIVED is a dead end. */
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["SUSPENDED", "ARCHIVED"],
  SUSPENDED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

@Injectable()
export class OrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListOrganisationsQuery): Promise<PaginatedResult<Organisation>> {
    const where: Prisma.OrganisationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } },
              { contactEmail: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, organisations] = await this.prisma.$transaction([
      this.prisma.organisation.count({ where }),
      this.prisma.organisation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: organisations.map((organisation) => this.toOrganisation(organisation)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: string): Promise<Organisation> {
    const organisation = await this.prisma.organisation.findUnique({ where: { id } });
    if (!organisation) throw new NotFoundApiException("Organisation not found", "ORGANISATION_NOT_FOUND");
    return this.toOrganisation(organisation);
  }

  async create(input: CreateOrganisationInput, actorId: string): Promise<Organisation> {
    const slug = input.slug ?? (await this.uniqueSlugFrom(input.name));
    const existing = await this.prisma.organisation.findUnique({ where: { slug } });
    if (existing) throw new ConflictApiException("An organisation with this slug already exists", "SLUG_TAKEN");

    const organisation = await this.prisma.organisation.create({
      data: {
        name: input.name,
        slug,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        industry: input.industry,
        createdById: actorId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        organisationId: organisation.id,
        action: "ORGANISATION_CREATED",
        resourceType: "Organisation",
        resourceId: organisation.id,
        metadata: { name: organisation.name, slug: organisation.slug },
      },
    });

    return this.toOrganisation(organisation);
  }

  async update(id: string, input: UpdateOrganisationInput, actorId: string): Promise<Organisation> {
    const existing = await this.prisma.organisation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundApiException("Organisation not found", "ORGANISATION_NOT_FOUND");

    const organisation = await this.prisma.organisation.update({
      where: { id },
      data: {
        name: input.name,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        industry: input.industry,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        organisationId: organisation.id,
        action: "ORGANISATION_UPDATED",
        resourceType: "Organisation",
        resourceId: organisation.id,
        metadata: { ...input },
      },
    });

    return this.toOrganisation(organisation);
  }

  async updateStatus(id: string, input: UpdateOrganisationStatusInput, actorId: string): Promise<Organisation> {
    const existing = await this.prisma.organisation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundApiException("Organisation not found", "ORGANISATION_NOT_FOUND");

    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] ?? [];
    if (existing.status !== input.status && !allowed.includes(input.status)) {
      throw new ValidationApiException(`Cannot transition organisation from ${existing.status} to ${input.status}`, {
        from: existing.status,
        to: input.status,
        allowed,
      });
    }

    const organisation = await this.prisma.organisation.update({ where: { id }, data: { status: input.status } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        organisationId: organisation.id,
        action: "ORGANISATION_STATUS_CHANGED",
        resourceType: "Organisation",
        resourceId: organisation.id,
        metadata: { from: existing.status, to: organisation.status },
      },
    });

    return this.toOrganisation(organisation);
  }

  async listAuditLog(id: string): Promise<RecentActivityEntry[]> {
    const existing = await this.prisma.organisation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundApiException("Organisation not found", "ORGANISATION_NOT_FOUND");

    const logs = await this.prisma.auditLog.findMany({
      where: { organisationId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      organisationId: log.organisationId,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  private async uniqueSlugFrom(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 1;
    while (await this.prisma.organisation.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  private toOrganisation(organisation: PrismaOrganisation): Organisation {
    return {
      id: organisation.id,
      name: organisation.name,
      slug: organisation.slug,
      status: organisation.status,
      contactEmail: organisation.contactEmail,
      contactPhone: organisation.contactPhone,
      industry: organisation.industry,
      createdById: organisation.createdById,
      createdAt: organisation.createdAt.toISOString(),
      updatedAt: organisation.updatedAt.toISOString(),
    };
  }
}
