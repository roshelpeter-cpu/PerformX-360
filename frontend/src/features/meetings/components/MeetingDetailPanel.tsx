import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import { formatDateTime } from "@/features/hr/utils/dates";
import {
  useCompletePlanningMeeting,
  usePlanningMeeting,
  useReschedulePlanningMeeting,
  useRespondPlanningMeeting,
  useSavePlanningNotes,
} from "../hooks/useMeetings";
import { Badge, formatMeetingSlot } from "./meetingBadges";
import { RespondMeetingDialog } from "./RespondMeetingDialog";
import type { PreviousAppraisal } from "../services/meetings.api";

export function MeetingDetailPanel({
  meetingId,
  onClose,
  canSchedule,
}: {
  meetingId: string;
  onClose: () => void;
  canSchedule: boolean;
}) {
  const query = usePlanningMeeting(meetingId);
  const saveNotes = useSavePlanningNotes();
  const complete = useCompletePlanningMeeting();
  const reschedule = useReschedulePlanningMeeting();
  const respond = useRespondPlanningMeeting();
  const meeting = query.data?.meeting;
  const appraisal = query.data?.previousAppraisal ?? null;
  const [tab, setTab] = useState<"details" | "notes" | "appraisal">("details");
  const [editingNotes, setEditingNotes] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [responseMode, setResponseMode] = useState<"ACCEPT" | "DECLINE" | "RESCHEDULE" | null>(null);
  const [notes, setNotes] = useState({
    lastYearReview: "",
    careerGoals: "",
    developmentAreas: "",
    developmentObjectives: "",
    supportRequired: "",
    agreedPoints: "",
    additionalNotes: "",
  });

  useEffect(() => {
    if (!meeting?.notes) return;
    setNotes({
      lastYearReview: meeting.notes.lastYearReview ?? "",
      careerGoals: meeting.notes.careerGoals ?? "",
      developmentAreas: meeting.notes.developmentAreas ?? "",
      developmentObjectives: meeting.notes.developmentObjectives ?? "",
      supportRequired: meeting.notes.supportRequired ?? "",
      agreedPoints: meeting.notes.agreedPoints ?? "",
      additionalNotes: meeting.notes.additionalNotes ?? "",
    });
  }, [meeting?.id, meeting?.notes]);

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

      {query.isLoading ? <p className="p-5 text-sm text-stone-500">Loading meeting...</p> : null}
      {!meeting ? null : (
        <>
          <div className="flex gap-2 border-b border-stone-100 px-5 py-3 text-sm dark:border-stone-800">
            {(["details", "notes", "appraisal"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-full px-3 py-1 ${tab === item ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950" : "text-stone-500"}`}
              >
                {item === "details" ? "Meeting Info" : item === "notes" ? "Meeting Notes" : "Last Year's Appraisal"}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
            {tab === "details" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge kind="status" value={meeting.status} />
                  <Badge kind="response" value={meeting.employeeResponse} />
                  <Badge kind="response" value={meeting.hrResponse} />
                </div>
                <Info label="Date & Time" value={formatMeetingSlot(meeting.scheduledAt)} />
                <Info label="Location" value={meeting.location ?? "—"} />
                <Info label="Appraisal Cycle" value={meeting.cycle?.name ?? "—"} />
                <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-900">
                  <p className="text-xs uppercase tracking-[0.14em] text-stone-400">Employee</p>
                  <p className="mt-1 font-medium">{meeting.employee.name}</p>
                  <p className="text-stone-500">{meeting.employee.employeeId} · {meeting.employee.jobTitle ?? "—"}</p>
                  <p className="text-stone-500">{meeting.employee.department?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-stone-400">Participants</p>
                  <ul className="mt-2 space-y-2">
                    <li>Supervisor: {meeting.supervisor?.name ?? "—"}</li>
                    <li>Employee: {meeting.employee.name}</li>
                    <li>HR: {meeting.hrParticipant ? `${meeting.hrParticipant.name} (${responseLabelSafe(meeting.hrResponse)})` : "Not invited"}</li>
                  </ul>
                </div>
                <div className="space-y-1 rounded-2xl border border-stone-100 p-3 dark:border-stone-800">
                  <p>Employee response: {responseLabelSafe(meeting.employeeResponse)}</p>
                  {meeting.employeeReason ? <p className="text-stone-500">Reason: {meeting.employeeReason}</p> : null}
                  <p>HR response: {responseLabelSafe(meeting.hrResponse)}</p>
                  {meeting.hrReason ? <p className="text-stone-500">Reason: {meeting.hrReason}</p> : null}
                </div>
                {meeting.canRespondAsEmployee || meeting.canRespondAsHr ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => setResponseMode("ACCEPT")}>
                      {meeting.canRespondAsHr ? "Accept / Attend" : "Accept Invitation"}
                    </Button>
                    {meeting.canRespondAsEmployee ? (
                      <Button type="button" variant="outline" onClick={() => setResponseMode("RESCHEDULE")}>
                        Request Reschedule
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" onClick={() => setResponseMode("DECLINE")}>
                      {meeting.canRespondAsHr ? "Decline / Not Attend" : "Decline Invitation"}
                    </Button>
                  </div>
                ) : null}
                {canSchedule && meeting.canReschedule ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setRescheduleOpen(true)}>
                      Edit / Reschedule
                    </Button>
                    {meeting.status !== "COMPLETED" ? (
                      <Button type="button" variant="outline" onClick={() => complete.mutate(meeting.id)}>
                        Mark Completed
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "notes" ? (
              meeting.canViewNotes ? (
                <div className="space-y-3">
                  {meeting.canEditNotes && editingNotes ? (
                    <>
                      {Object.entries({
                        lastYearReview: "Review of Last Year's Appraisal",
                        careerGoals: "Employee's career goals and interests",
                        developmentAreas: "Development areas",
                        developmentObjectives: "Development objectives",
                        supportRequired: "Support / resources required",
                        agreedPoints: "Agreed discussion points",
                        additionalNotes: "Additional notes",
                      }).map(([key, label]) => (
                        <label key={key} className="block text-sm">
                          {label}
                          <textarea
                            className="mt-1 min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
                            value={notes[key as keyof typeof notes]}
                            onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))}
                          />
                        </label>
                      ))}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={saveNotes.isPending}
                          onClick={() =>
                            void saveNotes.mutateAsync({ meetingId: meeting.id, body: notes }).then(() => setEditingNotes(false))
                          }
                        >
                          Save notes
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEditingNotes(false)}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <NoteBlock label="Review of Last Year's Appraisal" value={meeting.notes?.lastYearReview} />
                      <NoteBlock label="Career goals and interests" value={meeting.notes?.careerGoals} />
                      <NoteBlock label="Development areas" value={meeting.notes?.developmentAreas} />
                      <NoteBlock label="Development objectives" value={meeting.notes?.developmentObjectives} />
                      <NoteBlock label="Support / resources required" value={meeting.notes?.supportRequired} />
                      <NoteBlock label="Agreed discussion points" value={meeting.notes?.agreedPoints} />
                      <NoteBlock label="Additional notes" value={meeting.notes?.additionalNotes} />
                      {meeting.notes ? (
                        <p className="text-xs text-stone-400">
                          Recorded by {meeting.notes.recordedBy.name} · {formatDateTime(meeting.notes.recordedAt)}
                        </p>
                      ) : (
                        <p className="text-stone-500">No meeting notes have been recorded yet.</p>
                      )}
                      {meeting.canEditNotes ? (
                        <Button type="button" variant="outline" onClick={() => setEditingNotes(true)}>
                          {meeting.notes ? "Edit notes" : "Record meeting notes"}
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-stone-500">You do not have permission to view these notes.</p>
              )
            ) : null}

            {tab === "appraisal" ? <AppraisalView appraisal={appraisal} /> : null}
          </div>
        </>
      )}

      <RespondMeetingDialog
        open={Boolean(responseMode)}
        title={
          responseMode === "ACCEPT"
            ? "Accept invitation"
            : responseMode === "RESCHEDULE"
              ? "Request reschedule"
              : "Decline invitation"
        }
        description={
          responseMode === "ACCEPT"
            ? "Confirm that you will attend this performance planning meeting."
            : "A reason is required so the supervisor can take the next step."
        }
        requireReason={responseMode === "DECLINE" || responseMode === "RESCHEDULE"}
        pending={respond.isPending}
        confirmLabel="Submit"
        onClose={() => setResponseMode(null)}
        onSubmit={(reason) =>
          respond.mutateAsync({
            meetingId,
            decision: responseMode ?? "ACCEPT",
            reason: reason || undefined,
          })
        }
      />

      <Dialog
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Reschedule meeting"
        description="Choose a new date and time. Employee and HR responses will reset to pending."
      >
        <RescheduleForm
          pending={reschedule.isPending}
          defaultLocation={meeting?.location ?? "Microsoft Teams (Online)"}
          onCancel={() => setRescheduleOpen(false)}
          onSubmit={(body) =>
            reschedule.mutateAsync({ meetingId, body }).then(() => setRescheduleOpen(false))
          }
        />
      </Dialog>
    </aside>
  );
}

function responseLabelSafe(value: string) {
  if (value === "NOT_INVITED") return "Not invited";
  if (value === "RESCHEDULE_REQUESTED") return "Reschedule requested";
  if (value === "DECLINED") return "Declined";
  return value.replaceAll("_", " ").toLowerCase();
}

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

function AppraisalView({ appraisal }: { appraisal: PreviousAppraisal | null }) {
  if (!appraisal) {
    return <p className="text-stone-500">No previous appraisal is available for this employee.</p>;
  }
  return (
    <div className="space-y-3">
      <Info label="Cycle" value={appraisal.cycle.name} />
      <Info label="Overall result" value={appraisal.overallResult} />
      <Info label="Rating" value={appraisal.ratingBand ?? "—"} />
      <Info label="Score" value={appraisal.overallScore != null ? String(appraisal.overallScore) : "—"} />
      <NoteBlock label="Achievements" value={appraisal.achievements} />
      <NoteBlock label="Areas for improvement" value={appraisal.areasForImprovement} />
      <NoteBlock label="Supervisor comments" value={appraisal.supervisorComments} />
      <NoteBlock label="Development recommendations" value={appraisal.developmentRecommendations} />
      <NoteBlock label="Outcomes" value={appraisal.outcomes} />
    </div>
  );
}

function RescheduleForm({
  pending,
  defaultLocation,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  defaultLocation: string;
  onCancel: () => void;
  onSubmit: (body: Record<string, string | undefined>) => Promise<unknown>;
}) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState(defaultLocation);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ date, startTime, endTime, location });
      }}
    >
      <label className="block text-sm">
        Date
        <input className={`${fieldClass} mt-1`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Start
          <input className={`${fieldClass} mt-1`} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
        </label>
        <label className="block text-sm">
          End
          <input className={`${fieldClass} mt-1`} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
        </label>
      </div>
      <label className="block text-sm">
        Meeting method
        <select className={`${fieldClass} mt-1`} value={location} onChange={(event) => setLocation(event.target.value)}>
          <option>Microsoft Teams (Online)</option>
          <option>Zoom (Online)</option>
          <option>In-person / Office</option>
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Reschedule"}
        </Button>
      </div>
    </form>
  );
}
