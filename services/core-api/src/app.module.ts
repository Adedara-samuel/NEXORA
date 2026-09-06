import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { RbacModule } from "./rbac/rbac.module";
import { PlatformUsersModule } from "./platform-users/platform-users.module";
import { OrganisationsModule } from "./organisations/organisations.module";
import { BillingModule } from "./billing/billing.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { OrganisationRbacModule } from "./organisation-rbac/organisation-rbac.module";
import { OrganisationUsersModule } from "./organisation-users/organisation-users.module";
import { OrganisationStructureModule } from "./organisation-structure/organisation-structure.module";
import { EmployeesModule } from "./employees/employees.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { LeaveModule } from "./leave/leave.module";
import { PayrollModule } from "./payroll/payroll.module";
import { DocumentsModule } from "./documents/documents.module";
import { ComplianceModule } from "./compliance/compliance.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    RbacModule,
    PlatformUsersModule,
    OrganisationsModule,
    BillingModule,
    DashboardModule,
    OrganisationRbacModule,
    OrganisationUsersModule,
    OrganisationStructureModule,
    EmployeesModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    DocumentsModule,
    ComplianceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
