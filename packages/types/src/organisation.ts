export type OrganisationStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  status: OrganisationStatus;
  contactEmail: string;
  contactPhone: string | null;
  industry: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}
