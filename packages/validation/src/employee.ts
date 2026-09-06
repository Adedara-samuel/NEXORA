import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

export const createEmployeeSchema = z.object({
  employeeNumber: z.string().trim().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().min(1).optional(),
  position: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  hireDate: z.coerce.date(),
  salaryMinor: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().trim().toUpperCase().length(3).default("NGN"),
  bankAccountNumber: z.string().trim().min(1).optional(),
  bankCode: z.string().trim().min(1).optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().min(1).optional(),
  position: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  terminationDate: z.coerce.date().nullable().optional(),
  salaryMinor: z.coerce.number().int().nonnegative().nullable().optional(),
  bankAccountNumber: z.string().trim().min(1).nullable().optional(),
  bankCode: z.string().trim().min(1).nullable().optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  departmentId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
});
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
