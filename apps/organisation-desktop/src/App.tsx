import { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { ThemeProvider, ToastProvider } from "@nexora/ui";
import { LoginPage } from "./pages/login-page";
// Lazy so the charting library (recharts) is fetched after sign-in rather
// than bundled into the login screen's first load.
const DashboardPage = lazy(() => import("./pages/dashboard-page"));
import EmployeesPage from "./pages/employees-page";
import AttendancePage from "./pages/attendance-page";
import LeavePage from "./pages/leave-page";
import PayrollPage from "./pages/payroll-page";
import AssistantPage from "./pages/assistant-page";
import DocumentsPage from "./pages/documents-page";
import CompliancePage from "./pages/compliance-page";
import OrganisationStructurePage from "./pages/organisation-structure-page";
import OrganisationUsersPage from "./pages/organisation-users-page";
import OrganisationRolesPage from "./pages/organisation-roles-page";

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/structure" element={<OrganisationStructurePage />} />
            <Route path="/users" element={<OrganisationUsersPage />} />
            <Route path="/roles" element={<OrganisationRolesPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
