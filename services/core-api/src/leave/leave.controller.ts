import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createLeaveRequestSchema,
  decideLeaveRequestSchema,
  listLeaveRequestsQuerySchema,
  type CreateLeaveRequestInput,
  type DecideLeaveRequestInput,
  type ListLeaveRequestsQuery,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { LeaveService } from "./leave.service";

@ApiTags("leave")
@UseGuards(PermissionsGuard)
@Controller("organisation/leave")
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @RequirePermissions("leave:read")
  @Get()
  list(@CurrentOrganisationId() organisationId: string, @Query(new ZodValidationPipe(listLeaveRequestsQuerySchema)) query: ListLeaveRequestsQuery) {
    return this.leave.list(organisationId, query);
  }

  @RequirePermissions("leave:read")
  @Get(":id")
  findById(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.leave.findById(organisationId, id);
  }

  @RequirePermissions("leave:create")
  @Post()
  create(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createLeaveRequestSchema)) body: CreateLeaveRequestInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.leave.create(organisationId, body, actor.sub);
  }

  @RequirePermissions("leave:manage")
  @Patch(":id/decision")
  decide(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(decideLeaveRequestSchema)) body: DecideLeaveRequestInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.leave.decide(organisationId, id, body, actor.sub);
  }
}
