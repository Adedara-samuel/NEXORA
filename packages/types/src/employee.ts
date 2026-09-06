export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "TERMINATED";

export interface Employee {
  id: string;
  organisationId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  departmentId: string | null;
  branchId: string | null;
  organisationUserId: string | null;
  status: EmployeeStatus;
  hireDate: string;
  terminationDate: string | null;
  salaryMinor: number | null;
  currency: string;
  bankAccountNumber: string | null;
  bankCode: string | null;
  createdAt: string;
  updatedAt: string;
}
