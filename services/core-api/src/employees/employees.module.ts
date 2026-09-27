import { Module } from "@nestjs/common";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
})
export class EmployeesModule {}
