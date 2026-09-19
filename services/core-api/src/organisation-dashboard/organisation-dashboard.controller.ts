import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { OrganisationDashboardService } from "./organisation-dashboard.service";

@ApiTags("organisation-dashboard")
@Controller("organisation/dashboard")
export class OrganisationDashboardController {
  constructor(private readonly dashboard: OrganisationDashboardService) {}

  /** No @RequirePermissions — every authenticated organisation user can call
   * this; OrganisationDashboardService decides which sections their own
   * permissions unlock (same pattern as the platform DashboardController).
   * CurrentOrganisationId still rejects anything that isn't an organisation
   * session, and derives the tenant from the caller's JWT, never a param. */
  @Get("summary")
  getSummary(@CurrentOrganisationId() organisationId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.dashboard.getSummary(organisationId, actor);
  }
}
