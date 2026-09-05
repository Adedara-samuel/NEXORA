import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

export const createPlatformUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  password: z.string().min(8),
  roleIds: z.array(z.string().uuid()).default([]),
});
export type CreatePlatformUserInput = z.infer<typeof createPlatformUserSchema>;

export const updatePlatformUserSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});
export type UpdatePlatformUserInput = z.infer<typeof updatePlatformUserSchema>;

export const listPlatformUsersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  search: z.string().trim().min(1).optional(),
});
export type ListPlatformUsersQuery = z.infer<typeof listPlatformUsersQuerySchema>;
