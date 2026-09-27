import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { AllowWhenInactive } from "../common/decorators/allow-when-inactive.decorator";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "./entitlements.service";

/**
 * The organisation's own read-only view of its plan — deliberately not
 * gated by @RequirePermissions (knowing your own plan isn't sensitive) and
 * explicitly @AllowWhenInactive() so a suspended organisation can still see
 * WHY it's locked out instead of just getting 402s everywhere.
 */
@ApiTags("organisation-billing")
@UseGuards(OrganisationAccessGuard)
@Controller("organisation/billing")
export class OrganisationBillingController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @AllowWhenInactive()
  @Get("summary")
  getSummary(@CurrentOrganisationId() organisationId: string) {
    return this.entitlements.getEntitlements(organisationId);
  }
}
