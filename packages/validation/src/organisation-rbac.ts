import { z } from "zod";

export const createOrganisationRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Z0-9_]+$/, "Role name must be UPPER_SNAKE_CASE"),
  description: z.string().trim().min(1).optional(),
  permissionKeys: z.array(z.string()).default([]),
});
export type CreateOrganisationRoleInput = z.infer<typeof createOrganisationRoleSchema>;

export const updateOrganisationRoleSchema = z.object({
  description: z.string().trim().min(1).optional(),
  permissionKeys: z.array(z.string()).optional(),
});
export type UpdateOrganisationRoleInput = z.infer<typeof updateOrganisationRoleSchema>;
