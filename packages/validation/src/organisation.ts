import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and hyphens only");

export const createOrganisationSchema = z.object({
  name: z.string().trim().min(1),
  slug: slugSchema.optional(),
  contactEmail: z.string().trim().toLowerCase().email(),
  contactPhone: z.string().trim().min(1).optional(),
  industry: z.string().trim().min(1).optional(),
});
export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;

export const updateOrganisationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  contactEmail: z.string().trim().toLowerCase().email().optional(),
  contactPhone: z.string().trim().min(1).optional(),
  industry: z.string().trim().min(1).optional(),
});
export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;

export const updateOrganisationStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"]),
});
export type UpdateOrganisationStatusInput = z.infer<typeof updateOrganisationStatusSchema>;

export const listOrganisationsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
  search: z.string().trim().min(1).optional(),
});
export type ListOrganisationsQuery = z.infer<typeof listOrganisationsQuerySchema>;
