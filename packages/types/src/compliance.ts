export type ComplianceStatus = "COMPLIANT" | "PENDING" | "EXPIRED" | "NON_COMPLIANT";

export interface ComplianceRecord {
  id: string;
  organisationId: string;
  employeeId: string | null;
  title: string;
  description: string | null;
  status: ComplianceStatus;
  dueDate: string | null;
  completedDate: string | null;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
}
