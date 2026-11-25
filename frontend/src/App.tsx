import { lazy, ReactNode, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Intro from "./components/Intro";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Sentiment = lazy(() => import("./pages/Sentiment"));
const Insights = lazy(() => import("./pages/Insights"));
const Priority = lazy(() => import("./pages/Priority"));
const Cases = lazy(() => import("./pages/Cases"));
const Reports = lazy(() => import("./pages/Reports"));
const Integrations = lazy(() => import("./pages/Integrations"));
const UsersPage = lazy(() => import("./pages/Users"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Audit = lazy(() => import("./pages/Audit"));

function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(perm) ? <>{children}</> : <div className="card p-8 text-center text-sm text-ink-500">Your role does not have access to this page.</div>;
}

function Shell() {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner label="Starting…" />;
  if (!user) return <Login />;
  return (
    <Layout>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Guard perm="dashboard.view"><Dashboard /></Guard>} />
          <Route path="/feedback" element={<Guard perm="feedback.view"><Feedback /></Guard>} />
          <Route path="/sentiment" element={<Guard perm="feedback.view"><Sentiment /></Guard>} />
          <Route path="/insights" element={<Guard perm="dashboard.view"><Insights /></Guard>} />
          <Route path="/priority" element={<Guard perm="feedback.view"><Priority /></Guard>} />
          <Route path="/cases" element={<Guard perm="feedback.view"><Cases /></Guard>} />
          <Route path="/reports" element={<Guard perm="reports.view"><Reports /></Guard>} />
          <Route path="/integrations" element={<Guard perm="dashboard.view"><Integrations /></Guard>} />
          <Route path="/users" element={<Guard perm="users.manage"><UsersPage /></Guard>} />
          <Route path="/settings" element={<Guard perm="settings.manage"><SettingsPage /></Guard>} />
          <Route path="/audit" element={<Guard perm="audit.view"><Audit /></Guard>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return <AuthProvider><Intro /><HashRouter><Shell /></HashRouter></AuthProvider>;
}
