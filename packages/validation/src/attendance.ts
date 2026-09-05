import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

const attendanceStatus = z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY"]);

export const createAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  status: attendanceStatus.default("PRESENT"),
  clockInAt: z.coerce.date().optional(),
  clockOutAt: z.coerce.date().optional(),
  notes: z.string().trim().min(1).optional(),
});
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;

export const updateAttendanceSchema = z.object({
  status: attendanceStatus.optional(),
  clockInAt: z.coerce.date().nullable().optional(),
  clockOutAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

export const listAttendanceQuerySchema = paginationQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  status: attendanceStatus.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
