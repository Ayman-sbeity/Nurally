import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  RedirectIfAuthenticated,
  RequireAuth,
  RequirePermission,
  ScrollToTop,
} from '@/components/RouteGuards';
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
const FaqPage = lazy(() => import('@/pages/public/FaqPage'));
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
const AdminInstagramPage = lazy(() => import('@/pages/admin/AdminInstagramPage'));
const AdminStaffPage = lazy(() => import('@/pages/admin/AdminStaffPage'));
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
            <Route path="faq" element={<FaqPage />} />
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
              <RequireAuth area="CLIENT">
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
              <RequireAuth area="ADMIN">
                <AdminLayout />
              </RequireAuth>
            }
          >
            {/* Each section re-states the permission that opens it, so a URL
                typed or bookmarked by an employee is checked the same way the
                sidebar is. The server checks it again on every request. */}
            <Route
              index
              element={
                <RequirePermission resource="DASHBOARD">
                  <AdminDashboardPage />
                </RequirePermission>
              }
            />
            <Route
              path="calendar"
              element={
                <RequirePermission resource="CALENDAR">
                  <AdminCalendarPage />
                </RequirePermission>
              }
            />
            <Route
              path="appointments"
              element={
                <RequirePermission resource="APPOINTMENTS">
                  <AdminAppointmentsPage />
                </RequirePermission>
              }
            />
            <Route
              path="appointments/:id"
              element={
                <RequirePermission resource="APPOINTMENTS">
                  <AdminAppointmentDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="clients"
              element={
                <RequirePermission resource="CLIENTS">
                  <AdminClientsPage />
                </RequirePermission>
              }
            />
            <Route
              path="clients/:id"
              element={
                <RequirePermission resource="CLIENTS">
                  <AdminClientDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="services"
              element={
                <RequirePermission resource="SERVICES">
                  <AdminServicesPage />
                </RequirePermission>
              }
            />
            <Route
              path="availability"
              element={
                <RequirePermission resource="AVAILABILITY">
                  <AdminAvailabilityPage />
                </RequirePermission>
              }
            />
            <Route
              path="gallery"
              element={
                <RequirePermission resource="GALLERY">
                  <AdminGalleryPage />
                </RequirePermission>
              }
            />
            <Route
              path="instagram"
              element={
                <RequirePermission resource="INSTAGRAM">
                  <AdminInstagramPage />
                </RequirePermission>
              }
            />
            {/* Owner-only, and not delegable: whoever can edit staff can grant
                themselves everything else. */}
            <Route path="staff" element={<AdminStaffPage />} />
            {/* Reachable by every employee — it is where they turn on their own
                notifications. The page itself hides the booking-engine panel. */}
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
