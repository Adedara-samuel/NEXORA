import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

const leaveType = z.enum(["ANNUAL", "SICK", "MATERNITY", "PATERNITY", "UNPAID", "OTHER"]);
const leaveStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

export const createLeaveRequestSchema = z
  .object({
    employeeId: z.string().uuid(),
    leaveType,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const decideLeaveRequestSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
    rejectionReason: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.status !== "REJECTED" || !!value.rejectionReason, {
    message: "rejectionReason is required when rejecting a leave request",
    path: ["rejectionReason"],
  });
export type DecideLeaveRequestInput = z.infer<typeof decideLeaveRequestSchema>;

export const listLeaveRequestsQuerySchema = paginationQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  status: leaveStatus.optional(),
});
export type ListLeaveRequestsQuery = z.infer<typeof listLeaveRequestsQuerySchema>;
