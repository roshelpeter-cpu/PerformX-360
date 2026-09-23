import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Coins, Rocket, Star } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { formatShortDate, formatShortDateRange } from "@/features/hr/utils/dates";
import { getProfilePortraitUrl } from "@/features/profile/portrait";
import { ApiClientError } from "@/services/api/client";
import { awardsApi, type AwardBoard, type AwardRow } from "../services/awards.api";

type TabKey = "pending" | "approved" | "all" | "bonus";

function categoryLabel(category: string) {
  if (category === "OUTSTANDING_PERFORMER") return "Outstanding Performer";
  if (category === "EMPLOYEE_OF_THE_YEAR") return "Employee of the Year";
  if (category === "EMPLOYEE_OF_THE_MONTH") return "Employee of the Month";
  return category;
}

function statusBadge(status: string) {
  if (status === "APPROVED" || status === "SHORTLISTED" || status === "AUTHORIZED") {
    return "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800";
  }
  if (status === "REJECTED") {
    return "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800";
  }
  return "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800";
}

function statusLabel(status: string) {
  if (status === "APPROVED" || status === "SHORTLISTED" || status === "AUTHORIZED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Pending";
}

export default function AwardsRecognitionPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["awards"],
    queryFn: async () => (await awardsApi.list()).board,
  });
  const [tab, setTab] = useState<TabKey>("pending");
  const [selected, setSelected] = useState<AwardRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const generate = useMutation({
    mutationFn: async () => (await awardsApi.generate()).board,
    onSuccess: async (board) => {
      setMessage("Award recommendations generated from completed appraisal data.");
      await client.invalidateQueries({ queryKey: ["awards"] });
      if (board.awards[0]) setSelected(board.awards[0]);
    },
    onError: (error) =>
      setMessage(error instanceof ApiClientError ? error.message : "Unable to generate awards."),
  });
  const approve = useMutation({
    mutationFn: async (awardId: string) => (await awardsApi.approve(awardId)).award,
    onSuccess: async (award) => {
      setSelected(award);
      setMessage(`${award.employee.name} has been approved for ${award.title}.`);
      await client.invalidateQueries({ queryKey: ["awards"] });
    },
    onError: (error) =>
      setMessage(error instanceof ApiClientError ? error.message : "Unable to approve this award."),
  });

  const data = query.data;
  const pendingAwards = data?.awards.filter((row) => row.status === "PENDING") ?? [];
  const approvedAwards = data?.awards.filter((row) => row.status === "APPROVED") ?? [];

  const pendingRows = useMemo(() => {
    if (!data) return [];
    const awards = pendingAwards.map((row) => ({ ...row, kind: "AWARD" as const }));
    const bonuses = (data.bonuses ?? [])
      .filter((row) => row.status === "PENDING")
      .slice(0, 2)
      .map((row) => ({
        id: row.id,
        category: "PERFORMANCE_BONUS",
        title: row.title,
        reason: row.reason,
        finalScore: row.finalScore,
        performanceBand: row.performanceBand,
        status: "PENDING" as const,
        approvedAt: null,
        createdAt: "",
        nominatedBy: row.nominatedBy,
        employee: row.employee,
        approvedBy: null,
        kind: "BONUS" as const,
      }));
    const promotions = (data.promotions ?? [])
      .filter((row) => row.status === "PENDING")
      .slice(0, 2)
      .map((row) => ({
        id: row.id,
        category: "PROMOTION",
        title: row.title,
        reason: row.reason,
        finalScore: row.finalScore,
        performanceBand: row.performanceBand ?? "—",
        status: "PENDING" as const,
        approvedAt: null,
        createdAt: "",
        nominatedBy: row.nominatedBy,
        employee: row.employee,
        approvedBy: null,
        kind: "PROMOTION" as const,
      }));
    return [...awards, ...bonuses, ...promotions].filter((row) =>
      row.employee.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, pendingAwards, search]);

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !data ? (
        <DashboardError message="Unable to load awards and recognition." />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Awards & Rewards</h1>
              <p className="mt-1 max-w-3xl text-sm text-stone-500">
                Review and approve awards, bonuses and recognition for the current appraisal cycle.
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-xs">
              <p className="font-semibold text-stone-700">Appraisal Cycle</p>
              <p className="text-stone-500">{data.cycle.name}</p>
              {data.cycle.startDate && data.cycle.endDate ? (
                <p className="text-stone-400">{formatShortDateRange(data.cycle.startDate, data.cycle.endDate)}</p>
              ) : null}
            </div>
          </div>
          {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Summary icon={<Award className="h-5 w-5" />} value={data.summary?.awardNominations ?? data.awards.length} label="Award Nominations" hint={`${data.summary?.pendingAwards ?? pendingAwards.length} pending approval`} />
            <Summary icon={<Coins className="h-5 w-5" />} value={data.summary?.bonusRecommendations ?? (data.bonuses ?? []).length} label="Bonus Recommendations" hint="From completed appraisals" />
            <Summary icon={<Rocket className="h-5 w-5" />} value={data.summary?.promotionRecommendations ?? (data.promotions ?? []).length} label="Promotion Recommendations" hint="Supervisor cases" />
            <Summary icon={<Star className="h-5 w-5" />} value={data.summary?.recognitionsThisMonth ?? 0} label="Recognitions This Month" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "pending", label: "Pending Approval", count: pendingRows.length },
                { key: "approved", label: "Approved", count: approvedAwards.length },
                { key: "all", label: "All Awards", count: data.awards.length },
                { key: "bonus", label: "Bonus & Promotions", count: (data.bonuses ?? []).length + (data.promotions ?? []).length },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm ${
                    tab === item.key ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
                  }`}
                  onClick={() => setTab(item.key as TabKey)}
                >
                  {item.label}
                  {item.key === "pending" && item.count > 0 ? (
                    <span className="ml-2 rounded-full bg-amber-400 px-1.5 text-xs text-stone-900">{item.count}</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employees..."
                className="h-10 rounded-xl border border-stone-200 px-3 text-sm"
              />
              <Button
                type="button"
                className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                disabled={generate.isPending}
                onClick={() => generate.mutate()}
              >
                Generate Recommendations
              </Button>
            </div>
          </div>

          {tab !== "bonus" ? (
            <AwardTable
              rows={
                tab === "pending"
                  ? pendingRows
                  : tab === "approved"
                    ? approvedAwards.filter((row) => row.employee.name.toLowerCase().includes(search.toLowerCase()))
                    : data.awards.filter((row) => row.employee.name.toLowerCase().includes(search.toLowerCase()))
              }
              showApprove={tab === "pending"}
              onView={(row) => {
                if ("category" in row && row.category !== "PERFORMANCE_BONUS" && row.category !== "PROMOTION") {
                  setSelected(row as AwardRow);
                } else if ("kind" in row && row.kind === "AWARD") {
                  setSelected(row as AwardRow);
                } else {
                  setSelected(row as AwardRow);
                }
              }}
              onApprove={(row) => {
                if (row.category === "PERFORMANCE_BONUS" || row.category === "PROMOTION") return;
                approve.mutate(row.id);
              }}
              pending={approve.isPending}
            />
          ) : (
            <BonusPromoTable board={data} />
          )}

          <section className="rounded-3xl bg-[#fff8e8] px-6 py-5">
            <p className="font-semibold text-stone-900">Recognise People. Build a Stronger Tomorrow.</p>
            <p className="mt-1 text-sm text-stone-500">Celebrate achievements and inspire greater success across Altrium.</p>
          </section>
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        title={selected?.title ?? "Award summary"}
        description="Review the nomination details. Pending items can be approved here."
        onClose={() => setSelected(null)}
        className="max-w-2xl"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee" value={`${selected.employee.name} (${selected.employee.employeeId})`} />
              <Field label="Department" value={selected.employee.department} />
              <Field label="Award category" value={categoryLabel(selected.category)} />
              <Field label="Nominated by" value={selected.nominatedBy ?? "Supervisor"} />
              <Field label="Final score" value={`${selected.finalScore.toFixed(1)} / 100`} />
              <Field label="Performance band" value={selected.performanceBand} />
              <Field label="Current status" value={statusLabel(selected.status)} />
              <Field label="Approved by" value={selected.approvedBy?.name ?? "—"} />
            </div>
            <p className="text-sm text-stone-600">{selected.reason}</p>
            {selected.status !== "APPROVED" && selected.category !== "PERFORMANCE_BONUS" && selected.category !== "PROMOTION" ? (
              <Button
                type="button"
                className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                disabled={approve.isPending}
                onClick={() => approve.mutate(selected.id)}
              >
                Approve
              </Button>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </DashboardLayout>
  );
}

function AwardTable({
  rows,
  showApprove,
  onView,
  onApprove,
  pending,
}: {
  rows: AwardRow[];
  showApprove: boolean;
  onView: (row: AwardRow) => void;
  onApprove: (row: AwardRow) => void;
  pending: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">{showApprove ? "Category" : "Award"}</th>
              <th className="px-4 py-3">{showApprove ? "Nomination / Reason" : "Reason"}</th>
              <th className="px-4 py-3">{showApprove ? "Nominated By" : "Approved By"}</th>
              {!showApprove ? <th className="px-4 py-3">Approval Date</th> : null}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-stone-500" colSpan={8}>
                  No records in this view.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.category}-${row.id}`} className="border-t border-stone-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={getProfilePortraitUrl(row.employee.employeeId)}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium">{row.employee.name}</p>
                        <p className="text-xs text-stone-400">{row.employee.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.employee.department}</td>
                  <td className="px-4 py-3">{categoryLabel(row.category)}</td>
                  <td className="max-w-xs px-4 py-3 text-stone-600">{row.reason}</td>
                  <td className="px-4 py-3">{showApprove ? row.nominatedBy ?? "Supervisor" : row.approvedBy?.name ?? "—"}</td>
                  {!showApprove ? <td className="px-4 py-3">{row.approvedAt ? formatShortDate(row.approvedAt) : "—"}</td> : null}
                  <td className="px-4 py-3">
                    <span className={statusBadge(row.status)}>{statusLabel(row.status)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onView(row)}>
                        View
                      </Button>
                      {showApprove && row.status !== "APPROVED" && row.category !== "PERFORMANCE_BONUS" && row.category !== "PROMOTION" ? (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                          disabled={pending}
                          onClick={() => onApprove(row)}
                        >
                          Approve
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BonusPromoTable({ board }: { board: AwardBoard }) {
  const rows = [
    ...(board.bonuses ?? []).map((row) => ({
      id: row.id,
      employee: row.employee,
      type: "Bonus",
      recommendation: row.title,
      reason: row.reason,
      amount: `Rs. ${Math.round(row.amount).toLocaleString()}`,
      status: row.status,
    })),
    ...(board.promotions ?? []).map((row) => ({
      id: row.id,
      employee: row.employee,
      type: "Promotion",
      recommendation: row.title,
      reason: row.reason,
      amount: String(row.finalScore),
      status: row.status,
    })),
  ];
  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Recommendation</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Amount / Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-stone-500" colSpan={8}>
                  No bonus or promotion records for this cycle.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium">
                    {row.employee.name}
                    <p className="text-xs text-stone-400">{row.employee.employeeId}</p>
                  </td>
                  <td className="px-4 py-3">{row.employee.department}</td>
                  <td className="px-4 py-3">{row.type}</td>
                  <td className="px-4 py-3">{row.recommendation}</td>
                  <td className="max-w-xs px-4 py-3 text-stone-600">{row.reason}</td>
                  <td className="px-4 py-3">{row.amount}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(row.status)}>{statusLabel(row.status)}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-400">View</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Summary({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">{icon}</div>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{label}</p>
      {hint ? <p className="mt-1 text-xs text-stone-400">{hint}</p> : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
