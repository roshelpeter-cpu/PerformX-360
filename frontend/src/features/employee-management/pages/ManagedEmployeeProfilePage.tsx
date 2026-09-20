import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { useManagedProfile } from "@/features/employee-management/hooks/useEmployeeManagement";
import { ProfileDetails } from "@/features/profile/components/ProfileDetails";
import { getEmployeeManagementPathForRole } from "@/constants/roles";
import { useAuthStore } from "@/store/authStore";

export default function ManagedEmployeeProfilePage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const user = useAuthStore((state) => state.user);
  const query = useManagedProfile(employeeId);
  const backTo = user ? getEmployeeManagementPathForRole(user.role) : "/";

  return (
    <DashboardLayout>
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Employee Management
      </Link>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="You cannot view this profile, or it could not be loaded." />
      ) : null}
      {query.data ? (
        <ProfileDetails profile={query.data} isOwnProfile={false} />
      ) : null}
    </DashboardLayout>
  );
}
