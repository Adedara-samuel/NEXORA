import { z } from "zod";

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Z0-9_]+$/, "Role name must be UPPER_SNAKE_CASE"),
  description: z.string().trim().min(1).optional(),
  permissionKeys: z.array(z.string()).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  description: z.string().trim().min(1).optional(),
  permissionKeys: z.array(z.string()).optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
