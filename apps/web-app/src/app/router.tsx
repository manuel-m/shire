import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/navigation/ProtectedRoute.js';
import { AppLayout } from '../components/layout/AppLayout.js';
import { LoginPage } from '../features/auth/pages/LoginPage.js';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage.js';
import { ClientsListPage } from '../features/clients/pages/ClientsListPage.js';
import { ClientCreatePage } from '../features/clients/pages/ClientCreatePage.js';
import { ClientDetailPage } from '../features/clients/pages/ClientDetailPage.js';
import { ClientEditPage } from '../features/clients/pages/ClientEditPage.js';
import { EngagementsListPage } from '../features/engagements/pages/EngagementsListPage.js';
import { EngagementCreatePage } from '../features/engagements/pages/EngagementCreatePage.js';
import { EngagementEditPage } from '../features/engagements/pages/EngagementEditPage.js';
import { ReportsListPage } from '../features/reports/pages/ReportsListPage.js';
import { ReportViewPage } from '../features/reports/pages/ReportViewPage.js';
import { InvoicesListPage } from '../features/billing/pages/InvoicesListPage.js';
import { InvoiceViewPage } from '../features/billing/pages/InvoiceViewPage.js';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsListPage />} />
        <Route path="/clients/new" element={<ClientCreatePage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/clients/:id/edit" element={<ClientEditPage />} />
        <Route path="/engagements" element={<EngagementsListPage />} />
        <Route path="/engagements/new" element={<EngagementCreatePage />} />
        <Route path="/engagements/:id/edit" element={<EngagementEditPage />} />
        <Route path="/reports" element={<ReportsListPage />} />
        <Route path="/reports/:id" element={<ReportViewPage />} />
        <Route path="/invoices" element={<InvoicesListPage />} />
        <Route path="/invoices/:id" element={<InvoiceViewPage />} />
      </Route>
    </Routes>
  );
}
