import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-stone-100 text-stone-700",
  PENDING_EMPLOYEE_REVIEW: "bg-amber-100 text-amber-900",
  PENDING_HR_REVIEW: "bg-amber-100 text-amber-900",
  PENDING_REAPPROVAL: "bg-amber-100 text-amber-900",
  CHANGES_REQUESTED: "bg-rose-100 text-rose-800",
  CHANGES_REQUESTED_BY_EMPLOYEE: "bg-rose-100 text-rose-800",
  CHANGES_REQUESTED_BY_HR: "bg-rose-100 text-rose-800",
  UNDER_SUPERVISOR_REVISION: "bg-sky-100 text-sky-800",
  AWAITING_SUPERVISOR_ACTION: "bg-sky-100 text-sky-800",
  AWAITING_HR_DECISION: "bg-violet-100 text-violet-800",
  PENDING_HR_INTERVENTION: "bg-violet-100 text-violet-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  ACTIVE: "bg-emerald-100 text-emerald-900",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-900",
  CHANGES_REQUESTED_APPROVAL: "bg-rose-100 text-rose-800",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_EMPLOYEE_REVIEW: "Pending Employee Approval",
  PENDING_HR_REVIEW: "Pending HR Approval",
  PENDING_REAPPROVAL: "Pending Re-approval",
  CHANGES_REQUESTED: "Changes Requested",
  CHANGES_REQUESTED_BY_EMPLOYEE: "Employee Requested Changes",
  CHANGES_REQUESTED_BY_HR: "HR Requested Changes",
  UNDER_SUPERVISOR_REVISION: "Awaiting Supervisor Changes",
  AWAITING_SUPERVISOR_ACTION: "Awaiting Supervisor Action",
  AWAITING_HR_DECISION: "Awaiting HR Decision",
  PENDING_HR_INTERVENTION: "Awaiting HR Decision",
  APPROVED: "Approved",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  PENDING: "Pending",
  APPROVED_APPROVAL: "Approved",
  CHANGES_REQUESTED_APPROVAL: "Changes Requested",
};

export function formatPdpStatus(status: string | null | undefined) {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function PdpStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-stone-400">—</span>;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-stone-100 text-stone-700",
        className
      )}
    >
      {formatPdpStatus(status)}
    </span>
  );
}

export function ApprovalBadge({ status }: { status: string | null | undefined }) {
  const mapped =
    status === "APPROVED"
      ? "APPROVED"
      : status === "CHANGES_REQUESTED"
        ? "CHANGES_REQUESTED"
        : status
          ? "PENDING"
          : null;
  return <PdpStatusBadge status={mapped} />;
}
