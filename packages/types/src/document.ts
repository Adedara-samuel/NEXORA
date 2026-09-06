export type DocumentCategory = "IDENTIFICATION" | "CONTRACT" | "CERTIFICATE" | "POLICY" | "OTHER";

export interface OrganisationDocument {
  id: string;
  organisationId: string;
  employeeId: string | null;
  title: string;
  category: DocumentCategory;
  fileUrl: string;
  expiryDate: string | null;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
}
