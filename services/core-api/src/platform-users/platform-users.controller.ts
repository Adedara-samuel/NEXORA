import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createPlatformUserSchema,
  listPlatformUsersQuerySchema,
  updatePlatformUserSchema,
  type CreatePlatformUserInput,
  type ListPlatformUsersQuery,
  type UpdatePlatformUserInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PlatformUsersService } from "./platform-users.service";

@ApiTags("platform-users")
@UseGuards(PermissionsGuard)
@Controller("platform/users")
export class PlatformUsersController {
  constructor(private readonly platformUsers: PlatformUsersService) {}

  @Get("me")
  getMe(@CurrentUser() user: AccessTokenPayload) {
    return this.platformUsers.findById(user.sub);
  }

  @RequirePermissions("platform_users:read")
  @Get()
  list(@Query(new ZodValidationPipe(listPlatformUsersQuerySchema)) query: ListPlatformUsersQuery) {
    return this.platformUsers.list(query);
  }

  @RequirePermissions("platform_users:read")
  @Get(":id")
  findById(@Param("id") id: string) {
    return this.platformUsers.findById(id);
  }

  @RequirePermissions("platform_users:create")
  @Post()
  create(
    @Body(new ZodValidationPipe(createPlatformUserSchema)) body: CreatePlatformUserInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.platformUsers.create(body, actor.sub);
  }

  @RequirePermissions("platform_users:update")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePlatformUserSchema)) body: UpdatePlatformUserInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.platformUsers.update(id, body, actor.sub);
  }
}
