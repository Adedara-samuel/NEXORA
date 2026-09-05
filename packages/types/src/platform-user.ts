export type PlatformUserStatus = "ACTIVE" | "DISABLED";

/** Frontend/API-facing shape — never includes passwordHash. */
export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: PlatformUserStatus;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
