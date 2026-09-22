import { X } from "lucide-react";
import { usePreviousAppraisal } from "../hooks/useMeetings";
import type { MeetingPerson } from "../services/meetings.api";

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

export function PreviousAppraisalPanel({
  employee,
  onClose,
}: {
  employee: MeetingPerson & { department?: { id: string; name: string } | null };
  onClose: () => void;
}) {
  const query = usePreviousAppraisal(employee.id);
  const appraisal = query.data?.previousAppraisal ?? null;

  return (
    <aside className="flex h-full min-h-[640px] flex-col rounded-[28px] border border-stone-200 bg-white shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950">
      <div className="flex items-start justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-400">Last Year&apos;s Appraisal</p>
          <h2 className="mt-1 text-lg font-semibold">{employee.name}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-stone-400 hover:bg-stone-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
        <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-900">
          <Info label="Employee" value={employee.name} />
          <p className="mt-2 text-stone-500">{employee.employeeId}</p>
        </div>
        {query.isLoading ? <p className="text-stone-500">Loading previous appraisal...</p> : null}
        {!query.isLoading && !appraisal ? (
          <p className="text-stone-500">No previous appraisal is available for this employee.</p>
        ) : null}
        {appraisal ? (
          <div className="space-y-3">
            <Info label="Previous appraisal cycle" value={appraisal.cycle.name} />
            <Info label="Previous appraisal result" value={appraisal.overallResult} />
            <Info label="Rating" value={appraisal.ratingBand ?? "—"} />
            <Info label="Score / percentage" value={appraisal.overallScore != null ? String(appraisal.overallScore) : "—"} />
            <NoteBlock label="Achievements / strengths" value={appraisal.achievements} />
            <NoteBlock label="Areas for improvement" value={appraisal.areasForImprovement} />
            <NoteBlock label="Supervisor comments" value={appraisal.supervisorComments} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
