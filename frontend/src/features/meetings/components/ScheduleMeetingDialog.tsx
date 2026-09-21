import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import type { PlanningOptions } from "../services/meetings.api";

export function ScheduleMeetingDialog({
  open,
  onClose,
  options,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  options: PlanningOptions | undefined;
  pending: boolean;
  onSubmit: (payload: Record<string, string | undefined>) => Promise<unknown>;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [cycleId, setCycleId] = useState(options?.cycle.id ?? "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState("Microsoft Teams (Online)");
  const [hrEmployeeId, setHrEmployeeId] = useState("");
  const [agenda, setAgenda] = useState("");

  const selected = options?.employees.find((employee) => employee.id === employeeId);
  const defaultHr = selected?.hr?.id ?? "";

  const hrChoices = useMemo(() => {
    const values = options?.employees.map((employee) => employee.hr).filter(Boolean) ?? [];
    const unique = new Map(values.map((hr) => [hr!.id, hr!]));
    return [...unique.values()];
  }, [options]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Schedule Meeting"
      description="Create the initial performance planning meeting for a team member."
      className="max-w-2xl"
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            employeeId,
            cycleId: cycleId || options?.cycle.id,
            date,
            startTime,
            endTime,
            location,
            hrEmployeeId: hrEmployeeId || defaultHr || undefined,
            agenda: agenda || undefined,
          }).then(() => onClose());
        }}
      >
        <label className="block text-sm">
          Employee
          <select className={`${fieldClass} mt-1`} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
            <option value="">Select employee</option>
            {options?.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.employeeId}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Appraisal Cycle
          <select className={`${fieldClass} mt-1`} value={cycleId || options?.cycle.id || ""} onChange={(event) => setCycleId(event.target.value)}>
            {options?.cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            Date
            <input className={`${fieldClass} mt-1`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="block text-sm">
            Start Time
            <input className={`${fieldClass} mt-1`} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
          </label>
          <label className="block text-sm">
            End Time
            <input className={`${fieldClass} mt-1`} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
          </label>
        </div>
        <label className="block text-sm">
          Meeting Location / Method
          <select className={`${fieldClass} mt-1`} value={location} onChange={(event) => setLocation(event.target.value)}>
            <option>Microsoft Teams (Online)</option>
            <option>Zoom (Online)</option>
            <option>In-person / Office</option>
          </select>
        </label>
        <label className="block text-sm">
          HR representative (optional)
          <select
            className={`${fieldClass} mt-1`}
            value={hrEmployeeId || defaultHr}
            onChange={(event) => setHrEmployeeId(event.target.value)}
          >
            <option value="">No HR invitation</option>
            {hrChoices.map((hr) => (
              <option key={hr.id} value={hr.id}>
                {hr.name} · {hr.employeeId}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Meeting agenda / notes
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Scheduling..." : "Schedule Meeting"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
