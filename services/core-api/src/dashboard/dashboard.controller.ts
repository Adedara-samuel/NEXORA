import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** No @RequirePermissions — every authenticated platform user can call this;
   * DashboardService itself decides which sections their permissions unlock. */
  @Get("summary")
  getSummary(@CurrentUser() actor: AccessTokenPayload) {
    return this.dashboard.getSummary(actor);
  }
}
