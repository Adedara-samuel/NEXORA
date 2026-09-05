export type OrganisationUserStatus = "ACTIVE" | "DISABLED";

/** Frontend/API-facing shape — never includes passwordHash. */
export interface OrganisationUser {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: OrganisationUserStatus;
  roles: string[];
  departmentId: string | null;
  branchId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  organisationId: string;
  name: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  organisationId: string;
  name: string;
  address: string | null;
  createdAt: string;
}
