import { cn } from "@/lib/utils";

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatMeetingSlot(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

export function meetingStatusLabel(status: string) {
  if (status === "NOT_SCHEDULED") return "Not Scheduled";
  if (status === "RESCHEDULE_REQUESTED") return "Reschedule Requested";
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function responseLabel(value: string | null | undefined) {
  if (!value || value === "NOT_INVITED") return "Not Invited";
  if (value === "RESCHEDULE_REQUESTED") return "Reschedule Requested";
  if (value === "DECLINED" || value === "REJECTED") return "Declined";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function meetingStatusClass(status: string) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (status === "SCHEDULED" || status === "CONFIRMED") return "bg-sky-100 text-sky-800";
  if (status === "RESCHEDULE_REQUESTED") return "bg-amber-100 text-amber-800";
  if (status === "CANCELLED") return "bg-stone-200 text-stone-600";
  return "bg-rose-100 text-rose-700";
}

export function responseClass(value: string | null | undefined) {
  if (value === "ACCEPTED") return "bg-emerald-100 text-emerald-800";
  if (value === "PENDING") return "bg-amber-100 text-amber-800";
  if (value === "RESCHEDULE_REQUESTED") return "bg-orange-100 text-orange-800";
  if (value === "DECLINED" || value === "REJECTED") return "bg-rose-100 text-rose-700";
  return "bg-stone-100 text-stone-600";
}

export function Badge({ value, kind }: { value: string; kind: "status" | "response" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        kind === "status" ? meetingStatusClass(value) : responseClass(value)
      )}
    >
      {kind === "status" ? meetingStatusLabel(value) : responseLabel(value)}
    </span>
  );
}
