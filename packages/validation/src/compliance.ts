import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

const complianceStatus = z.enum(["COMPLIANT", "PENDING", "EXPIRED", "NON_COMPLIANT"]);

export const createComplianceRecordSchema = z.object({
  employeeId: z.string().uuid().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  dueDate: z.coerce.date().optional(),
  documentId: z.string().uuid().optional(),
});
export type CreateComplianceRecordInput = z.infer<typeof createComplianceRecordSchema>;

// Whether completedDate is required is enforced in the service (same
// same-request rule as Employee's TERMINATED + terminationDate), not here —
// a zod-level check can't tell "not provided in this request" apart from
// "already set from a previous update".
export const updateComplianceRecordSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  status: complianceStatus.optional(),
  dueDate: z.coerce.date().nullable().optional(),
  completedDate: z.coerce.date().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
});
export type UpdateComplianceRecordInput = z.infer<typeof updateComplianceRecordSchema>;

export const listComplianceRecordsQuerySchema = paginationQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  status: complianceStatus.optional(),
});
export type ListComplianceRecordsQuery = z.infer<typeof listComplianceRecordsQuerySchema>;
