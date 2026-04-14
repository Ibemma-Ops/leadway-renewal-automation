import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";

import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout       from "./components/layout/Layout";

import LoginPage     from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RenewalsPage  from "./pages/RenewalsPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import UploadPage    from "./pages/UploadPage";
import AuditPage     from "./pages/AuditPage";
import UsersPage     from "./pages/UsersPage";

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/"          element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/renewals"  element={<PrivateRoute><RenewalsPage /></PrivateRoute>} />
      <Route path="/approvals" element={<PrivateRoute><ApprovalsPage /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
      <Route path="/upload"    element={<PrivateRoute><UploadPage /></PrivateRoute>} />
      <Route path="/audit"     element={<PrivateRoute><AuditPage /></PrivateRoute>} />
      <Route path="/users"     element={<PrivateRoute roles={["ADMIN"]}><UsersPage /></PrivateRoute>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4500,
            style: { fontSize:"13px", borderRadius:"10px", fontFamily:"Inter, sans-serif" },
            success: { style: { background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#166534" } },
            error:   { style: { background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b" } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
