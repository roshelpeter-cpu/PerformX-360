import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { formatShortDate } from "@/features/hr/utils/dates";
import { useAuthStore } from "@/store/authStore";
import { ApiClientError } from "@/services/api/client";
import { followUpApi, type FollowUpMeeting, type FollowUpSchedule } from "../services/followUp.api";

function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function timeRange(meeting: FollowUpMeeting) {
  return `${formatClock(meeting.time)} – ${formatClock(meeting.endAt)}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

export default function FollowUpMeetingsPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const isEmployee = role === "EMPLOYEE";

  return (
    <DashboardLayout>
      {isEmployee && user ? <EmployeeFollowUp employeeId={user.id} /> : <StaffFollowUp />}
    </DashboardLayout>
  );
}

function EmployeeFollowUp({ employeeId }: { employeeId: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["follow-ups", "mine", employeeId],
    queryFn: async () => (await followUpApi.schedule(employeeId)).schedule,
  });
  const [reason, setReason] = useState("");
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const confirm = useMutation({
    mutationFn: (meetingId: string) => followUpApi.confirm(meetingId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["follow-ups"] }),
  });
  const request = useMutation({
    mutationFn: ({ meetingId, value }: { meetingId: string; value: string }) =>
      followUpApi.requestReschedule(meetingId, value),
    onSuccess: () => {
      setReason("");
      setRescheduleId(null);
      void client.invalidateQueries({ queryKey: ["follow-ups"] });
    },
  });

  if (query.isLoading) return <DashboardLoading />;
  if (query.isError || !query.data) return <DashboardError message="Unable to load follow-up meetings." />;

  const meetings = query.data.meetings;
  const additional = query.data.additionalMeetings;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Follow-up Meetings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Confirm upcoming meetings or request a reschedule with a reason. Reschedule is available during the 7 days
          before a meeting. Your supervisor manages the schedule.
        </p>
      </div>
      {meetings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          No follow-up schedule yet.
        </div>
      ) : (
        <EmployeeMeetingTable
          meetings={meetings}
          onConfirm={(id) => confirm.mutate(id)}
          onRequest={(id) => {
            setReason("");
            setRescheduleId(id);
          }}
        />
      )}
      {confirm.error ? <p className="text-sm text-red-600">{errorMessage(confirm.error, "Unable to confirm.")}</p> : null}
      {additional.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Additional Meetings</h2>
          <EmployeeMeetingTable
            meetings={additional}
            onConfirm={(id) => confirm.mutate(id)}
            onRequest={(id) => {
              setReason("");
              setRescheduleId(id);
            }}
          />
        </section>
      ) : null}
      <Dialog
        open={Boolean(rescheduleId)}
        title="Reason for reschedule"
        description="Tell your supervisor why this meeting needs a new time."
        onClose={() => setRescheduleId(null)}
      >
        <textarea
          className="min-h-24 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          placeholder="Reason for reschedule"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {request.error ? (
          <p className="mt-2 text-sm text-red-600">{errorMessage(request.error, "Unable to request a reschedule.")}</p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            className="bg-amber-400 text-stone-900 hover:bg-amber-300"
            disabled={!reason.trim() || request.isPending}
            onClick={() => {
              if (!rescheduleId) return;
              request.mutate({ meetingId: rescheduleId, value: reason.trim() });
            }}
          >
            Submit request
          </Button>
          <Button type="button" variant="outline" onClick={() => setRescheduleId(null)}>
            Cancel
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function EmployeeMeetingTable({
  meetings,
  onConfirm,
  onRequest,
}: {
  meetings: FollowUpMeeting[];
  onConfirm: (id: string) => void;
  onRequest: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-stone-400">
          <tr>
            <th className="px-3 py-2">Meeting</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {meetings.map((meeting) => (
            <tr key={meeting.id} className="border-t border-stone-100">
              <td className="px-3 py-3 font-medium">
                {meeting.isAdditional ? meeting.title || "Additional" : `Meeting ${meeting.meetingNumber ?? "—"}`}
              </td>
              <td className="px-3 py-3">{formatShortDate(meeting.date)}</td>
              <td className="px-3 py-3">{timeRange(meeting)}</td>
              <td className="px-3 py-3">{meeting.location}</td>
              <td className="px-3 py-3">{meeting.status}</td>
              <td className="px-3 py-3">
                {meeting.canConfirm ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                      onClick={() => onConfirm(meeting.id)}
                    >
                      Confirm
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onRequest(meeting.id)}>
                      Request Reschedule
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-stone-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffFollowUp() {
  const user = useAuthStore((state) => state.user);
  const client = useQueryClient();
  const boardQuery = useQuery({
    queryKey: ["follow-ups", "board", user?.id],
    queryFn: async () => (await followUpApi.board()).board,
  });
  const [viewEmployeeId, setViewEmployeeId] = useState("");
  const [showAdditionalForm, setShowAdditionalForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [rescheduleWhen, setRescheduleWhen] = useState("");
  const scheduleQuery = useQuery({
    queryKey: ["follow-ups", "schedule", viewEmployeeId],
    queryFn: async () => (await followUpApi.schedule(viewEmployeeId)).schedule,
    enabled: Boolean(viewEmployeeId),
  });
  const generate = useMutation({
    mutationFn: (employeeId: string) => followUpApi.generate(employeeId),
    onSuccess: async (result, employeeId) => {
      setViewEmployeeId(employeeId);
      setShowAdditionalForm(false);
      client.setQueryData(["follow-ups", "schedule", employeeId], result.schedule);
      await client.invalidateQueries({ queryKey: ["follow-ups", "board"] });
    },
  });
  const additional = useMutation({
    mutationFn: () => {
      const scheduledAt = new Date(`${date}T${startTime}`);
      const endAt = new Date(`${date}T${endTime}`);
      return followUpApi.additional({
        employeeId: viewEmployeeId,
        scheduledAt: scheduledAt.toISOString(),
        endAt: endAt.toISOString(),
        title: title.trim(),
        purpose: notes.trim(),
        location: location.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      setTitle("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setLocation("");
      setNotes("");
      setShowAdditionalForm(false);
      client.setQueryData(["follow-ups", "schedule", viewEmployeeId], result.schedule);
      void client.invalidateQueries({ queryKey: ["follow-ups", "board"] });
    },
  });
  const reschedule = useMutation({
    mutationFn: ({ meetingId, scheduledAt }: { meetingId: string; scheduledAt: string }) =>
      followUpApi.supervisorReschedule(meetingId, scheduledAt),
    onSuccess: (result) => {
      setRescheduleWhen("");
      client.setQueryData(["follow-ups", "schedule", viewEmployeeId], result.schedule);
      void client.invalidateQueries({ queryKey: ["follow-ups", "board"] });
    },
  });

  const viewOnly = boardQuery.data?.viewOnly ?? false;
  const selectedRow = useMemo(
    () => boardQuery.data?.items.find((row) => row.employee.id === viewEmployeeId) ?? null,
    [boardQuery.data, viewEmployeeId]
  );
  const schedule = scheduleQuery.data;

  if (boardQuery.isLoading) return <DashboardLoading />;
  if (boardQuery.isError || !boardQuery.data) {
    return <DashboardError message="Unable to load follow-up meetings." />;
  }

  const additionalReady = Boolean(title.trim() && date && startTime && endTime && notes.trim());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Follow-up Meetings</h1>
        <p className="mt-1 text-sm text-stone-500">
          {viewOnly
            ? "HR monitor view. Schedules are generated and updated by supervisors."
            : "View a follow-up schedule, generate the standard 5 meetings, or add an extra meeting at any time."}
        </p>
      </div>

      {generate.error ? (
        <p className="text-sm text-red-600">{errorMessage(generate.error, "Unable to generate the schedule.")}</p>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-stone-400">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Supervisor</th>
                <th className="px-3 py-2">Schedule Status</th>
                <th className="px-3 py-2">Meeting 1–5</th>
                <th className="px-3 py-2">Additional Meetings</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {boardQuery.data.items.map((row) => (
                <tr key={row.employee.id} className="border-t border-stone-100">
                  <td className="px-3 py-3 font-medium">{row.employee.name}</td>
                  <td className="px-3 py-3">{row.employee.employeeId}</td>
                  <td className="px-3 py-3">{row.employee.department}</td>
                  <td className="px-3 py-3">{row.employee.supervisor}</td>
                  <td className="px-3 py-3">{row.scheduleStatus}</td>
                  <td className="px-3 py-3 text-xs">{row.meetingSummaries.join(" · ")}</td>
                  <td className="px-3 py-3">{row.additionalCount}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setViewEmployeeId(row.employee.id);
                          setShowAdditionalForm(false);
                        }}
                      >
                        View
                      </Button>
                      {!viewOnly && !row.hasSchedule ? (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                          disabled={generate.isPending}
                          onClick={() => generate.mutate(row.employee.id)}
                        >
                          Generate Schedule
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ScheduleModal
        open={Boolean(viewEmployeeId)}
        viewOnly={viewOnly}
        loading={scheduleQuery.isLoading}
        schedule={schedule ?? null}
        fallbackName={selectedRow?.employee.name}
        fallbackStatus={selectedRow?.scheduleStatus}
        additionalCount={schedule?.additionalMeetings.length ?? selectedRow?.additionalCount ?? 0}
        showAdditionalForm={showAdditionalForm}
        title={title}
        date={date}
        startTime={startTime}
        endTime={endTime}
        location={location}
        notes={notes}
        rescheduleWhen={rescheduleWhen}
        saving={additional.isPending}
        additionalReady={additionalReady}
        additionalError={additional.error ? errorMessage(additional.error, "Unable to add the meeting.") : null}
        onClose={() => {
          setViewEmployeeId("");
          setShowAdditionalForm(false);
        }}
        onToggleForm={() => setShowAdditionalForm((value) => !value)}
        onTitle={setTitle}
        onDate={setDate}
        onStart={setStartTime}
        onEnd={setEndTime}
        onLocation={setLocation}
        onNotes={setNotes}
        onRescheduleWhen={setRescheduleWhen}
        onSaveAdditional={() => additional.mutate()}
        onSupervisorReschedule={(meetingId) => {
          if (!rescheduleWhen) return;
          reschedule.mutate({ meetingId, scheduledAt: new Date(rescheduleWhen).toISOString() });
        }}
      />
    </div>
  );
}

function standardRows(meetings: FollowUpMeeting[]) {
  return [1, 2, 3, 4, 5].map((slot) => meetings.find((meeting) => meeting.meetingNumber === slot) ?? null);
}

function ScheduleModal({
  open,
  viewOnly,
  loading,
  schedule,
  fallbackName,
  fallbackStatus,
  additionalCount,
  showAdditionalForm,
  title,
  date,
  startTime,
  endTime,
  location,
  notes,
  rescheduleWhen,
  saving,
  additionalReady,
  additionalError,
  onClose,
  onToggleForm,
  onTitle,
  onDate,
  onStart,
  onEnd,
  onLocation,
  onNotes,
  onRescheduleWhen,
  onSaveAdditional,
  onSupervisorReschedule,
}: {
  open: boolean;
  viewOnly: boolean;
  loading: boolean;
  schedule: FollowUpSchedule | null;
  fallbackName?: string;
  fallbackStatus?: string;
  additionalCount: number;
  showAdditionalForm: boolean;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  rescheduleWhen: string;
  saving: boolean;
  additionalReady: boolean;
  additionalError: string | null;
  onClose: () => void;
  onToggleForm: () => void;
  onTitle: (value: string) => void;
  onDate: (value: string) => void;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onLocation: (value: string) => void;
  onNotes: (value: string) => void;
  onRescheduleWhen: (value: string) => void;
  onSaveAdditional: () => void;
  onSupervisorReschedule: (meetingId: string) => void;
}) {
  const employee = schedule?.employee;
  const rows = standardRows(schedule?.meetings ?? []);
  const additional = schedule?.additionalMeetings ?? [];

  return (
    <Dialog open={open} title="FOLLOW-UP MEETING SCHEDULE" onClose={onClose} className="max-w-5xl">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Employee" value={employee?.name ?? fallbackName ?? "—"} />
        <Info label="ID" value={employee?.employeeId ?? "—"} />
        <Info label="Department" value={employee?.department ?? "—"} />
        <Info label="Supervisor" value={employee?.supervisor ?? "—"} />
        <Info label="Schedule status" value={schedule?.scheduleStatus ?? fallbackStatus ?? "Not Scheduled"} />
        <Info label="Additional meetings" value={String(additionalCount)} />
      </div>
      {loading ? <p className="mt-4 text-sm text-stone-500">Loading schedule...</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-2 py-2">Meeting</th>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Response</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((meeting, index) => (
              <tr key={meeting?.id ?? `slot-${index + 1}`} className="border-t border-stone-100">
                <td className="px-2 py-2 font-medium">Meeting {index + 1}</td>
                <td className="px-2 py-2">{meeting ? formatShortDate(meeting.date) : "—"}</td>
                <td className="px-2 py-2">{meeting ? timeRange(meeting) : "—"}</td>
                <td className="px-2 py-2">{meeting?.status ?? "Not Scheduled"}</td>
                <td className="px-2 py-2">{meeting?.confirmationStatus ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {additional.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Additional Meetings</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-2 py-2">Meeting</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Response</th>
                </tr>
              </thead>
              <tbody>
                {additional.map((meeting, index) => (
                  <tr key={meeting.id} className="border-t border-stone-100">
                    <td className="px-2 py-2 font-medium">{meeting.title || `Additional ${index + 1}`}</td>
                    <td className="px-2 py-2">{formatShortDate(meeting.date)}</td>
                    <td className="px-2 py-2">{timeRange(meeting)}</td>
                    <td className="px-2 py-2">{meeting.status}</td>
                    <td className="px-2 py-2">{meeting.confirmationStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!viewOnly ? (
        <div className="mt-4 space-y-3">
          <Button type="button" variant="outline" onClick={onToggleForm}>
            Add Additional Meeting
          </Button>
          {showAdditionalForm ? (
            <div className="grid gap-3 rounded-xl border border-stone-200 p-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                Meeting title / purpose
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                  value={title}
                  onChange={(event) => onTitle(event.target.value)}
                />
              </label>
              <label className="text-sm">
                Date
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                  value={date}
                  onChange={(event) => onDate(event.target.value)}
                />
              </label>
              <label className="text-sm">
                Location
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                  value={location}
                  onChange={(event) => onLocation(event.target.value)}
                />
              </label>
              <label className="text-sm">
                Start time
                <input
                  type="time"
                  className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                  value={startTime}
                  onChange={(event) => onStart(event.target.value)}
                />
              </label>
              <label className="text-sm">
                End time
                <input
                  type="time"
                  className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                  value={endTime}
                  onChange={(event) => onEnd(event.target.value)}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Notes / reason
                <textarea
                  className="mt-1 min-h-20 w-full rounded-xl border border-stone-300 px-3 py-2"
                  value={notes}
                  onChange={(event) => onNotes(event.target.value)}
                />
              </label>
              {additionalError ? <p className="text-sm text-red-600 sm:col-span-2">{additionalError}</p> : null}
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                  disabled={!additionalReady || saving}
                  onClick={onSaveAdditional}
                >
                  Save additional meeting
                </Button>
              </div>
            </div>
          ) : null}
          {(schedule?.meetings ?? []).some((meeting) => meeting.pendingReschedule) ||
          additional.some((meeting) => meeting.pendingReschedule) ? (
            <label className="block text-sm">
              New date and time for a reschedule request
              <input
                type="datetime-local"
                className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                value={rescheduleWhen}
                onChange={(event) => onRescheduleWhen(event.target.value)}
              />
            </label>
          ) : null}
          {[...(schedule?.meetings ?? []), ...additional]
            .filter((meeting) => meeting.pendingReschedule)
            .map((meeting) => (
              <div key={meeting.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                <span>
                  {meeting.isAdditional ? meeting.title : `Meeting ${meeting.meetingNumber}`}:{" "}
                  {meeting.pendingReschedule?.reason}
                </span>
                <Button type="button" size="sm" disabled={!rescheduleWhen} onClick={() => onSupervisorReschedule(meeting.id)}>
                  Reschedule
                </Button>
              </div>
            ))}
        </div>
      ) : null}
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="text-sm font-medium text-stone-800">{value}</p>
    </div>
  );
}
