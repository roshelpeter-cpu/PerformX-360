import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthBootstrap from "@/features/auth/components/AuthBootstrap";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import GuestRoute from "@/features/auth/components/GuestRoute";
import PasswordChangeRoute from "@/features/auth/components/PasswordChangeRoute";
import LoginPage from "@/features/auth/pages/LoginPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import SetPasswordPage from "@/features/auth/pages/SetPasswordPage";
import EmployeeDashboardPage from "@/features/dashboard/pages/EmployeeDashboardPage";
import MyAppraisalCyclePage from "@/features/dashboard/pages/MyAppraisalCyclePage";
import SupervisorDashboardPage from "@/features/dashboard/pages/SupervisorDashboardPage";
import HrDashboardPage from "@/features/dashboard/pages/HrDashboardPage";
import LeadershipDashboardPage from "@/features/dashboard/pages/LeadershipDashboardPage";
import ProfilePage from "@/features/profile/pages/ProfilePage";
import AppraisalCyclesPage from "@/features/hr/pages/AppraisalCyclesPage";
import AppraisalCycleDetailPage from "@/features/hr/pages/AppraisalCycleDetailPage";
import { useAuthStore } from "@/store/authStore";
import { getDashboardPathForRole, HR_STAFF_ROLES } from "@/constants/roles";

function RootRedirect() {
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (!isInitialized) {
    return null;
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/set-password" replace />;
  }

  if (user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return <Navigate to="/login" replace />;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <AuthBootstrap>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route
            path="/set-password"
            element={
              <PasswordChangeRoute>
                <SetPasswordPage />
              </PasswordChangeRoute>
            }
          />

          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <EmployeeDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/profile"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/appraisal-cycle"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <MyAppraisalCyclePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/dashboard"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <SupervisorDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/profile"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/appraisal-cycle"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <MyAppraisalCyclePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/dashboard"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <HrDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/profile"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/appraisal-cycles"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <AppraisalCyclesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/appraisal-cycles/:cycleId"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <AppraisalCycleDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leadership/dashboard"
            element={
              <ProtectedRoute allowedRoles={["LEADERSHIP"]}>
                <LeadershipDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  );
}

export default AppRouter;
