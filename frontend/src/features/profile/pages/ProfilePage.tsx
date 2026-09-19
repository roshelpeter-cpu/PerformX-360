import type { ReactNode } from "react";
import { Building2, Mail, Shield, UserRound, Users } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { useMyDashboard } from "@/features/dashboard/hooks/useDashboard";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import {
  getProfilePortraitUrl,
  PROFILE_BANNER_IMAGE,
} from "@/features/profile/portrait";
import { formatRoleLabel } from "@/constants/roles";
import { formatDate, formatDateTime } from "@/features/hr/utils/dates";

const NOT_PROVIDED = "Not provided";
const NOT_ASSIGNED = "Not assigned";

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
        <div className="mx-auto max-w-6xl space-y-5">
          <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_18px_50px_rgba(28,25,23,0.08)] dark:border-stone-800 dark:bg-stone-950">
            <div className="relative h-44 overflow-hidden sm:h-56">
              <img
                src={PROFILE_BANNER_IMAGE}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-stone-950/45 to-stone-950/20" />
              <div className="absolute left-6 top-8 max-w-lg text-white sm:left-8">
                <div className="mb-3 h-1 w-12 rounded-full bg-amber-400" />
                <h1 className="text-3xl font-semibold tracking-tight">Your Profile</h1>
                <p className="mt-2 text-sm text-stone-200">
                  Your journey, our shared success.
                </p>
              </div>
              <p className="absolute right-6 top-8 hidden text-right text-[11px] font-semibold uppercase leading-4 tracking-[0.22em] text-white sm:block">
                People
                <br />
                Technology
                <br />
                Progress
                <br />
                <span className="text-amber-300">Altrium</span>
              </p>
            </div>

            <div className="relative px-5 pb-6 sm:px-8">
              <div className="-mt-12 flex flex-col gap-5 rounded-3xl border border-stone-200 bg-[#fffaf0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-stone-800 dark:bg-amber-950/20">
                <div className="flex items-center gap-4">
                  <img
                    src={getProfilePortraitUrl(data.profile.employeeId)}
                    alt={data.profile.name}
                    className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md dark:border-stone-900"
                  />
                  <div>
                    <h2 className="text-2xl font-semibold text-stone-900 dark:text-white">
                      {data.profile.name}
                    </h2>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {data.profile.jobTitle ?? NOT_PROVIDED}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600 dark:text-stone-300">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {data.profile.department?.name ?? NOT_ASSIGNED}
                      </span>
                      <span className="text-stone-300">|</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {data.profile.team?.name ?? NOT_ASSIGNED}
                      </span>
                      <span className="text-stone-300">|</span>
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {formatRoleLabel(data.profile.role)}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="max-w-xs text-sm italic text-stone-500 sm:text-right">
                  “Continuous learning today, a greater tomorrow.”
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <ProfileCard
              icon={<UserRound className="h-4 w-4" />}
              title="Personal Information"
            >
              <InfoRow label="Full Name" value={data.profile.name} />
              <InfoRow label="Date of Birth" value={NOT_PROVIDED} />
              <InfoRow label="Gender" value={NOT_PROVIDED} />
              <InfoRow label="Nationality" value={NOT_PROVIDED} />
              <InfoRow label="Contact Number" value={NOT_PROVIDED} />
              <InfoRow label="Work Email" value={data.profile.companyEmail} />
            </ProfileCard>

            <ProfileCard
              icon={<Building2 className="h-4 w-4" />}
              title="Employment Information"
            >
              <InfoRow label="Employee ID" value={data.profile.employeeId} />
              <InfoRow
                label="Job Title"
                value={data.profile.jobTitle ?? NOT_PROVIDED}
              />
              <InfoRow
                label="Department"
                value={data.profile.department?.name ?? NOT_ASSIGNED}
              />
              <InfoRow
                label="Team"
                value={data.profile.team?.name ?? NOT_ASSIGNED}
              />
              <InfoRow
                label="Supervisor"
                value={
                  data.supervisor
                    ? data.supervisor.name
                    : data.profile.team?.supervisor?.name ?? NOT_ASSIGNED
                }
              />
              <InfoRow label="Employment Type" value={NOT_PROVIDED} />
              <InfoRow
                label="Date Joined"
                value={
                  data.profile.createdAt
                    ? formatDate(data.profile.createdAt)
                    : NOT_PROVIDED
                }
              />
              <InfoRow label="Work Location" value={NOT_PROVIDED} />
            </ProfileCard>

            <ProfileCard
              icon={<Mail className="h-4 w-4" />}
              title="Emergency Contact"
            >
              <InfoRow label="Contact Name" value={NOT_PROVIDED} />
              <InfoRow label="Relationship" value={NOT_PROVIDED} />
              <InfoRow label="Contact Number" value={NOT_PROVIDED} />
            </ProfileCard>

            <ProfileCard
              icon={<Shield className="h-4 w-4" />}
              title="Account Information"
            >
              <div className="grid grid-cols-[140px_1fr] items-start gap-3 text-sm sm:grid-cols-[160px_1fr]">
                <dt className="text-stone-500">Account Status</dt>
                <dd className="inline-flex items-center gap-2 font-medium text-stone-900 dark:text-stone-100">
                  <span
                    className={
                      data.profile.accountStatus === "Locked"
                        ? "h-2 w-2 rounded-full bg-red-500"
                        : "h-2 w-2 rounded-full bg-emerald-500"
                    }
                  />
                  {data.profile.accountStatus ?? "Active"}
                </dd>
              </div>
              <InfoRow
                label="User Role"
                value={formatRoleLabel(data.profile.role)}
              />
              <InfoRow
                label="Last Login"
                value={
                  data.profile.lastLoginAt
                    ? formatDateTime(data.profile.lastLoginAt)
                    : NOT_PROVIDED
                }
              />
            </ProfileCard>
          </div>

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
      ) : null}
    </DashboardLayout>
  );
}

function ProfileCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-white">
        <span className="text-stone-500">{icon}</span>
        {title}
      </h3>
      <dl className="space-y-3">{children}</dl>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3 text-sm sm:grid-cols-[160px_1fr]">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900 dark:text-stone-100">{value}</dd>
    </div>
  );
}
