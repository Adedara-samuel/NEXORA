import { z } from "zod";

export const organisationLoginSchema = z.object({
  organisationSlug: z.string().trim().toLowerCase().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type OrganisationLoginInput = z.infer<typeof organisationLoginSchema>;

export const provisionOrganisationAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});
export type ProvisionOrganisationAdminInput = z.infer<typeof provisionOrganisationAdminSchema>;
