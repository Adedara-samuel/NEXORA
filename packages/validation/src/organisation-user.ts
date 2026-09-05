import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

export const createOrganisationUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  password: z.string().min(8),
  roleIds: z.array(z.string().uuid()).default([]),
  departmentId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});
export type CreateOrganisationUserInput = z.infer<typeof createOrganisationUserSchema>;

export const updateOrganisationUserSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
});
export type UpdateOrganisationUserInput = z.infer<typeof updateOrganisationUserSchema>;

export const listOrganisationUsersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  search: z.string().trim().min(1).optional(),
});
export type ListOrganisationUsersQuery = z.infer<typeof listOrganisationUsersQuerySchema>;
