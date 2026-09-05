export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY";

export interface Attendance {
  id: string;
  organisationId: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  clockInAt: string | null;
  clockOutAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
