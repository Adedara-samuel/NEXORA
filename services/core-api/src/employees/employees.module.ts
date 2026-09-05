import { Module } from "@nestjs/common";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, PermissionsGuard],
})
export class EmployeesModule {}
