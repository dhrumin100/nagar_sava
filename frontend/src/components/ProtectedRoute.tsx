import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // Fallback to legacy validation if Supabase not configured (user might be null but localStorage has data in mock mode)
  // But our AuthProvider handles fallback for signOut. 
  // Ideally, if Supabase is OFF, we should rely on localStorage manually here or make AuthProvider handle it.
  // The AuthProvider current fallback for user/session is null if no Supabase. 
  // So we should check if local legacy token exists if user is null, to support the "mock mode" mentioned in plan.

  const legacyAuth = localStorage.getItem("nagarSevaAuth");
  const isAuthenticated = user || legacyAuth === "true";

  // Redirect to sign-in if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  // Role-based redirection to prevent Department/Admin users from viewing Citizen pages
  if (user) {
    // Check if user is trying to access citizen areas but has wrong role
    // Using user_metadata or role property if available. 
    // In our mock, user object has 'role'. In Supabase, it might be separate, but let's assume unified User interface wrapper or property.
    const role = (user as any).role || 'citizen'; // Default to citizen if undefined

    if (role === 'department') {
      return <Navigate to="/dept-dashboard" replace />;
    }
    if (role === 'admin' || role === 'authority') {
      return <Navigate to="/gov" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
