import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { ThemeProvider, ToastProvider } from "@nexora/ui";
import { LoginPage } from "./pages/login-page";
import EmployeesPage from "./pages/employees-page";
import AttendancePage from "./pages/attendance-page";
import LeavePage from "./pages/leave-page";
import PayrollPage from "./pages/payroll-page";
import DocumentsPage from "./pages/documents-page";
import CompliancePage from "./pages/compliance-page";

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="*" element={<Navigate to="/employees" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
