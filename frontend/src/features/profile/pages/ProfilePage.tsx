import { useState } from "react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { useMyDashboard } from "@/features/dashboard/hooks/useDashboard";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { ProfileDetails } from "@/features/profile/components/ProfileDetails";
import { ContactHrDialog } from "@/features/profile/components/ContactHrDialog";
import { useProfileRequestInbox } from "@/features/profile/hooks/useProfileRequests";
import { REQUEST_TYPE_LABELS } from "@/features/profile/services/profile-requests.api";
import { useAuthStore } from "@/store/authStore";
import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { getNotificationsPathForRole } from "@/constants/roles";
import { formatShortDate } from "@/features/hr/utils/dates";

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const query = useMyDashboard();
  const requestsQuery = useProfileRequestInbox();
  const data = query.data;
  const [contactOpen, setContactOpen] = useState(false);

  const role = user?.role;
  const showContact = role === "EMPLOYEE" || role === "SUPERVISOR" || role === "HR";
  const contactLabel = role === "HR" ? "Contact HR Manager" : "Contact HR";
  const myRequests = (requestsQuery.data ?? []).slice(0, 5);

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
          {showContact ? (
            <div className="mx-auto mt-5 max-w-6xl">
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/30">
                <div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                    Need to update your information?
                  </p>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                    Submit a profile change request in the app. It is routed to the
                    responsible {role === "HR" ? "HR Manager" : "HR"} for your team.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950"
                >
                  <Mail className="h-4 w-4" />
                  {contactLabel}
                </button>
              </div>

              {myRequests.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Your recent requests</p>
                    {user ? (
                      <Link
                        to={getNotificationsPathForRole(user.role)}
                        className="text-xs text-amber-700 hover:underline"
                      >
                        View all
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    {myRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2 text-sm dark:bg-stone-900"
                      >
                        <div>
                          <p className="font-medium">
                            {REQUEST_TYPE_LABELS[request.requestType]}
                          </p>
                          <p className="text-xs text-stone-500">
                            {request.summary} · {formatShortDate(request.createdAt)}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-stone-600">
                          {request.status === "PENDING"
                            ? "Pending"
                            : request.status === "APPROVED"
                              ? "Approved"
                              : "Rejected"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <ContactHrDialog
            open={contactOpen}
            onClose={() => setContactOpen(false)}
            title={contactLabel}
            profile={data.profile}
          />
        </>
      ) : null}
    </DashboardLayout>
  );
}
