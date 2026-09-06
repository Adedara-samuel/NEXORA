import type {
  ApiResult,
  Attendance,
  AuthTokens,
  Branch,
  ComplianceRecord,
  DashboardSummary,
  Department,
  Employee,
  Invoice,
  LeaveRequest,
  ModuleCatalogEntry,
  Organisation,
  OrganisationDocument,
  OrganisationTaxSettings,
  OrganisationUser,
  PaginatedResult,
  PayrollBankAccount,
  PayrollReconciliationReport,
  PayrollRun,
  PayrollRunWithPayslips,
  PayrollWallet,
  PayrollWalletDeposit,
  Permission,
  Plan,
  PlatformUser,
  RecentActivityEntry,
  Role,
  Subscription,
} from "@nexora/types";
import type {
  ChangeSubscriptionPlanInput,
  CreateAttendanceInput,
  CreateBranchInput,
  CreateComplianceRecordInput,
  CreateDepartmentInput,
  CreateDocumentInput,
  CreateEmployeeInput,
  CreateLeaveRequestInput,
  CreateOrganisationInput,
  CreateOrganisationRoleInput,
  CreateOrganisationUserInput,
  CreatePlanInput,
  CreatePlatformUserInput,
  CreateRoleInput,
  CreateSubscriptionInput,
  DecideLeaveRequestInput,
  DepositToPayrollWalletInput,
  LinkPayrollBankAccountInput,
  ListAttendanceQuery,
  ListComplianceRecordsQuery,
  ListDocumentsQuery,
  ListEmployeesQuery,
  ListLeaveRequestsQuery,
  ListOrganisationsQuery,
  ListOrganisationUsersQuery,
  ListPlatformUsersQuery,
  RenewSubscriptionInput,
  RunPayrollInput,
  UpdateAttendanceInput,
  UpdateComplianceRecordInput,
  UpdateDocumentInput,
  UpdateEmployeeInput,
  UpdateOrganisationInput,
  UpdateOrganisationRoleInput,
  UpdateOrganisationStatusInput,
  UpdateOrganisationUserInput,
  UpdatePlanInput,
  UpdatePlatformUserInput,
  UpdateRoleInput,
  UpdateTaxSettingsInput,
} from "@nexora/validation";

export class NexoraApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NexoraApiError";
  }
}

export interface NexoraApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

/**
 * Thin typed wrapper around the NEXORA Core API. Shared by the Control
 * Center (Next.js) and Organisation Desktop (Tauri) frontends so both
 * speak to /api/v1 the same way.
 */
export class NexoraApiClient {
  constructor(private readonly options: NexoraApiClientOptions) {}

