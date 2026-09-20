import DashboardLayout from "@/app/layouts/DashboardLayout";
import { useMyDashboard } from "@/features/dashboard/hooks/useDashboard";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { ProfileDetails } from "@/features/profile/components/ProfileDetails";
import { Mail } from "lucide-react";

export default function ProfilePage() {
  const query = useMyDashboard();
  const data = query.data;

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load your profile. Please try again." />
      ) : null}
      {data ? (
        <>
          <ProfileDetails
            profile={data.profile}
            supervisorName={data.supervisor?.name}
            isOwnProfile
          />
          <div className="mx-auto mt-5 max-w-6xl">
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/30">
              <div>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                  Need to update your information?
                </p>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                  If any of your details are incorrect, please contact the HR team.
                </p>
              </div>
              <a
                href="mailto:hr@altrium.local"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950"
              >
                <Mail className="h-4 w-4" />
                Contact HR
              </a>
            </div>
          </div>
        </>
      ) : null}
    </DashboardLayout>
  );
}
