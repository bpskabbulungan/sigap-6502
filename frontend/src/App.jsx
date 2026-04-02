import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Home, RefreshCcw } from "lucide-react";

import { AppErrorPage } from "./components/error/AppErrorPage.jsx";
import { ConfirmProvider } from "./components/ui/ConfirmProvider.jsx";
import { Spinner } from "./components/ui/Spinner.jsx";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
import { useSession } from "./queries/auth.js";
import { resolveSafeAdminRedirect } from "./lib/authRedirect.js";

const PublicStatusPage = lazy(() => import("./pages/PublicStatusPage.jsx"));
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage.jsx"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage.jsx"));
const AdminSchedulePage = lazy(() => import("./pages/AdminSchedulePage.jsx"));
const AdminTemplatesPage = lazy(() => import("./pages/AdminTemplatesPage.jsx"));
const AdminQuotesPage = lazy(() => import("./pages/AdminQuotesPage.jsx"));
const AdminHolidaysPage = lazy(() => import("./pages/AdminHolidaysPage.jsx"));
const AdminOverridesPage = lazy(() => import("./pages/AdminOverridesPage.jsx"));
const AdminContactsPage = lazy(() => import("./pages/AdminContactsPage.jsx"));
const ServerErrorPage = lazy(() => import("./pages/ServerErrorPage.jsx"));
const ServiceUnavailablePage = lazy(() => import("./pages/ServiceUnavailablePage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

function isUnauthorizedError(error) {
  return (
    !!error &&
    (error.status === 401 ||
      error.status === 403 ||
      /401|403|unauthorized|forbidden/i.test(error.message ?? ""))
  );
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { data, error, isLoading } = useSession();
  const isUnauthorized = isUnauthorizedError(error);
  const requestedPath = `${location.pathname}${location.search}${location.hash}`;
  const safeRequestedPath = resolveSafeAdminRedirect(requestedPath);
  const loginPath = `/admin/login?redirect=${encodeURIComponent(safeRequestedPath)}`;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isUnauthorized || (!error && !data?.authenticated)) {
    return <Navigate to={loginPath} replace />;
  }

  if (error && !isUnauthorized) {
    const status = Number(error?.status) === 503 ? 503 : 500;

    return (
      <AppErrorPage
        status={status}
        title={
          status === 503
            ? "Layanan admin sedang tidak tersedia"
            : "Terjadi gangguan saat memuat admin"
        }
        description={
          status === 503
            ? "Sistem admin sedang maintenance atau sinkronisasi. Silakan coba lagi nanti."
            : "Permintaan belum dapat diproses. Silakan muat ulang halaman."
        }
        actions={[
          {
            label: "Muat ulang",
            variant: "primary",
            icon: RefreshCcw,
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            },
          },
          {
            label: "Ke beranda",
            variant: "secondary",
            icon: Home,
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.assign("/");
              }
            },
          },
        ]}
        showFooter={false}
      />
    );
  }

  return children;
}

function GuestRoute({ children }) {
  const location = useLocation();
  const { data, error, isLoading } = useSession();
  const isUnauthorized = isUnauthorizedError(error);
  const redirectTarget = resolveSafeAdminRedirect(
    new URLSearchParams(location.search).get("redirect")
  );

  if (data?.authenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  if (isLoading && !isUnauthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !isUnauthorized) {
    const status = Number(error?.status) === 503 ? 503 : 500;

    return (
      <AppErrorPage
        status={status}
        title={
          status === 503
            ? "Layanan login sedang tidak tersedia"
            : "Terjadi gangguan saat memuat login"
        }
        description={
          status === 503
            ? "Sistem autentikasi sedang maintenance atau sinkronisasi. Silakan coba lagi nanti."
            : "Permintaan login belum dapat diproses. Silakan muat ulang halaman."
        }
        actions={[
          {
            label: "Muat ulang",
            variant: "primary",
            icon: RefreshCcw,
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            },
          },
          {
            label: "Ke beranda",
            variant: "secondary",
            icon: Home,
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.assign("/");
              }
            },
          },
        ]}
        showFooter={false}
      />
    );
  }

  return children;
}

function AppSuspenseFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">Memuat halaman...</p>
    </div>
  );
}

export default function App() {
  return (
    <ConfirmProvider>
      <ToastProvider>
        <Suspense fallback={<AppSuspenseFallback />}>
          <Routes>
            <Route path="/" element={<PublicStatusPage />} />
            <Route
              path="/admin/login"
              element={
                <GuestRoute>
                  <AdminLoginPage />
                </GuestRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/schedule"
              element={
                <ProtectedRoute>
                  <AdminSchedulePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/templates"
              element={
                <ProtectedRoute>
                  <AdminTemplatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/quotes"
              element={
                <ProtectedRoute>
                  <AdminQuotesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/contacts"
              element={
                <ProtectedRoute>
                  <AdminContactsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/announcements"
              element={
                <ProtectedRoute>
                  <AdminOverridesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/overrides"
              element={
                <ProtectedRoute>
                  <Navigate to="/admin/announcements" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/holidays"
              element={
                <ProtectedRoute>
                  <AdminHolidaysPage />
                </ProtectedRoute>
              }
            />
            <Route path="/error/500" element={<ServerErrorPage />} />
            <Route path="/error/503" element={<ServiceUnavailablePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </ConfirmProvider>
  );
}
