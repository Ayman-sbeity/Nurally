import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RedirectIfAuthenticated, RequireAuth, ScrollToTop } from '@/components/RouteGuards';
import { LoadingState } from '@/components/ui/States';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ClientLayout } from '@/layouts/ClientLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { LandingPage } from '@/pages/public/LandingPage';

// The landing page is eager (it is the first paint for most visitors); every
// other route is code-split so the marketing site never downloads the admin
// dashboard.
const ServicesPage = lazy(() => import('@/pages/public/ServicesPage'));
const ServiceDetailPage = lazy(() => import('@/pages/public/ServiceDetailPage'));
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const GalleryPage = lazy(() => import('@/pages/public/GalleryPage'));
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'));

const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/public/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/public/ResetPasswordPage'));

const ClientHomePage = lazy(() => import('@/pages/client/ClientHomePage'));
const BookingPage = lazy(() => import('@/pages/client/BookingPage'));
const ClientAppointmentsPage = lazy(() => import('@/pages/client/ClientAppointmentsPage'));
const ClientAppointmentDetailPage = lazy(() => import('@/pages/client/ClientAppointmentDetailPage'));
const ClientProfilePage = lazy(() => import('@/pages/client/ClientProfilePage'));
const ClientNotificationsPage = lazy(() => import('@/pages/client/ClientNotificationsPage'));

const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminCalendarPage = lazy(() => import('@/pages/admin/AdminCalendarPage'));
const AdminAppointmentsPage = lazy(() => import('@/pages/admin/AdminAppointmentsPage'));
const AdminAppointmentDetailPage = lazy(() => import('@/pages/admin/AdminAppointmentDetailPage'));
const AdminClientsPage = lazy(() => import('@/pages/admin/AdminClientsPage'));
const AdminClientDetailPage = lazy(() => import('@/pages/admin/AdminClientDetailPage'));
const AdminServicesPage = lazy(() => import('@/pages/admin/AdminServicesPage'));
const AdminAvailabilityPage = lazy(() => import('@/pages/admin/AdminAvailabilityPage'));
const AdminGalleryPage = lazy(() => import('@/pages/admin/AdminGalleryPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));

function RouteFallback() {
  return (
    <div style={{ minHeight: '50dvh', display: 'grid', placeItems: 'center' }}>
      <LoadingState />
    </div>
  );
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* --- Public marketing site --- */}
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="services/:slug" element={<ServiceDetailPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="gallery" element={<GalleryPage />} />
          </Route>

          {/* --- Authentication --- */}
          <Route element={<AuthLayout />}>
            <Route
              path="login"
              element={
                <RedirectIfAuthenticated>
                  <LoginPage />
                </RedirectIfAuthenticated>
              }
            />
            <Route
              path="register"
              element={
                <RedirectIfAuthenticated>
                  <RegisterPage />
                </RedirectIfAuthenticated>
              }
            />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* `/booking` is the landing page's CTA target; the guard sends
              visitors through sign-in first when they are not authenticated. */}
          <Route path="booking" element={<Navigate to="/app/book" replace />} />

          {/* --- Client PWA --- */}
          <Route
            path="app"
            element={
              <RequireAuth role="CLIENT">
                <ClientLayout />
              </RequireAuth>
            }
          >
            <Route index element={<ClientHomePage />} />
            <Route path="book" element={<BookingPage />} />
            <Route path="appointments" element={<ClientAppointmentsPage />} />
            <Route path="appointments/:id" element={<ClientAppointmentDetailPage />} />
            <Route path="profile" element={<ClientProfilePage />} />
            <Route path="notifications" element={<ClientNotificationsPage />} />
          </Route>

          {/* --- Admin dashboard --- */}
          <Route
            path="admin"
            element={
              <RequireAuth role="ADMIN">
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="calendar" element={<AdminCalendarPage />} />
            <Route path="appointments" element={<AdminAppointmentsPage />} />
            <Route path="appointments/:id" element={<AdminAppointmentDetailPage />} />
            <Route path="clients" element={<AdminClientsPage />} />
            <Route path="clients/:id" element={<AdminClientDetailPage />} />
            <Route path="services" element={<AdminServicesPage />} />
            <Route path="availability" element={<AdminAvailabilityPage />} />
            <Route path="gallery" element={<AdminGalleryPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
