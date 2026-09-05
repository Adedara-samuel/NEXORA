import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const createBranchSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1).optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
