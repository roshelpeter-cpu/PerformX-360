import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { formatDateTime, formatShortDate } from "@/features/hr/utils/dates";
import { useAuthStore } from "@/store/authStore";
import { ApiClientError } from "@/services/api/client";
import { followUpApi, type FollowUpMeeting } from "../services/followUp.api";

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

  const meetings = [...query.data.meetings, ...query.data.additionalMeetings];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Follow-up Meetings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Confirm upcoming meetings or request a reschedule with a reason. Your supervisor manages the schedule.
        </p>
      </div>
      <MeetingTable
        meetings={meetings}
        employeeMode
        onConfirm={(id) => confirm.mutate(id)}
        onRequest={(id) => setRescheduleId(id)}
      />
      {rescheduleId ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="font-semibold">Request reschedule</h2>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            placeholder="Reason is required"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="bg-amber-400 text-stone-900 hover:bg-amber-300"
              disabled={!reason.trim() || request.isPending}
              onClick={() => request.mutate({ meetingId: rescheduleId, value: reason.trim() })}
            >
              Submit request
            </Button>
            <Button type="button" variant="outline" onClick={() => setRescheduleId(null)}>
              Cancel
            </Button>
          </div>
          {request.error instanceof ApiClientError ? (
            <p className="mt-2 text-sm text-red-600">{request.error.message}</p>
          ) : null}
        </section>
      ) : null}
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
  const [selected, setSelected] = useState("");
  const [purpose, setPurpose] = useState("");
  const [when, setWhen] = useState("");
  const [rescheduleWhen, setRescheduleWhen] = useState("");
  const scheduleQuery = useQuery({
    queryKey: ["follow-ups", "schedule", selected],
    queryFn: async () => (await followUpApi.schedule(selected)).schedule,
    enabled: Boolean(selected),
  });
  const generate = useMutation({
    mutationFn: (employeeId: string) => followUpApi.generate(employeeId),
    onSuccess: async (_data, employeeId) => {
      setSelected(employeeId);
      await client.invalidateQueries({ queryKey: ["follow-ups"] });
    },
  });
  const additional = useMutation({
    mutationFn: () =>
      followUpApi.additional({ employeeId: selected, scheduledAt: new Date(when).toISOString(), purpose }),
    onSuccess: () => {
      setPurpose("");
      setWhen("");
      void client.invalidateQueries({ queryKey: ["follow-ups"] });
    },
  });
  const reschedule = useMutation({
    mutationFn: ({ meetingId, scheduledAt }: { meetingId: string; scheduledAt: string }) =>
      followUpApi.supervisorReschedule(meetingId, scheduledAt),
    onSuccess: () => {
      setRescheduleWhen("");
      void client.invalidateQueries({ queryKey: ["follow-ups"] });
    },
  });

  const viewOnly = boardQuery.data?.viewOnly ?? false;
  const selectedRow = useMemo(
    () => boardQuery.data?.items.find((row) => row.employee.id === selected) ?? null,
    [boardQuery.data, selected]
  );

  if (boardQuery.isLoading) return <DashboardLoading />;
  if (boardQuery.isError || !boardQuery.data) {
    return <DashboardError message="Unable to load follow-up meetings." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Follow-up Meetings</h1>
        <p className="mt-1 text-sm text-stone-500">
          {viewOnly
            ? "HR monitor view. Schedules are generated and updated by supervisors."
            : "Select an employee to review their follow-up schedule, generate the standard 5 meetings, or add an extra meeting."}
        </p>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-stone-400">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Supervisor</th>
                <th className="px-3 py-2">Schedule status</th>
                <th className="px-3 py-2">Meeting 1–5</th>
                <th className="px-3 py-2">Additional meetings</th>
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
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelected(row.employee.id)}>
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

      {selected ? (
        <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {selectedRow?.employee.name ?? scheduleQuery.data?.employee.name}
              </h2>
              <p className="text-sm text-stone-500">
                {scheduleQuery.data?.scheduleStatus ??
                  (selectedRow?.hasSchedule ? selectedRow.scheduleStatus : "No follow-up schedule yet")}
              </p>
            </div>
          </div>
          {scheduleQuery.isLoading ? <DashboardLoading /> : null}
          {scheduleQuery.data && scheduleQuery.data.meetings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
              No follow-up schedule yet
            </p>
          ) : null}
          {scheduleQuery.data ? (
            <MeetingTable
              meetings={[...scheduleQuery.data.meetings, ...scheduleQuery.data.additionalMeetings]}
              viewOnly={viewOnly}
              onSupervisorReschedule={(meetingId) => {
                if (!rescheduleWhen) return;
                reschedule.mutate({ meetingId, scheduledAt: new Date(rescheduleWhen).toISOString() });
              }}
            />
          ) : null}

          {!viewOnly && selectedRow?.hasSchedule ? (
            <div className="grid gap-3 rounded-xl border border-stone-100 p-4 sm:grid-cols-3">
              <label className="text-sm">
                Additional meeting date & time
                <input
                  type="datetime-local"
                  className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                  value={when}
                  onChange={(event) => setWhen(event.target.value)}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Purpose / reason
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                />
              </label>
              <div className="sm:col-span-3">
                <Button
                  type="button"
                  className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                  disabled={!when || !purpose.trim() || additional.isPending}
                  onClick={() => additional.mutate()}
                >
                  Schedule Additional Meeting
                </Button>
              </div>
              <label className="text-sm sm:col-span-3">
                New date & time for a reschedule request
                <input
                  type="datetime-local"
                  className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3"
                  value={rescheduleWhen}
                  onChange={(event) => setRescheduleWhen(event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MeetingTable({
  meetings,
  employeeMode,
  viewOnly,
  onConfirm,
  onRequest,
  onSupervisorReschedule,
}: {
  meetings: FollowUpMeeting[];
  employeeMode?: boolean;
  viewOnly?: boolean;
  onConfirm?: (id: string) => void;
  onRequest?: (id: string) => void;
  onSupervisorReschedule?: (id: string) => void;
}) {
  if (meetings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
        No follow-up meetings to display.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-stone-400">
          <tr>
            <th className="px-3 py-2">Meeting</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">{employeeMode ? "Supervisor" : "Employee"}</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Confirmation</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {meetings.map((meeting) => (
            <tr key={meeting.id} className="border-t border-stone-100">
              <td className="px-3 py-3 font-medium">
                {meeting.isAdditional ? "Additional" : `Meeting ${meeting.meetingNumber ?? "—"}`}
              </td>
              <td className="px-3 py-3">{formatShortDate(meeting.date)}</td>
              <td className="px-3 py-3">{formatDateTime(meeting.time)}</td>
              <td className="px-3 py-3">
                {employeeMode ? meeting.supervisor?.name ?? "—" : meeting.employee.name}
              </td>
              <td className="px-3 py-3">{meeting.status}</td>
              <td className="px-3 py-3">{meeting.location}</td>
              <td className="px-3 py-3">{meeting.confirmationStatus}</td>
              <td className="px-3 py-3">
                {employeeMode && meeting.canConfirm ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                      onClick={() => onConfirm?.(meeting.id)}
                    >
                      Confirm
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onRequest?.(meeting.id)}>
                      Request Reschedule
                    </Button>
                  </div>
                ) : !employeeMode && !viewOnly && meeting.pendingReschedule ? (
                  <Button type="button" size="sm" onClick={() => onSupervisorReschedule?.(meeting.id)}>
                    Reschedule
                  </Button>
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
