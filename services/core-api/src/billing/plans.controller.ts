import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createPlanSchema, updatePlanSchema, type CreatePlanInput, type UpdatePlanInput } from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PlansService } from "./plans.service";

@ApiTags("billing")
@UseGuards(PermissionsGuard)
@Controller("billing")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @RequirePermissions("billing:read")
  @Get("modules")
  listModules() {
    return this.plans.listModules();
  }

  @RequirePermissions("billing:read")
  @Get("plans")
  listPlans() {
    return this.plans.listPlans();
  }

  @RequirePermissions("billing:read")
  @Get("plans/:id")
  findById(@Param("id") id: string) {
    return this.plans.findById(id);
  }

  @RequirePermissions("billing:manage_plans")
  @Post("plans")
  create(@Body(new ZodValidationPipe(createPlanSchema)) body: CreatePlanInput, @CurrentUser() actor: AccessTokenPayload) {
    return this.plans.create(body, actor.sub);
  }

  @RequirePermissions("billing:manage_plans")
  @Patch("plans/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) body: UpdatePlanInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.plans.update(id, body, actor.sub);
  }
}
