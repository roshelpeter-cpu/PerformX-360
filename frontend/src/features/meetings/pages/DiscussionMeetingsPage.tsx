import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { ApiClientError } from "@/services/api/client";
import { useAuthStore } from "@/store/authStore";
import { discussionApi, type DiscussionMeeting } from "../services/meetings.api";
import { formatMeetingSlot, meetingStatusLabel } from "../components/meetingBadges";

export default function DiscussionMeetingsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const userId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  const meetings = useQuery({
    queryKey: ["meetings", "discussions"],
    queryFn: async () => (await discussionApi.list()).meetings,
  });
  const options = useQuery({
    queryKey: ["meetings", "discussions", "options"],
    queryFn: async () => (await discussionApi.options()).options,
    enabled: role === "SUPERVISOR",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [form, setForm] = useState({
    type: "PDP_DISAGREEMENT" as "PDP_DISAGREEMENT" | "PIP_DISCUSSION",
    employeeId: "",
    participantIds: [] as string[],
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    location: "Altrium Meeting Room",
    purpose: "",
  });
  const [reschedule, setReschedule] = useState({ date: "", startTime: "09:00", endTime: "10:00", note: "" });
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const selected = meetings.data?.find((meeting) => meeting.id === selectedId) ?? null;
  const refresh = async (meeting?: DiscussionMeeting) => {
    if (meeting) setSelectedId(meeting.id);
    await client.invalidateQueries({ queryKey: ["meetings", "discussions"] });
  };

  const schedule = useMutation({
    mutationFn: async () => discussionApi.schedule(form),
    onSuccess: async (result) => {
      setMessage("Invitation sent to the selected participants.");
      setScheduling(false);
      await refresh(result.meeting);
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to schedule the meeting."),
  });
  const respond = useMutation({
    mutationFn: async (decision: "ACCEPT" | "RESCHEDULE") => {
      if (!selected) throw new Error("Select a meeting");
      return discussionApi.respond(selected.id, { decision, reason });
    },
    onSuccess: async (result) => {
      setReason("");
      setMessage(result.meeting.status === "CONFIRMED" ? "Meeting confirmed." : "Response saved.");
      await refresh(result.meeting);
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to respond."),
  });
  const move = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a meeting");
      return discussionApi.reschedule(selected.id, reschedule);
    },
    onSuccess: async (result) => {
      setMessage("Updated invitation sent to the selected participants.");
      await refresh(result.meeting);
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to reschedule."),
  });

  const mine = selected?.participants.find((participant) => participant.employeeId === userId);
  const canRespond = Boolean(mine && mine.role !== "SUPERVISOR" && mine.response === "PENDING" && selected?.status !== "CONFIRMED" && selected?.status !== "COMPLETED");
  const canReschedule = role === "SUPERVISOR" && selected?.supervisor?.id === userId && selected?.status === "RESCHEDULE_REQUESTED";

  return (
    <DashboardLayout>
      {meetings.isLoading ? (
        <DashboardLoading />
      ) : meetings.isError ? (
        <DashboardError message="Unable to load review meetings." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Review Meetings</h1>
              <p className="mt-1 max-w-2xl text-sm text-stone-500">
                PDP disagreement and PIP discussion meetings. Only the selected participants and the scheduling supervisor can see each invitation.
              </p>
            </div>
            {role === "SUPERVISOR" ? (
              <Button type="button" className="bg-amber-400 text-stone-900 hover:bg-amber-300" onClick={() => setScheduling((value) => !value)}>
                Schedule meeting
              </Button>
            ) : null}
          </div>
          {message ? <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">{message}</p> : null}
          {scheduling && options.data ? (
            <form
              className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                schedule.mutate();
              }}
            >
              <label className="text-sm">
                Meeting type
                <select className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as typeof form.type })}>
                  <option value="PDP_DISAGREEMENT">PDP disagreement meeting</option>
                  <option value="PIP_DISCUSSION">PIP discussion meeting</option>
                </select>
              </label>
              <label className="text-sm">
                Employee
                <select className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3" value={form.employeeId} required onChange={(event) => setForm({ ...form, employeeId: event.target.value, participantIds: event.target.value ? [event.target.value, ...form.participantIds.filter((id) => id !== form.employeeId)] : [] })}>
                  <option value="">Select employee</option>
                  {options.data.employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name} · {employee.employeeId}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                Participants
                <select
                  multiple
                  className="mt-1 min-h-28 w-full rounded-xl border border-stone-200 px-3 py-2"
                  value={form.participantIds}
                  onChange={(event) => setForm({ ...form, participantIds: [...event.target.selectedOptions].map((option) => option.value) })}
                >
                  {options.data.employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name} ({employee.employeeId})</option>
                  ))}
                  {options.data.hrStaff.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name} · HR</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">Date<input type="date" required className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
              <label className="text-sm">Location<input className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
              <label className="text-sm">Start<input type="time" required className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label>
              <label className="text-sm">End<input type="time" required className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label>
              <label className="text-sm md:col-span-2">
                Purpose / PIP reason
                <textarea required minLength={8} className="mt-1 min-h-20 w-full rounded-xl border border-stone-200 px-3 py-2" value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} />
              </label>
              <div>
                <Button type="submit" className="bg-stone-900 text-white hover:bg-stone-800" disabled={schedule.isPending}>Send invitations</Button>
              </div>
            </form>
          ) : null}
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2">Meeting</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {(meetings.data ?? []).length === 0 ? (
                  <tr><td className="px-3 py-6 text-stone-500" colSpan={6}>No review meetings are assigned to you.</td></tr>
                ) : (
                  meetings.data?.map((meeting) => (
                    <tr key={meeting.id} className="border-t border-stone-100">
                      <td className="px-3 py-3 font-medium">{meeting.title}</td>
                      <td className="px-3 py-3">{meeting.type === "PIP_DISCUSSION" ? "PIP discussion" : "PDP disagreement"}</td>
                      <td className="px-3 py-3">{meeting.employee.name}</td>
                      <td className="px-3 py-3">{formatMeetingSlot(meeting.scheduledAt)}</td>
                      <td className="px-3 py-3">{meetingStatusLabel(meeting.status)}</td>
                      <td className="px-3 py-3">
                        <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedId(meeting.id); setMessage(null); }}>View</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {selected ? (
            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="text-xl font-semibold">{selected.title}</h2>
              <p className="text-sm text-stone-600">{selected.purpose}</p>
              <p className="text-sm text-stone-500">
                {selected.employee.name} · {selected.supervisor?.name ?? "Supervisor"} · {formatMeetingSlot(selected.scheduledAt)} · {meetingStatusLabel(selected.status)}
              </p>
              <ul className="space-y-1 text-sm">
                {selected.participants.map((participant) => (
                  <li key={participant.id}>{participant.employee.name} · {participant.role} · {participant.response}{participant.responseMessage ? ` — ${participant.responseMessage}` : ""}</li>
                ))}
              </ul>
              {selected.history.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Reschedule history</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {selected.history.map((item) => (
                      <li key={item.id} className="rounded-xl bg-stone-50 px-3 py-2">
                        {item.requester.name}: {item.reason} · {item.status}{item.reviewNote ? ` · ${item.reviewNote}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {canRespond ? (
                <div className="space-y-2">
                  <textarea className="min-h-20 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" placeholder="Reason, required when requesting a reschedule" value={reason} onChange={(event) => setReason(event.target.value)} />
                  <div className="flex gap-2">
                    <Button type="button" className="bg-amber-400 text-stone-900 hover:bg-amber-300" disabled={respond.isPending} onClick={() => respond.mutate("ACCEPT")}>Approve</Button>
                    <Button type="button" variant="outline" disabled={respond.isPending || reason.trim().length < 8} onClick={() => respond.mutate("RESCHEDULE")}>Request Reschedule</Button>
                  </div>
                </div>
              ) : null}
              {canReschedule ? (
                <form className="grid gap-2 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); move.mutate(); }}>
                  <input type="date" required className="h-10 rounded-xl border border-stone-200 px-3" value={reschedule.date} onChange={(event) => setReschedule({ ...reschedule, date: event.target.value })} />
                  <input type="time" required className="h-10 rounded-xl border border-stone-200 px-3" value={reschedule.startTime} onChange={(event) => setReschedule({ ...reschedule, startTime: event.target.value })} />
                  <input type="time" required className="h-10 rounded-xl border border-stone-200 px-3" value={reschedule.endTime} onChange={(event) => setReschedule({ ...reschedule, endTime: event.target.value })} />
                  <Button type="submit" className="bg-stone-900 text-white" disabled={move.isPending}>Save new time</Button>
                </form>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  );
}
