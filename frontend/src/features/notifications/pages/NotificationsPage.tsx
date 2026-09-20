import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  Download,
  FileText,
  Search,
  Settings,
} from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/authStore";
import {
  useMarkAllNotificationsRead,
  useMyNotifications,
} from "@/features/auth/hooks/useAuth";
import { isHrStaffRole } from "@/constants/roles";
import { getProfilePortraitUrl } from "@/features/profile/portrait";
import {
  useProfileRequestInbox,
  useReviewProfileChangeRequest,
} from "@/features/profile/hooks/useProfileRequests";
import {
  profileRequestsApi,
  REQUEST_TYPE_LABELS,
  type ProfileChangeRequest,
} from "@/features/profile/services/profile-requests.api";
import { formatDateTime, formatShortDate } from "@/features/hr/utils/dates";
import { cn } from "@/lib/utils";

type TabId =
  | "all"
  | "profile"
  | "meetings"
  | "pdp"
  | "reviews"
  | "system"
  | "employee";

function requestTypeTitle(request: ProfileChangeRequest) {
  if (request.summary.trim()) return request.summary.trim();
  return `${REQUEST_TYPE_LABELS[request.requestType]} Update`;
}

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}

function statusLabel(status: string) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Pending";
}

function formatBytes(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(mime: string | null, name: string | null) {
  if (mime?.includes("pdf")) return "PDF";
  if (mime?.includes("png")) return "PNG";
  if (mime?.includes("jpeg") || mime?.includes("jpg")) return "JPG";
  if (mime?.includes("webp")) return "WEBP";
  const ext = name?.split(".").pop();
  return ext ? ext.toUpperCase() : "FILE";
}

function changeFieldLabel(request: ProfileChangeRequest) {
  return REQUEST_TYPE_LABELS[request.requestType] ?? request.requestType;
}

function tabForNotification(type: string): TabId {
  if (type === "PROFILE_CHANGE_REQUEST") return "profile";
  if (type.includes("MEETING") || type.includes("FOLLOW_UP")) return "meetings";
  if (type.includes("PDP")) return "pdp";
  if (type.includes("REVIEW") || type === "SELF_REVIEW_STARTED") return "reviews";
  if (type.includes("PASSWORD") || type.includes("SECURITY") || type.includes("BATCH")) {
    return "system";
  }
  return "employee";
}

export default function NotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const canReview = Boolean(user && isHrStaffRole(user.role));
  const notificationsQuery = useMyNotifications(Boolean(user));
  const requestsQuery = useProfileRequestInbox();
  const markAll = useMarkAllNotificationsRead();
  const review = useReviewProfileChangeRequest();
  const [tab, setTab] = useState<TabId>(canReview ? "profile" : "all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [sort, setSort] = useState("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const notifications = notificationsQuery.data?.notifications ?? [];
  const requests = requestsQuery.data ?? [];
  const pendingCount = requests.filter((item) => item.status === "PENDING").length;

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "all", label: "All", count: notifications.length + requests.length },
    { id: "profile", label: "Profile Change Requests", count: pendingCount },
    {
      id: "meetings",
      label: "Meetings",
      count: notifications.filter((item) => tabForNotification(item.type) === "meetings")
        .length,
    },
    {
      id: "pdp",
      label: "PDP",
      count: notifications.filter((item) => tabForNotification(item.type) === "pdp").length,
    },
    {
      id: "reviews",
      label: "Reviews",
      count: notifications.filter((item) => tabForNotification(item.type) === "reviews")
        .length,
    },
    {
      id: "system",
      label: "System",
      count: notifications.filter((item) => tabForNotification(item.type) === "system")
        .length,
    },
    {
      id: "employee",
      label: "Employee",
      count: notifications.filter((item) => tabForNotification(item.type) === "employee")
        .length,
    },
  ];

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = requests.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!query) return true;
      return (
        item.requester.name.toLowerCase().includes(query) ||
        item.requester.employeeId.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        REQUEST_TYPE_LABELS[item.requestType].toLowerCase().includes(query)
      );
    });
    rows = [...rows].sort((a, b) => {
      const delta =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "oldest" ? delta : -delta;
    });
    return rows;
  }, [requests, search, statusFilter, sort]);

  const selected =
    filteredRequests.find((item) => item.id === selectedId) ?? filteredRequests[0] ?? null;

  const otherNotifications = notifications.filter((item) => {
    if (tab === "all") return true;
    if (tab === "profile") return false;
    return tabForNotification(item.type) === tab;
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Stay updated with important activities across the organization.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <Check className="h-4 w-4" />
              Mark all as read
            </Button>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
              Notification Settings
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                tab === item.id
                  ? "bg-amber-100 text-amber-900"
                  : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-stone-950 dark:text-stone-300 dark:ring-stone-800"
              )}
            >
              {item.label}
              {item.count ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    tab === item.id ? "bg-white text-amber-800" : "bg-stone-100 text-stone-500"
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "profile" || tab === "all" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, ID or change type..."
                    className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm dark:border-stone-700 dark:bg-stone-950"
                  />
                </div>
                <select
                  className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-950"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="ALL">All statuses</option>
                </select>
                <select
                  className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-950"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>

              <div className="mt-4 divide-y divide-stone-100 dark:divide-stone-800">
                {filteredRequests.length === 0 ? (
                  <p className="px-2 py-12 text-center text-sm text-stone-500">
                    No profile change requests in this view.
                  </p>
                ) : (
                  filteredRequests.map((request) => {
                    const active = selected?.id === request.id;
                    return (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => setSelectedId(request.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left",
                          active ? "bg-amber-50 dark:bg-amber-950/20" : "hover:bg-stone-50"
                        )}
                      >
                        <img
                          src={getProfilePortraitUrl(request.requester.employeeId)}
                          alt=""
                          className="h-11 w-11 rounded-full object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span>
                              <span className="block font-medium text-stone-900 dark:text-stone-50">
                                {request.requester.name}
                              </span>
                              <span className="mt-0.5 block text-sm text-stone-500">
                                {requestTypeTitle(request)}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs text-stone-400">
                              {formatShortDate(request.createdAt)}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-stone-400">
                            Requested to update {changeFieldLabel(request).toLowerCase()}.
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                            statusClass(request.status)
                          )}
                        >
                          {statusLabel(request.status)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <aside className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950">
              {selected ? (
                <RequestDetail
                  request={selected}
                  canReview={canReview && selected.status === "PENDING"}
                  reviewing={review.isPending}
                  onReview={(decision) =>
                    void review.mutateAsync({ requestId: selected.id, decision })
                  }
                />
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-sm text-stone-500">
                  <Bell className="mb-3 h-8 w-8 text-stone-300" />
                  Select a profile change request to review the details.
                </div>
              )}
            </aside>
          </div>
        ) : null}

        {tab !== "profile" ? (
          <section className="rounded-[28px] border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
            <div className="space-y-2">
              {otherNotifications.length === 0 && tab !== "all" ? (
                <p className="px-2 py-10 text-center text-sm text-stone-500">
                  No notifications in this category yet.
                </p>
              ) : (
                otherNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-stone-100 px-4 py-3 dark:border-stone-800"
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-stone-500">{item.message}</p>
                    <p className="mt-2 text-xs text-stone-400">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Notification Settings"
        description="Choose which in-app notifications you want to receive."
      >
        <div className="space-y-3 text-sm">
          {[
            "Profile change requests",
            "Meetings",
            "PDP updates",
            "Reviews",
            "System alerts",
          ].map((label) => (
            <label key={label} className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-amber-600" />
              {label}
            </label>
          ))}
          <div className="flex justify-end pt-2">
            <Button type="button" onClick={() => setSettingsOpen(false)}>
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </DashboardLayout>
  );
}

function RequestDetail({
  request,
  canReview,
  reviewing,
  onReview,
}: {
  request: ProfileChangeRequest;
  canReview: boolean;
  reviewing: boolean;
  onReview: (decision: "APPROVED" | "REJECTED") => void;
}) {
  const field = changeFieldLabel(request);
  const roleWord =
    request.requester.role === "SUPERVISOR"
      ? "Supervisor"
      : request.requester.role === "HR"
        ? "HR staff member"
        : "Employee";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={getProfilePortraitUrl(request.requester.employeeId)}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <p className="font-semibold text-stone-900 dark:text-white">
              {request.requester.name}
            </p>
            <p className="text-xs text-stone-500">
              {request.requester.jobTitle ?? "—"} · {request.requester.employeeId}
              {request.requester.department
                ? ` · ${request.requester.department.name}`
                : ""}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            statusClass(request.status)
          )}
        >
          {statusLabel(request.status)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
        {roleWord} has requested a profile update.
        <p className="mt-1 text-xs text-sky-800/80 dark:text-sky-200/80">
          Please review the details below and take appropriate action.
        </p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Requested Change
        </p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <div>
            <p className="text-xs text-stone-400">Current {field}</p>
            <p className="mt-1 rounded-xl bg-stone-50 px-3 py-2 text-sm dark:bg-stone-900">
              {request.currentValue}
            </p>
          </div>
          <span className="mt-7 text-stone-300">→</span>
          <div>
            <p className="text-xs text-stone-400">Requested {field}</p>
            <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
              {request.requestedValue}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Reason for Change
        </p>
        <p className="mt-2 text-sm text-stone-700 dark:text-stone-200">
          “{request.reason}”
        </p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Request Details
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="block text-xs text-stone-400">Requested On</span>
            {formatDateTime(request.createdAt)}
          </p>
          <p>
            <span className="block text-xs text-stone-400">Requested By</span>
            {request.requester.name}
          </p>
          <p>
            <span className="block text-xs text-stone-400">Request Type</span>
            {REQUEST_TYPE_LABELS[request.requestType]}
          </p>
          <p>
            <span className="block text-xs text-stone-400">Status</span>
            {statusLabel(request.status)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Supporting Document (Optional)
        </p>
        {request.hasEvidence ? (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-stone-200 px-3 py-3 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-stone-400" />
              <div>
                <p className="text-sm font-medium">{request.evidenceName}</p>
                <p className="text-xs text-stone-400">
                  {fileType(request.evidenceMime, request.evidenceName)}
                  {request.evidenceSize ? ` · ${formatBytes(request.evidenceSize)}` : ""}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void profileRequestsApi.downloadEvidence(
                  request.id,
                  request.evidenceName ?? "evidence"
                )
              }
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-500">No supporting document attached.</p>
        )}
      </div>

      {canReview ? (
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={reviewing}
            onClick={() => onReview("REJECTED")}
          >
            Reject
          </Button>
          <Button
            type="button"
            disabled={reviewing}
            onClick={() => onReview("APPROVED")}
          >
            Approve
          </Button>
        </div>
      ) : null}
    </div>
  );
}
