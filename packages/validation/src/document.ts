import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

const documentCategory = z.enum(["IDENTIFICATION", "CONTRACT", "CERTIFICATE", "POLICY", "OTHER"]);

export const createDocumentSchema = z.object({
  employeeId: z.string().uuid().optional(),
  title: z.string().trim().min(1),
  category: documentCategory.default("OTHER"),
  fileUrl: z.string().trim().url(),
  expiryDate: z.coerce.date().optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).optional(),
  category: documentCategory.optional(),
  fileUrl: z.string().trim().url().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const listDocumentsQuerySchema = paginationQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  category: documentCategory.optional(),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
