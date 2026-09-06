import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus } from "lucide-react";
import type { DocumentCategory } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

const CATEGORIES: DocumentCategory[] = ["IDENTIFICATION", "CONTRACT", "CERTIFICATE", "POLICY", "OTHER"];

const selectClassName =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function DocumentsPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Metadata only — NEXORA doesn't host files yet. Link to a file you already store elsewhere (Drive, S3, etc).
          </p>
        </Reveal>

        {hasPermission("documents:create") && (
          <Reveal delayMs={60}>
            <CreateDocumentForm />
          </Reveal>
        )}
        <DocumentsList />
      </div>
    </AppShell>
  );
}

function CreateDocumentForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });

  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("OTHER");
  const [fileUrl, setFileUrl] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.documents.create({
        employeeId: employeeId || undefined,
        title: title.trim(),
        category,
        fileUrl: fileUrl.trim(),
        // See employees-page.tsx for why this cast is needed and safe.
        expiryDate: expiryDate ? (expiryDate as unknown as Date) : undefined,
      }),
    onSuccess: () => {
      toast({ variant: "success", title: "Document added" });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setTitle("");
      setFileUrl("");
      setExpiryDate("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not add document.";
      toast({ variant: "error", title: "Could not add document", description: message });
    },
  });

  const employees = employeesQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a document</CardTitle>
        <CardDescription>Leave employee unset for a company-wide document (e.g. a policy).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input id="doc-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="National ID" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-category">Category</Label>
            <select id="doc-category" className={selectClassName} value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)}>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-employee">Employee (optional)</Label>
            <select id="doc-employee" className={selectClassName} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Company-wide</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} ({employee.employeeNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-expiry">Expiry date (optional)</Label>
            <Input id="doc-expiry" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="doc-url">File URL</Label>
            <Input id="doc-url" type="url" value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} placeholder="https://…" />
          </div>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || !fileUrl.trim() || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Adding…" : "Add document"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DocumentsList() {
  const documentsQuery = useQuery({ queryKey: ["documents"], queryFn: () => apiClient.documents.list({ page: 1, pageSize: 100 }) });
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });

  if (documentsQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading documents…</p>;
  if (documentsQuery.isError) return <p className="text-sm text-danger">Could not load documents.</p>;

  const documents = documentsQuery.data?.items ?? [];
  const employeeById = new Map((employeesQuery.data?.items ?? []).map((employee) => [employee.id, employee]));

  if (documents.length === 0) return <p className="text-sm text-muted-foreground">No documents yet.</p>;

  const now = Date.now();

  return (
    <div className="flex flex-col gap-3">
      {documents.map((document, index) => {
        const employee = document.employeeId ? employeeById.get(document.employeeId) : null;
        const expired = document.expiryDate && new Date(document.expiryDate).getTime() < now;
        return (
          <Reveal key={document.id} delayMs={Math.min(index * 30, 300)}>
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {document.title}
                    <Badge variant="outline">{document.category}</Badge>
                    {expired && <Badge variant="danger">EXPIRED</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {employee ? `${employee.firstName} ${employee.lastName}` : "Company-wide"}
                    {document.expiryDate ? ` · expires ${new Date(document.expiryDate).toLocaleDateString()}` : ""}
                  </CardDescription>
                </div>
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </CardHeader>
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}
