import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import type { PlanningOptions } from "../services/meetings.api";

export function ScheduleMeetingPanel({
  options,
  pending,
  defaultEmployeeId,
  defaultCycleId,
  onClose,
  onSubmit,
}: {
  options: PlanningOptions | undefined;
  pending: boolean;
  defaultEmployeeId?: string;
  defaultCycleId?: string;
  onClose: () => void;
  onSubmit: (payload: Record<string, string | undefined>) => Promise<unknown>;
}) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");
  const [cycleId, setCycleId] = useState(defaultCycleId || options?.cycle.id || "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState("Microsoft Teams (Online)");
  const [hrEmployeeId, setHrEmployeeId] = useState("");
  const [agenda, setAgenda] = useState("");

  useEffect(() => {
    if (defaultEmployeeId) setEmployeeId(defaultEmployeeId);
  }, [defaultEmployeeId]);

  const selected = options?.employees.find((employee) => employee.id === employeeId);
  const defaultHr = selected?.hr?.id ?? "";
  const hrChoices = useMemo(() => {
    const values = options?.employees.map((employee) => employee.hr).filter(Boolean) ?? [];
    const unique = new Map(values.map((hr) => [hr!.id, hr!]));
    return [...unique.values()];
  }, [options]);

  return (
    <aside className="flex h-full min-h-[640px] flex-col rounded-[28px] border border-stone-200 bg-white shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950">
      <div className="flex items-start justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Schedule Meeting</p>
          <h2 className="mt-1 text-lg font-semibold">Performance Planning</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-stone-400 hover:bg-stone-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form
        className="flex-1 space-y-3 overflow-y-auto p-5 text-sm"
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
        <label className="block">
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
        {selected ? (
          <div className="rounded-2xl bg-stone-50 p-3 text-stone-600 dark:bg-stone-900">
            <p>Employee ID: {selected.employeeId}</p>
            <p>Department: {selected.department?.name ?? "—"}</p>
            <p>Job title: {selected.jobTitle ?? "—"}</p>
          </div>
        ) : null}
        <label className="block">
          Appraisal Cycle
          <select className={`${fieldClass} mt-1`} value={cycleId || options?.cycle.id || ""} onChange={(event) => setCycleId(event.target.value)}>
            {options?.cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Meeting Date
          <input className={`${fieldClass} mt-1`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            Start Time
            <input className={`${fieldClass} mt-1`} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
          </label>
          <label className="block">
            End Time
            <input className={`${fieldClass} mt-1`} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
          </label>
        </div>
        <label className="block">
          Meeting method / location
          <select className={`${fieldClass} mt-1`} value={location} onChange={(event) => setLocation(event.target.value)}>
            <option>Microsoft Teams (Online)</option>
            <option>Zoom (Online)</option>
            <option>In-person / Office</option>
          </select>
        </label>
        <label className="block">
          HR representative (optional)
          <select className={`${fieldClass} mt-1`} value={hrEmployeeId || defaultHr} onChange={(event) => setHrEmployeeId(event.target.value)}>
            <option value="">No HR invitation</option>
            {hrChoices.map((hr) => (
              <option key={hr.id} value={hr.id}>{hr.name} · {hr.employeeId}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Meeting agenda / notes
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-950"
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Scheduling..." : "Schedule Meeting"}</Button>
        </div>
      </form>
    </aside>
  );
}
