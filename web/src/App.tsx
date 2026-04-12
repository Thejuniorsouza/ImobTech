import { Navigate, Route, Routes } from "react-router-dom";
import { OwnerLayout, TenantLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/ui/ProtectedRoute";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { DashboardPage } from "./pages/owner/DashboardPage";
import { PropertiesPage } from "./pages/owner/PropertiesPage";
import { ContractsPage } from "./pages/owner/ContractsPage";
import { InvoicesPage } from "./pages/owner/InvoicesPage";
import { TemplatesPage } from "./pages/owner/TemplatesPage";
import { InspectionsPage } from "./pages/owner/InspectionsPage";
import { DocumentsPage } from "./pages/owner/DocumentsPage";
import { AdsPage } from "./pages/owner/AdsPage";
import { TenantDashboardPage } from "./pages/tenant/TenantDashboardPage";
import { UserRole } from "./lib/constants";

export function App() {
    return (
        <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Owner */}
            <Route
                path="/owner"
                element={
                    <ProtectedRoute role={UserRole.Owner}>
                        <OwnerLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="properties" element={<PropertiesPage />} />
                <Route path="contracts" element={<ContractsPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="inspections" element={<InspectionsPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="ads" element={<AdsPage />} />
                <Route path="settings" element={<DashboardPage />} />
            </Route>

            {/* Tenant */}
            <Route
                path="/tenant"
                element={
                    <ProtectedRoute role={UserRole.Tenant}>
                        <TenantLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<TenantDashboardPage />} />
                <Route path="contracts" element={<TenantDashboardPage />} />
                <Route path="invoices" element={<TenantDashboardPage />} />
                <Route path="documents" element={<TenantDashboardPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
