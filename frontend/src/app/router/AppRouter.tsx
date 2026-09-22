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
import NotificationsPage from "@/features/notifications/pages/NotificationsPage";
import AppraisalCyclesPage from "@/features/hr/pages/AppraisalCyclesPage";
import AppraisalCycleDetailPage from "@/features/hr/pages/AppraisalCycleDetailPage";
import SupervisorMyTeamPage from "@/features/employee-management/pages/SupervisorMyTeamPage";
import OrgHierarchyPage from "@/features/employee-management/pages/OrgHierarchyPage";
import ManagedEmployeeProfilePage from "@/features/employee-management/pages/ManagedEmployeeProfilePage";
import WorkspacePlaceholderRoute from "@/features/dashboard/pages/WorkspacePlaceholderRoute";
import { useAuthStore } from "@/store/authStore";
import { getDashboardPathForRole, HR_STAFF_ROLES } from "@/constants/roles";
import ProfilePage from "@/features/profile/pages/ProfilePage";
import PerformancePlanningPage from "@/features/meetings/pages/PerformancePlanningPage";
import MeetingPlaceholderPage from "@/features/meetings/pages/MeetingPlaceholderPage";
import FollowUpMeetingsPage from "@/features/meetings/pages/FollowUpMeetingsPage";
import TeamPdpsPage from "@/features/pdp/pages/TeamPdpsPage";
import PdpDetailPage from "@/features/pdp/pages/PdpDetailPage";
import MyPdpPage from "@/features/pdp/pages/MyPdpPage";

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
            path="/employee/notifications"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <NotificationsPage />
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
            path="/employee/meetings"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <Navigate to="/employee/meetings/performance-planning" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/meetings/performance-planning"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <PerformancePlanningPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/meetings/follow-up"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <FollowUpMeetingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/meetings/other"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <MeetingPlaceholderPage
                  title="Other Meetings"
                  description="Other meeting types will be available later."
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/pdp"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                <MyPdpPage />
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
            path="/supervisor/notifications"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <NotificationsPage />
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
            path="/supervisor/employee-management"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <SupervisorMyTeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/employee-management/:employeeId"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <ManagedEmployeeProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/meetings"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <Navigate to="/supervisor/meetings/performance-planning" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/meetings/performance-planning"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <PerformancePlanningPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/meetings/follow-up"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <FollowUpMeetingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/meetings/other"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <MeetingPlaceholderPage
                  title="Other Meetings"
                  description="Other meeting types will be available later."
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/pdp"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <TeamPdpsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/pdp/:pdpId"
            element={
              <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
                <PdpDetailPage />
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
            path="/hr/notifications"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <NotificationsPage />
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
            path="/hr/employee-management"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <OrgHierarchyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/employee-management/:employeeId"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <ManagedEmployeeProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/meetings"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <Navigate to="/hr/meetings/performance-planning" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/meetings/performance-planning"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <PerformancePlanningPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/meetings/follow-up"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <FollowUpMeetingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/meetings/other"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <MeetingPlaceholderPage
                  title="Other Meetings"
                  description="Other meeting types will be available later."
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/pdp"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <TeamPdpsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/pdp/:pdpId"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <PdpDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/employees"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <Navigate to="/hr/employee-management" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/hr-groups"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <WorkspacePlaceholderRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/reports"
            element={
              <ProtectedRoute allowedRoles={HR_STAFF_ROLES}>
                <WorkspacePlaceholderRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/meetings"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE", "SUPERVISOR", "HR", "HR_MANAGER"]}>
                <WorkspacePlaceholderRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/learning"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE", "SUPERVISOR", "HR", "HR_MANAGER"]}>
                <WorkspacePlaceholderRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/settings"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE", "SUPERVISOR", "HR", "HR_MANAGER"]}>
                <WorkspacePlaceholderRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/help"
            element={
              <ProtectedRoute allowedRoles={["EMPLOYEE", "SUPERVISOR", "HR", "HR_MANAGER"]}>
                <WorkspacePlaceholderRoute />
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
