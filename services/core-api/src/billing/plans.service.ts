import { Injectable } from "@nestjs/common";
import type { CreatePlanInput, UpdatePlanInput } from "@nexora/validation";
import type { ModuleCatalogEntry, Plan } from "@nexora/types";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

type PlanWithModules = Prisma.PlanGetPayload<{ include: { modules: { include: { module: true } } } }>;

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listModules(): Promise<ModuleCatalogEntry[]> {
    const modules = await this.prisma.module.findMany({ orderBy: { name: "asc" } });
    return modules.map((module) => ({ id: module.id, key: module.key, name: module.name, description: module.description }));
  }

  async listPlans(): Promise<Plan[]> {
    const plans = await this.prisma.plan.findMany({
      include: { modules: { include: { module: true } } },
      orderBy: { priceMinor: "asc" },
    });
    return plans.map((plan) => this.toPlan(plan));
  }

  async findById(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id }, include: { modules: { include: { module: true } } } });
    if (!plan) throw new NotFoundApiException("Plan not found", "PLAN_NOT_FOUND");
    return this.toPlan(plan);
  }

  async create(input: CreatePlanInput, actorId: string): Promise<Plan> {
    const moduleIds = await this.assertModuleKeysExist(input.moduleKeys);

    const plan = await this.prisma.plan.create({
      data: {
        name: input.name,
        description: input.description,
        priceMinor: input.priceMinor,
        currency: input.currency,
        billingCycle: input.billingCycle,
        modules: { createMany: { data: moduleIds.map((moduleId) => ({ moduleId })) } },
      },
      include: { modules: { include: { module: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        action: "PLAN_CREATED",
        resourceType: "Plan",
        resourceId: plan.id,
        metadata: { name: plan.name, priceMinor: plan.priceMinor, billingCycle: plan.billingCycle },
      },
    });

    return this.toPlan(plan);
  }

  async update(id: string, input: UpdatePlanInput, actorId: string): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundApiException("Plan not found", "PLAN_NOT_FOUND");

    const moduleIds = input.moduleKeys ? await this.assertModuleKeysExist(input.moduleKeys) : undefined;

    const plan = await this.prisma.$transaction(async (tx) => {
      if (moduleIds) {
        await tx.planModule.deleteMany({ where: { planId: id } });
        await tx.planModule.createMany({ data: moduleIds.map((moduleId) => ({ planId: id, moduleId })) });
      }
      return tx.plan.update({
        where: { id },
        data: { description: input.description, priceMinor: input.priceMinor, isActive: input.isActive },
        include: { modules: { include: { module: true } } },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        action: "PLAN_UPDATED",
        resourceType: "Plan",
        resourceId: plan.id,
        metadata: { ...input },
      },
    });

    return this.toPlan(plan);
  }

  private async assertModuleKeysExist(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const found = await this.prisma.module.findMany({ where: { key: { in: keys } } });
    if (found.length !== keys.length) {
      const foundKeys = new Set(found.map((module) => module.key));
      const missing = keys.filter((key) => !foundKeys.has(key));
      throw new ValidationApiException("One or more moduleKeys do not exist", { missing });
    }
    return found.map((module) => module.id);
  }

  private toPlan(plan: PlanWithModules): Plan {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceMinor: plan.priceMinor,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      isActive: plan.isActive,
      moduleKeys: plan.modules.map((planModule) => planModule.module.key),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}
