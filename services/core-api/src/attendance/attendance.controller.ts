import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createAttendanceSchema,
  listAttendanceQuerySchema,
  updateAttendanceSchema,
  type CreateAttendanceInput,
  type ListAttendanceQuery,
  type UpdateAttendanceInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AttendanceService } from "./attendance.service";

@ApiTags("attendance")
@UseGuards(PermissionsGuard)
@Controller("organisation/attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @RequirePermissions("attendance:read")
  @Get()
  list(@CurrentOrganisationId() organisationId: string, @Query(new ZodValidationPipe(listAttendanceQuerySchema)) query: ListAttendanceQuery) {
    return this.attendance.list(organisationId, query);
  }

  @RequirePermissions("attendance:read")
  @Get(":id")
  findById(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.attendance.findById(organisationId, id);
  }

  @RequirePermissions("attendance:create")
  @Post()
  create(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createAttendanceSchema)) body: CreateAttendanceInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.attendance.create(organisationId, body, actor.sub);
  }

  @RequirePermissions("attendance:update")
  @Patch(":id")
  update(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAttendanceSchema)) body: UpdateAttendanceInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.attendance.update(organisationId, id, body, actor.sub);
  }
}
