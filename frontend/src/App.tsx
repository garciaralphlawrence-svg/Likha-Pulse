import { lazy, ReactNode, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import StaffLayout, { PublicLayout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Plan from "./pages/Plan";
import Track from "./pages/Track";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Requests = lazy(() => import("./pages/Requests"));
const RequestDetail = lazy(() => import("./pages/RequestDetail"));
const QuotePage = lazy(() => import("./pages/QuotePage"));
const Rates = lazy(() => import("./pages/Rates"));
const UsersPage = lazy(() => import("./pages/Users"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Audit = lazy(() => import("./pages/Audit"));

function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(perm) ? <>{children}</> : <div className="card p-8 text-center text-sm text-ink-500">Your role does not have access to this page.</div>;
}

function Staff() {
  const { user, ready, can } = useAuth();
  if (!ready) return <Spinner label="Starting…" />;
  if (!user) return <Login />;
  return (
    <StaffLayout>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route index element={can("dashboard.view") ? <Dashboard /> : <Requests />} />
          <Route path="requests" element={<Guard perm="requests.view"><Requests /></Guard>} />
          <Route path="approvals" element={<Guard perm="requests.approve"><Requests initial="approval" /></Guard>} />
          <Route path="requests/:id" element={<Guard perm="requests.view"><RequestDetail /></Guard>} />
          <Route path="quote/:id" element={<Guard perm="requests.view"><QuotePage /></Guard>} />
          <Route path="rates" element={<Guard perm="catalog.view"><Rates /></Guard>} />
          <Route path="team" element={<Guard perm="users.manage"><UsersPage /></Guard>} />
          <Route path="settings" element={<Guard perm="settings.manage"><SettingsPage /></Guard>} />
          <Route path="activity" element={<Guard perm="audit.view"><Audit /></Guard>} />
          <Route path="*" element={<Navigate to="/staff" />} />
        </Routes>
      </Suspense>
    </StaffLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<PublicLayout><Plan /></PublicLayout>} />
          <Route path="/track" element={<PublicLayout><Track /></PublicLayout>} />
          <Route path="/track/:ref" element={<PublicLayout><Track /></PublicLayout>} />
          <Route path="/staff/*" element={<Staff />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
