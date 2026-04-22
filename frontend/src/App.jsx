import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import useAuthStore from "./hooks/useAuthStore";
import api from "./utils/api";

// Layout
import Header from "./components/Header";
import Footer from "./components/Footer";

// Pages — Attendee
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import MyTicketsPage from "./pages/MyTicketsPage";

// Pages — Organizer (no main header, own layout)
import OrganizerLandingPage from "./pages/organizer/OrganizerLandingPage";
import OrganizerOnboarding from "./pages/organizer/OrganizerOnboarding";
import OrganizerLayout from "./pages/organizer/OrganizerLayout";
import OrganizerDashboard from "./pages/organizer/OrganizerDashboard";
import OrganizerEvents from "./pages/organizer/OrganizerEvents";
import OrganizerOrders from "./pages/organizer/OrganizerOrders";
import OrganizerFinance from "./pages/organizer/OrganizerFinance";
import OrganizerSettings from "./pages/organizer/OrganizerSettings";
import OrganizerCreateEvent from "./pages/organizer/OrganizerCreateEvent";
import OrganizerPlaceholder from "./pages/organizer/OrganizerPlaceholder";
import OrganizerPromoCodes from "./pages/organizer/OrganizerPromoCodes";
import OrganizerEditEvent from "./pages/organizer/OrganizerEditEvent";

// Pages — Super Admin
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminUsers from "./pages/superadmin/SuperAdminUsers";
import SuperAdminEvents from "./pages/superadmin/SuperAdminEvents";
import SuperAdminSettings from "./pages/superadmin/SuperAdminSettings";

// ─── Auth Guards ───
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuthStore();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// Redirect to onboarding if organizer profile incomplete
function OrganizerRoute({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login?next=/organizer" replace />;

  // Non-admin users hitting /organizer get sent to onboarding
  if (user.role === "user") return <Navigate to="/organizer/onboarding" replace />;
  if (user.role !== "admin" && user.role !== "super_admin") return <Navigate to="/" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-bg">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-accent to-brand-gold mx-auto mb-4 animate-pulse flex items-center justify-center text-2xl">
          🎪
        </div>
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}

// ─── Page transition progress bar ───
function RouteProgressBar() {
  const location = useLocation();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    setWidth(0);
    // Jump to 70% fast, then wait
    const t1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setWidth(70));
    });
    // Complete after a short delay
    const t2 = setTimeout(() => {
      setWidth(100);
      setTimeout(() => setVisible(false), 200);
    }, 350);
    return () => { cancelAnimationFrame(t1); clearTimeout(t2); };
  }, [location.pathname + location.search]);

  if (!visible) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        className="h-full bg-brand-accent transition-all ease-out"
        style={{ width: `${width}%`, transitionDuration: width === 100 ? "200ms" : "350ms" }}
      />
    </div>
  );
}

// ─── Main layout (with header) ───
function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-brand-bg font-body flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => { init(); }, [init]);

  return (
    <>
      <RouteProgressBar />
      <Routes>

        {/* ── Public routes with main header ── */}
        <Route path="/" element={<MainLayout><HomePage /></MainLayout>} />
        <Route path="/events" element={<MainLayout><EventsPage /></MainLayout>} />
        <Route path="/events/:idOrSlug" element={<MainLayout><EventDetailPage /></MainLayout>} />
        <Route path="/login" element={<MainLayout><LoginPage /></MainLayout>} />
        <Route path="/register" element={<MainLayout><RegisterPage /></MainLayout>} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* ── Protected user routes ── */}
        <Route path="/checkout/:orderId" element={<ProtectedRoute><MainLayout><CheckoutPage /></MainLayout></ProtectedRoute>} />
        <Route path="/order/:orderId/success" element={<ProtectedRoute><MainLayout><OrderSuccessPage /></MainLayout></ProtectedRoute>} />
        <Route path="/my-tickets" element={<ProtectedRoute><MainLayout><MyTicketsPage /></MainLayout></ProtectedRoute>} />

        {/* ── Organizer routes (no main header) ── */}
        <Route path="/create-event" element={<OrganizerLandingPage />} />
        <Route path="/organizer/onboarding" element={
          <ProtectedRoute><OrganizerOnboarding /></ProtectedRoute>
        } />
        <Route path="/organizer" element={
          <OrganizerRoute>
            <OrganizerLayout />
          </OrganizerRoute>
        }>
          <Route index element={<OrganizerDashboard />} />
          <Route path="events" element={<OrganizerEvents />} />
          <Route path="events/new" element={<OrganizerCreateEvent />} />
          <Route path="events/:id/edit" element={<OrganizerEditEvent />} />
          <Route path="orders" element={<OrganizerOrders />} />
          <Route path="promo-codes" element={<OrganizerPromoCodes />} />
          <Route path="marketing" element={<OrganizerPlaceholder title="Marketing" description="Email campaigns, promo codes, and audience tools are coming soon." />} />
          <Route path="reporting" element={<OrganizerPlaceholder title="Reporting" description="Detailed sales reports, attendance analytics, and exports are coming soon." />} />
          <Route path="finance" element={<OrganizerFinance />} />
          <Route path="settings" element={<OrganizerSettings />} />
        </Route>

        {/* ── Super Admin routes ── */}
        <Route path="/super-admin" element={<ProtectedRoute roles={["super_admin"]}><MainLayout><SuperAdminDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/super-admin/users" element={<ProtectedRoute roles={["super_admin"]}><MainLayout><SuperAdminUsers /></MainLayout></ProtectedRoute>} />
        <Route path="/super-admin/events" element={<ProtectedRoute roles={["super_admin"]}><MainLayout><SuperAdminEvents /></MainLayout></ProtectedRoute>} />
        <Route path="/super-admin/settings" element={<ProtectedRoute roles={["super_admin"]}><MainLayout><SuperAdminSettings /></MainLayout></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#ffffff",
            color: "#1C1917",
            border: "1px solid #E7E5E4",
            borderRadius: "12px",
            fontSize: "14px",
          },
        }}
      />
    </>
  );
}
