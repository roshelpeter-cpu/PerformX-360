import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, Search } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { PdpStatusBadge } from "@/features/pdp/components/PdpStatusBadge";
import { EmployeeActivePdpDashboard } from "@/features/pdp/components/EmployeeActivePdpDashboard";
import { useEmployeePdp, usePdpBoard } from "@/features/pdp/hooks/usePdp";
import type { PdpDetail } from "@/features/pdp/services/pdp.api";
import { ApiClientError } from "@/services/api/client";
import { EvaluationPackageCard } from "../components/EvaluationPackageCard";
import { promotionsApi } from "../services/reviews.api";

export default function SupervisorReviewPage() {
  const { employeeId } = useParams<{ employeeId?: string }>();
  if (employeeId) return <SupervisorReviewDetail employeeId={employeeId} />;
  return <SupervisorReviewList />;
}

function SupervisorReviewList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const board = usePdpBoard({ page: 1, pageSize: 200, search: search || undefined }, true);
  const rows = useMemo(
    () =>
      (board.data?.items ?? []).filter((row) => {
        const progress = row.pdp?.overallProgress ?? 0;
        const status = row.pdp?.status ?? "";
        return Boolean(row.pdp) && progress >= 80 && ["ACTIVE", "APPROVED", "COMPLETED"].includes(status);
      }),
    [board.data]
  );

  return (
    <DashboardLayout>
      {board.isLoading ? (
        <DashboardLoading />
      ) : board.isError || !board.data ? (
        <DashboardError message="Unable to load supervisor review." />
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Supervisor Review</h1>
            <p className="mt-1 text-sm text-stone-500">
              Employees whose active PDP is in the final stage and ready for supervisor review.
            </p>
          </div>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              className="h-10 w-full rounded-xl border border-stone-200 pl-9 pr-3 text-sm"
              placeholder="Search employee"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Employee ID</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">PDP status</th>
                  <th className="px-3 py-2">PDP progress</th>
                  <th className="px-3 py-2">PDP score</th>
                  <th className="px-3 py-2">Evaluation status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-stone-500" colSpan={9}>No final-stage PDPs are ready for supervisor review.</td>
                  </tr>
                ) : null}
                {rows.map((row) => (
                  <tr key={row.employee.id} className="border-t border-stone-100">
                    <td className="px-3 py-3 font-medium">{row.employee.name}</td>
                    <td className="px-3 py-3">{row.employee.employeeId}</td>
                    <td className="px-3 py-3">{row.employee.department?.name ?? "—"}</td>
                    <td className="px-3 py-3">{row.employee.team?.name ?? "—"}</td>
                    <td className="px-3 py-3">{row.pdp ? <PdpStatusBadge status={row.pdp.status} /> : "Not Started"}</td>
                    <td className="px-3 py-3">{row.pdp ? `${row.pdp.overallProgress ?? 0}%` : "—"}</td>
                    <td className="px-3 py-3">{row.pdp ? `${(row.pdp.earnedPoints ?? 0).toFixed(1)} / 100` : "—"}</td>
                    <td className="px-3 py-3">{(row.pdp?.pendingReviews ?? 0) > 0 ? "Awaiting Supervisor Approval" : "Ready for review"}</td>
                    <td className="px-3 py-3">
                      <Button type="button" size="sm" className="bg-amber-400 text-stone-900 hover:bg-amber-300" onClick={() => navigate(`/supervisor/review/${row.employee.id}`)}>
                        <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function SupervisorReviewDetail({ employeeId }: { employeeId: string }) {
  const pdpQuery = useEmployeePdp(employeeId);
  const [localPdp, setLocalPdp] = useState<PdpDetail | null>(null);
  const pdp = localPdp ?? pdpQuery.data ?? null;

  return (
    <DashboardLayout>
      <div className="mb-4">
        <Link to="/supervisor/review" className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Supervisor Review
        </Link>
      </div>
      <EvaluationPackageCard employeeId={employeeId} canDecide />
      <PromotionRecommend employeeId={employeeId} />
      {pdpQuery.isLoading && !pdp ? (
        <DashboardLoading />
      ) : pdp ? (
        <EmployeeActivePdpDashboard pdp={pdp} mode="supervisor" onPdpChange={setLocalPdp} />
      ) : (
        <DashboardError message="This employee does not have a PDP in the active cycle." />
      )}
    </DashboardLayout>
  );
}

function PromotionRecommend({ employeeId }: { employeeId: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const existing = useQuery({
    queryKey: ["promotions", "mine"],
    queryFn: async () => (await promotionsApi.list()).items,
  });
  const current = existing.data?.find((item) => item.employee.id === employeeId) ?? null;
  const recommend = useMutation({
    mutationFn: async () => promotionsApi.recommend({ employeeId, reason }),
    onSuccess: async () => {
      setOpen(false);
      setReason("");
      setMessage("Promotion Recommended");
      await client.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to save the recommendation."),
  });

  if (current) {
    return (
      <section className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Promotion Recommended. Reason on file: {current.reason}
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-2xl border border-stone-200 bg-white p-4">
      <Button type="button" className="bg-amber-400 text-stone-900 hover:bg-amber-300" onClick={() => setOpen(true)}>
        Recommend for Promotion
      </Button>
      {open ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            recommend.mutate();
          }}
        >
          <label className="block text-sm font-medium">
            Reason for recommendation
            <textarea
              required
              minLength={8}
              className="mt-1 min-h-24 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Button type="submit" className="bg-stone-900 text-white hover:bg-stone-800" disabled={recommend.isPending || reason.trim().length < 8}>
            {recommend.isPending ? "Saving..." : "Submit recommendation"}
          </Button>
        </form>
      ) : null}
      {message ? <p className="mt-2 text-sm font-medium text-stone-700">{message}</p> : null}
    </section>
  );
}
