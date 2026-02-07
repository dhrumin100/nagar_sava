import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthProvider";
import { I18nProvider } from "@/lib/i18n";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy load pages for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const SignIn = lazy(() => import("./pages/SignIn"));
const MainApp = lazy(() => import("./pages/MainApp"));
const MyReports = lazy(() => import("./pages/MyReports"));
const MyFeedback = lazy(() => import("./pages/MyFeedback"));
const GovSignIn = lazy(() => import("./pages/GovSignIn"));
const GovernmentDashboard = lazy(() => import("./pages/GovernmentDashboard"));
const DeptSignIn = lazy(() => import("./pages/DeptSignIn"));
const DeptDashboard = lazy(() => import("./pages/DeptDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Notifications = lazy(() => import("./pages/Notifications"));
const VerifyCertificate = lazy(() => import("./pages/VerifyCertificate"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Loading component for suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Landing Page - Public */}
                <Route path="/" element={<Landing />} />

                {/* Sign In Page - Public */}
                <Route path="/signin" element={<SignIn />} />

                {/* Main Application - Protected */}
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <MainApp />
                    </ProtectedRoute>
                  }
                />
                {/* My Reports - Protected */}
                <Route
                  path="/my-reports"
                  element={
                    <ProtectedRoute>
                      <MyReports />
                    </ProtectedRoute>
                  }
                />
                {/* My Feedback - Protected */}
                <Route
                  path="/my-feedback"
                  element={
                    <ProtectedRoute>
                      <MyFeedback />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                {/* Notifications - Protected */}
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                {/* Government Sign In (Public for demo) */}
                <Route path="/gov-signin" element={<GovSignIn />} />
                {/* Government Dashboard (Public for demo) */}
                <Route path="/gov" element={<GovernmentDashboard />} />

                {/* Department Routes */}
                <Route path="/dept-signin" element={<DeptSignIn />} />
                <Route path="/dept-dashboard" element={<DeptDashboard />} />

                {/* Verification Route - Public */}
                <Route path="/verify-certificate/:token" element={<VerifyCertificate />} />

                {/* Legacy route redirect for backward compatibility */}
                <Route path="/index" element={<MainApp />} />

                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
