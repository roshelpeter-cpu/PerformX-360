import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import { usePreviousAppraisal, useSchedulePlanningMeeting } from "../hooks/useMeetings";
import type { MeetingPerson } from "../services/meetings.api";
import { Badge } from "./meetingBadges";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-stone-400">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function NoteBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-stone-600 dark:text-stone-300">{value?.trim() || "—"}</p>
    </div>
  );
}

export function NotScheduledDetailPanel({
  employee,
  canSchedule,
  onClose,
  onScheduled,
}: {
  employee: MeetingPerson & {
    department?: { id: string; name: string } | null;
    supervisor?: MeetingPerson | null;
    hr?: MeetingPerson | null;
  };
  canSchedule: boolean;
  onClose: () => void;
  onScheduled: (meetingId: string) => void;
}) {
  const detail = usePreviousAppraisal(employee.id);
  const schedule = useSchedulePlanningMeeting();
  const data = detail.data;
  const [tab, setTab] = useState<"details" | "appraisal" | "pdp" | "schedule">("details");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState("Microsoft Teams (Online)");
  const [agenda, setAgenda] = useState("");

  return (
    <aside className="flex h-full min-h-[640px] flex-col rounded-[28px] border border-stone-200 bg-white shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950">
      <div className="flex items-start justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Meeting Details</p>
          <h2 className="mt-1 text-lg font-semibold">Performance Planning</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-stone-400 hover:bg-stone-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-stone-100 px-5 py-3 text-sm dark:border-stone-800">
        {([
          ["details", "Meeting Info"],
          ["appraisal", "Previous Appraisal"],
          ["pdp", "Previous PDP"],
          ...(canSchedule ? [["schedule", "Schedule"] as const] : []),
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1 ${tab === id ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950" : "text-stone-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
        {detail.isLoading ? <p className="text-stone-500">Loading employee details...</p> : null}
        {tab === "details" ? (
          <>
            <Badge kind="status" value="NOT_SCHEDULED" />
            <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-900">
              <p className="text-xs uppercase tracking-[0.14em] text-stone-400">Employee</p>
              <p className="mt-1 font-medium">{employee.name}</p>
              <p className="text-stone-500">{employee.employeeId}</p>
              <p className="text-stone-500">{employee.jobTitle ?? "—"}</p>
              <p className="text-stone-500">{employee.department?.name ?? data?.employee.department?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-stone-400">Participants</p>
              <ul className="mt-2 space-y-1">
                <li>Supervisor: {data?.employee.supervisor?.name ?? employee.supervisor?.name ?? "—"}</li>
                <li>Employee: {employee.name}</li>
                <li>HR: {data?.employee.hr?.name ?? employee.hr?.name ?? "Not assigned"}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-dashed border-stone-200 p-4 text-stone-500 dark:border-stone-700">
              No meeting has been scheduled yet.
              {canSchedule ? " Use the Schedule tab to invite the employee and HR." : ""}
            </div>
            <div className="rounded-2xl border border-stone-100 p-4 dark:border-stone-800">
              <p className="font-medium">Meeting Notes</p>
              <p className="mt-1 text-stone-500">Not available until the meeting is completed.</p>
            </div>
            {canSchedule ? (
              <Button type="button" onClick={() => setTab("schedule")}>
                Schedule Meeting
              </Button>
            ) : null}
          </>
        ) : null}

        {tab === "appraisal" ? (
          data?.previousAppraisal ? (
            <div className="space-y-3">
              <Info label="Previous appraisal cycle" value={data.previousAppraisal.cycle.name} />
              <Info label="Overall result" value={data.previousAppraisal.overallResult} />
              <Info label="Rating" value={data.previousAppraisal.ratingBand ?? "—"} />
              <Info label="Score" value={data.previousAppraisal.overallScore != null ? String(data.previousAppraisal.overallScore) : "—"} />
              <NoteBlock label="Achievements / strengths" value={data.previousAppraisal.achievements} />
              <NoteBlock label="Development areas" value={data.previousAppraisal.areasForImprovement} />
              <NoteBlock label="Supervisor comments" value={data.previousAppraisal.supervisorComments} />
            </div>
          ) : (
            <p className="text-stone-500">No previous appraisal is available for this employee.</p>
          )
        ) : null}

        {tab === "pdp" ? (
          data?.previousPdp ? (
            <div className="space-y-3">
              <Info label="Cycle" value={data.previousPdp.cycle.name} />
              <Info label="Status" value={data.previousPdp.status.replaceAll("_", " ")} />
              <NoteBlock label="Summary" value={data.previousPdp.summary} />
              {data.previousPdp.goals.map((goal) => (
                <div key={goal.id} className="rounded-2xl border border-stone-100 p-3 dark:border-stone-800">
                  <p className="font-medium">{goal.title}</p>
                  <p className="mt-1 text-stone-600">{goal.objective}</p>
                  <p className="mt-2 text-xs text-stone-400">Progress {goal.progress}%</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-500">No previous PDP is available for this employee.</p>
          )
        ) : null}

        {tab === "schedule" && canSchedule ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void schedule
                .mutateAsync({
                  employeeId: employee.id,
                  cycleId: data?.cycle.id,
                  date,
                  startTime,
                  endTime,
                  location,
                  agenda: agenda || undefined,
                  hrEmployeeId: data?.employee.hr?.id ?? employee.hr?.id,
                })
                .then((result) => onScheduled(result.id));
            }}
          >
            <Info label="Employee" value={`${employee.name} (${employee.employeeId})`} />
            <Info label="Appraisal cycle" value={data?.cycle.name ?? "Active cycle"} />
            <label className="block">
              Meeting date
              <input className={`${fieldClass} mt-1`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                Start time
                <input className={`${fieldClass} mt-1`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </label>
              <label className="block">
                End time
                <input className={`${fieldClass} mt-1`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </label>
            </div>
            <label className="block">
              Meeting method / location
              <select className={`${fieldClass} mt-1`} value={location} onChange={(e) => setLocation(e.target.value)}>
                <option>Microsoft Teams (Online)</option>
                <option>Zoom (Online)</option>
                <option>In-person / Office</option>
              </select>
            </label>
            <label className="block">
              Agenda / message (optional)
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-950"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={schedule.isPending}>
              {schedule.isPending ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </form>
        ) : null}
      </div>
    </aside>
  );
}
