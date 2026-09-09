import { Navigate, useLocation } from "react-router-dom";
import type { UserRole } from "@/features/auth/types";
import { getDashboardPathForRole } from "@/constants/roles";
import { useAuthStore } from "@/store/authStore";
import { useReportUnauthorizedAccess } from "@/features/auth/hooks/useAuth";
import { useEffect, useRef, type ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const reportUnauthorized = useReportUnauthorizedAccess();
  const hasReportedRef = useRef(false);

  const isAuthorized = user ? allowedRoles.includes(user.role) : false;

  useEffect(() => {
    if (!user || user.mustChangePassword || isAuthorized || hasReportedRef.current) {
      return;
    }

    hasReportedRef.current = true;
    reportUnauthorized.mutate(location.pathname);
  }, [user, isAuthorized, location.pathname, reportUnauthorized]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Checking your session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/set-password" replace />;
  }

  // Check the user's role before allowing access to this protected route.
  // The backend remains the final authority for authorization.
  if (!isAuthorized) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