  private toQueryString(query: Record<string, unknown> | undefined): string {
    if (!query) return "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = this.options.getAccessToken?.();
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });

    const body = (await response.json()) as ApiResult<T>;

    if (!body.success) {
      throw new NexoraApiError(body.error.code, body.error.message, response.status, body.error.details);
    }

    return body.data;
  }

  health(): Promise<{ status: string; timestamp: string }> {
    return this.request("/api/v1/health");
  }

  auth = {
    platformLogin: (email: string, password: string): Promise<AuthTokens> =>
      this.request("/api/v1/auth/platform/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),

    organisationLogin: (organisationSlug: string, email: string, password: string): Promise<AuthTokens> =>
      this.request("/api/v1/auth/organisation/login", {
        method: "POST",
        body: JSON.stringify({ organisationSlug, email, password }),
      }),

    refresh: (refreshToken: string): Promise<AuthTokens> =>
      this.request("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),

    logout: (refreshToken: string): Promise<void> =>
      this.request("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),
  };

  rbac = {
    listRoles: (): Promise<Role[]> => this.request("/api/v1/platform/roles"),

    listPermissions: (): Promise<Permission[]> => this.request("/api/v1/platform/permissions"),

    createRole: (input: CreateRoleInput): Promise<Role> =>
      this.request("/api/v1/platform/roles", { method: "POST", body: JSON.stringify(input) }),

    updateRole: (id: string, input: UpdateRoleInput): Promise<Role> =>
      this.request(`/api/v1/platform/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

    deleteRole: (id: string): Promise<{ deleted: true }> =>
      this.request(`/api/v1/platform/roles/${id}`, { method: "DELETE" }),
  };

  platformUsers = {
    me: (): Promise<PlatformUser> => this.request("/api/v1/platform/users/me"),

    list: (query: Partial<ListPlatformUsersQuery> = {}): Promise<PaginatedResult<PlatformUser>> =>
      this.request(`/api/v1/platform/users${this.toQueryString(query)}`),

    findById: (id: string): Promise<PlatformUser> => this.request(`/api/v1/platform/users/${id}`),

    create: (input: CreatePlatformUserInput): Promise<PlatformUser> =>
      this.request("/api/v1/platform/users", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdatePlatformUserInput): Promise<PlatformUser> =>
      this.request(`/api/v1/platform/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  };

  organisations = {
    list: (query: Partial<ListOrganisationsQuery> = {}): Promise<PaginatedResult<Organisation>> =>
      this.request(`/api/v1/organisations${this.toQueryString(query)}`),

    findById: (id: string): Promise<Organisation> => this.request(`/api/v1/organisations/${id}`),

    create: (input: CreateOrganisationInput): Promise<Organisation> =>
      this.request("/api/v1/organisations", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdateOrganisationInput): Promise<Organisation> =>
      this.request(`/api/v1/organisations/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

    updateStatus: (id: string, input: UpdateOrganisationStatusInput): Promise<Organisation> =>
      this.request(`/api/v1/organisations/${id}/status`, { method: "PATCH", body: JSON.stringify(input) }),

    listAuditLog: (id: string): Promise<RecentActivityEntry[]> => this.request(`/api/v1/organisations/${id}/audit-log`),
  };

  billing = {
    listModules: (): Promise<ModuleCatalogEntry[]> => this.request("/api/v1/billing/modules"),

    listPlans: (): Promise<Plan[]> => this.request("/api/v1/billing/plans"),

    createPlan: (input: CreatePlanInput): Promise<Plan> =>
      this.request("/api/v1/billing/plans", { method: "POST", body: JSON.stringify(input) }),

    updatePlan: (id: string, input: UpdatePlanInput): Promise<Plan> =>
      this.request(`/api/v1/billing/plans/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

    getSubscription: (organisationId: string): Promise<Subscription> =>
      this.request(`/api/v1/organisations/${organisationId}/subscription`),

    createSubscription: (organisationId: string, input: CreateSubscriptionInput): Promise<Subscription> =>
      this.request(`/api/v1/organisations/${organisationId}/subscription`, { method: "POST", body: JSON.stringify(input) }),

    changePlan: (organisationId: string, input: ChangeSubscriptionPlanInput): Promise<Subscription> =>
      this.request(`/api/v1/organisations/${organisationId}/subscription`, { method: "PATCH", body: JSON.stringify(input) }),

    renewSubscription: (
      organisationId: string,
      input: RenewSubscriptionInput = { simulateFailure: false },
    ): Promise<{ subscription: Subscription; invoice: Invoice }> =>
      this.request(`/api/v1/organisations/${organisationId}/subscription/renew`, { method: "POST", body: JSON.stringify(input) }),

    cancelSubscription: (organisationId: string): Promise<Subscription> =>
      this.request(`/api/v1/organisations/${organisationId}/subscription/cancel`, { method: "POST" }),

    listInvoices: (organisationId: string): Promise<Invoice[]> =>
      this.request(`/api/v1/organisations/${organisationId}/invoices`),

    findInvoiceById: (id: string): Promise<Invoice> => this.request(`/api/v1/invoices/${id}`),
  };

  dashboard = {
    getSummary: (): Promise<DashboardSummary> => this.request("/api/v1/dashboard/summary"),
  };

  organisationStructure = {
    listDepartments: (): Promise<Department[]> => this.request("/api/v1/organisation/departments"),

    createDepartment: (input: CreateDepartmentInput): Promise<Department> =>
      this.request("/api/v1/organisation/departments", { method: "POST", body: JSON.stringify(input) }),

    listBranches: (): Promise<Branch[]> => this.request("/api/v1/organisation/branches"),

    createBranch: (input: CreateBranchInput): Promise<Branch> =>
      this.request("/api/v1/organisation/branches", { method: "POST", body: JSON.stringify(input) }),
  };

  organisationUsers = {
    getMe: (): Promise<OrganisationUser> => this.request("/api/v1/organisation/users/me"),

    list: (query: Partial<ListOrganisationUsersQuery> = {}): Promise<PaginatedResult<OrganisationUser>> =>
      this.request(`/api/v1/organisation/users${this.toQueryString(query)}`),

    findById: (id: string): Promise<OrganisationUser> => this.request(`/api/v1/organisation/users/${id}`),

    create: (input: CreateOrganisationUserInput): Promise<OrganisationUser> =>
      this.request("/api/v1/organisation/users", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdateOrganisationUserInput): Promise<OrganisationUser> =>
      this.request(`/api/v1/organisation/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  };

  organisationRbac = {
    listRoles: (): Promise<Role[]> => this.request("/api/v1/organisation/roles"),

    listPermissions: (): Promise<Permission[]> => this.request("/api/v1/organisation/permissions"),

    createRole: (input: CreateOrganisationRoleInput): Promise<Role> =>
      this.request("/api/v1/organisation/roles", { method: "POST", body: JSON.stringify(input) }),

    updateRole: (id: string, input: UpdateOrganisationRoleInput): Promise<Role> =>
      this.request(`/api/v1/organisation/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

    deleteRole: (id: string): Promise<{ deleted: true }> => this.request(`/api/v1/organisation/roles/${id}`, { method: "DELETE" }),
  };

  employees = {
    list: (query: Partial<ListEmployeesQuery> = {}): Promise<PaginatedResult<Employee>> =>
      this.request(`/api/v1/organisation/employees${this.toQueryString(query)}`),

    findById: (id: string): Promise<Employee> => this.request(`/api/v1/organisation/employees/${id}`),

    create: (input: CreateEmployeeInput): Promise<Employee> =>
      this.request("/api/v1/organisation/employees", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdateEmployeeInput): Promise<Employee> =>
      this.request(`/api/v1/organisation/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  };

  attendance = {
    list: (query: Partial<ListAttendanceQuery> = {}): Promise<PaginatedResult<Attendance>> =>
      this.request(`/api/v1/organisation/attendance${this.toQueryString(query)}`),

    findById: (id: string): Promise<Attendance> => this.request(`/api/v1/organisation/attendance/${id}`),

    create: (input: CreateAttendanceInput): Promise<Attendance> =>
      this.request("/api/v1/organisation/attendance", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdateAttendanceInput): Promise<Attendance> =>
      this.request(`/api/v1/organisation/attendance/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  };

  leave = {
    list: (query: Partial<ListLeaveRequestsQuery> = {}): Promise<PaginatedResult<LeaveRequest>> =>
      this.request(`/api/v1/organisation/leave${this.toQueryString(query)}`),

    findById: (id: string): Promise<LeaveRequest> => this.request(`/api/v1/organisation/leave/${id}`),

    create: (input: CreateLeaveRequestInput): Promise<LeaveRequest> =>
      this.request("/api/v1/organisation/leave", { method: "POST", body: JSON.stringify(input) }),

    decide: (id: string, input: DecideLeaveRequestInput): Promise<LeaveRequest> =>
      this.request(`/api/v1/organisation/leave/${id}/decision`, { method: "PATCH", body: JSON.stringify(input) }),
  };

  payroll = {
    getTaxSettings: (): Promise<OrganisationTaxSettings> => this.request("/api/v1/organisation/payroll/tax-settings"),

    updateTaxSettings: (input: UpdateTaxSettingsInput): Promise<OrganisationTaxSettings> =>
      this.request("/api/v1/organisation/payroll/tax-settings", { method: "PUT", body: JSON.stringify(input) }),

    listRuns: (query: { page?: number; pageSize?: number } = {}): Promise<PaginatedResult<PayrollRun>> =>
      this.request(`/api/v1/organisation/payroll/runs${this.toQueryString(query)}`),

    getRun: (id: string): Promise<PayrollRunWithPayslips> => this.request(`/api/v1/organisation/payroll/runs/${id}`),

    run: (input: RunPayrollInput): Promise<PayrollRunWithPayslips> =>
      this.request("/api/v1/organisation/payroll/runs", { method: "POST", body: JSON.stringify(input) }),

    cancel: (id: string): Promise<PayrollRun> => this.request(`/api/v1/organisation/payroll/runs/${id}/cancel`, { method: "PATCH" }),

    disburse: (id: string): Promise<PayrollRun> => this.request(`/api/v1/organisation/payroll/runs/${id}/disburse`, { method: "POST" }),

    getWallet: (): Promise<PayrollWallet> => this.request("/api/v1/organisation/payroll/wallet"),

    listBankAccounts: (): Promise<PayrollBankAccount[]> => this.request("/api/v1/organisation/payroll/wallet/bank-accounts"),

    linkBankAccount: (input: LinkPayrollBankAccountInput): Promise<PayrollBankAccount> =>
      this.request("/api/v1/organisation/payroll/wallet/bank-accounts", { method: "POST", body: JSON.stringify(input) }),

    depositToWallet: (input: DepositToPayrollWalletInput, idempotencyKey: string): Promise<PayrollWalletDeposit> =>
      this.request("/api/v1/organisation/payroll/wallet/deposits", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      }),

    reconcile: (id: string): Promise<PayrollReconciliationReport> => this.request(`/api/v1/organisation/payroll/runs/${id}/reconcile`),
  };

  documents = {
    list: (query: Partial<ListDocumentsQuery> = {}): Promise<PaginatedResult<OrganisationDocument>> =>
      this.request(`/api/v1/organisation/documents${this.toQueryString(query)}`),

    findById: (id: string): Promise<OrganisationDocument> => this.request(`/api/v1/organisation/documents/${id}`),

    create: (input: CreateDocumentInput): Promise<OrganisationDocument> =>
      this.request("/api/v1/organisation/documents", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdateDocumentInput): Promise<OrganisationDocument> =>
      this.request(`/api/v1/organisation/documents/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  };

  compliance = {
    list: (query: Partial<ListComplianceRecordsQuery> = {}): Promise<PaginatedResult<ComplianceRecord>> =>
      this.request(`/api/v1/organisation/compliance${this.toQueryString(query)}`),

    findById: (id: string): Promise<ComplianceRecord> => this.request(`/api/v1/organisation/compliance/${id}`),

    create: (input: CreateComplianceRecordInput): Promise<ComplianceRecord> =>
      this.request("/api/v1/organisation/compliance", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdateComplianceRecordInput): Promise<ComplianceRecord> =>
      this.request(`/api/v1/organisation/compliance/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  };
}
