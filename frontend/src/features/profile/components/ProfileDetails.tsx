import type { ReactNode } from "react";
import { Building2, Mail, Shield, UserRound, Users } from "lucide-react";
import { formatRoleLabel } from "@/constants/roles";
import {
  getProfilePortraitUrl,
  PROFILE_BANNER_IMAGE,
} from "@/features/profile/portrait";
import { formatDate, formatDateTime } from "@/features/hr/utils/dates";
import type {
  DashboardPersonRef,
  DashboardProfile,
} from "@/features/dashboard/services/dashboard.api";

const NOT_ASSIGNED = "Not assigned";

type ProfileData = DashboardProfile & {
  supervisor?: DashboardPersonRef | null;
};

export function ProfileDetails({
  profile,
  supervisorName,
  isOwnProfile,
}: {
  profile: ProfileData;
  supervisorName?: string | null;
  isOwnProfile?: boolean;
}) {
  const resolvedSupervisor =
    supervisorName ??
    profile.supervisor?.name ??
    profile.team?.supervisor?.name ??
    NOT_ASSIGNED;
  const assignedTeams =
    profile.assignedTeams && profile.assignedTeams.length > 0
      ? profile.assignedTeams.map((team) => team.name).join(", ")
      : null;

  return (
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
            <h1 className="text-3xl font-semibold tracking-tight">
              {isOwnProfile ? "Your Profile" : "Employee Profile"}
            </h1>
            <p className="mt-2 text-sm text-stone-200">
              {isOwnProfile
                ? "Your journey, our shared success."
                : `${profile.name} · ${profile.employeeId}`}
            </p>
          </div>
        </div>

        <div className="relative px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-5 rounded-3xl border border-stone-200 bg-[#fffaf0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-stone-800 dark:bg-amber-950/20">
            <div className="flex items-center gap-4">
              <img
                src={profile.avatarUrl ?? getProfilePortraitUrl(profile.employeeId)}
                alt={profile.name}
                className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md dark:border-stone-900"
              />
              <div>
                <h2 className="text-2xl font-semibold text-stone-900 dark:text-white">
                  {profile.name}
                </h2>
                <p className="mt-0.5 text-sm text-stone-500">{profile.jobTitle}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600 dark:text-stone-300">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {profile.department?.name ?? NOT_ASSIGNED}
                  </span>
                  <span className="text-stone-300">|</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {profile.team?.name ?? assignedTeams ?? NOT_ASSIGNED}
                  </span>
                  <span className="text-stone-300">|</span>
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-3.5 w-3.5" />
                    {formatRoleLabel(profile.role)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileCard icon={<UserRound className="h-4 w-4" />} title="Personal Information">
          <InfoRow label="Full Name" value={profile.name} />
          <InfoRow
            label="Date of Birth"
            value={profile.dateOfBirth ? formatDate(profile.dateOfBirth) : ""}
          />
          <InfoRow label="Gender" value={profile.gender ?? ""} />
          <InfoRow label="Nationality" value={profile.nationality ?? ""} />
          <InfoRow label="Contact Number" value={profile.contactNumber ?? ""} />
          <InfoRow label="Work Email" value={profile.companyEmail} />
        </ProfileCard>

        <ProfileCard icon={<Building2 className="h-4 w-4" />} title="Employment Information">
          <InfoRow label="Employee ID" value={profile.employeeId} />
          <InfoRow label="Job Title" value={profile.jobTitle ?? ""} />
          <InfoRow label="Department" value={profile.department?.name ?? NOT_ASSIGNED} />
          <InfoRow
            label="Team"
            value={profile.team?.name ?? assignedTeams ?? NOT_ASSIGNED}
          />
          <InfoRow label="Supervisor" value={resolvedSupervisor} />
          {profile.hrResponsible ? (
            <InfoRow label="HR Responsible" value={profile.hrResponsible.name} />
          ) : null}
          <InfoRow label="Employment Type" value={profile.employmentType ?? "Permanent"} />
          <InfoRow
            label="Date Joined"
            value={
              profile.dateJoined
                ? formatDate(profile.dateJoined)
                : profile.createdAt
                  ? formatDate(profile.createdAt)
                  : ""
            }
          />
          <InfoRow label="Work Location" value={profile.workLocation ?? ""} />
        </ProfileCard>

        <ProfileCard icon={<Mail className="h-4 w-4" />} title="Emergency Contact">
          <InfoRow label="Contact Name" value={profile.emergencyContactName ?? ""} />
          <InfoRow
            label="Relationship"
            value={profile.emergencyContactRelationship ?? ""}
          />
          <InfoRow
            label="Contact Number"
            value={profile.emergencyContactNumber ?? ""}
          />
        </ProfileCard>

        <ProfileCard icon={<Shield className="h-4 w-4" />} title="Account Information">
          <div className="grid grid-cols-[140px_1fr] items-start gap-3 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-stone-500">Account Status</dt>
            <dd className="inline-flex items-center gap-2 font-medium text-stone-900 dark:text-stone-100">
              <span
                className={
                  profile.accountStatus === "Locked"
                    ? "h-2 w-2 rounded-full bg-red-500"
                    : "h-2 w-2 rounded-full bg-emerald-500"
                }
              />
              {profile.accountStatus ?? "Active"}
            </dd>
          </div>
          <InfoRow label="User Role" value={formatRoleLabel(profile.role)} />
          <InfoRow
            label="Last Login"
            value={
              profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : ""
            }
          />
        </ProfileCard>
      </div>
    </div>
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
