import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { ApiClientError } from "@/services/api/client";
import { useAuthStore } from "@/store/authStore";
import { formatShortDate } from "@/features/hr/utils/dates";
import { promotionsApi, type PromotionItem } from "../services/reviews.api";

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-900",
  SHORTLISTED: "bg-emerald-50 text-emerald-800",
  REJECTED: "bg-rose-50 text-rose-800",
};

export default function PromotionRecommendationsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canDecide = role === "HR";
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => (await promotionsApi.list()),
  });
  const [selected, setSelected] = useState<PromotionItem | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: async (action: "shortlist" | "reject") => {
      if (!selected) throw new Error("Select a recommendation");
      return action === "shortlist"
        ? promotionsApi.shortlist(selected.id, reason)
        : promotionsApi.reject(selected.id, reason);
    },
    onSuccess: async (result) => {
      setSelected(result.recommendation);
      setReason("");
      setMessage(result.recommendation.status === "SHORTLISTED" ? "Shortlisted." : "Rejected.");
      await client.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to save the decision."),
  });

  const items = query.data?.items ?? [];

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError ? (
        <DashboardError message="Unable to load promotion recommendations." />
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Promotion Recommendations</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              {canDecide
                ? "Review supervisor recommendations. Shortlist and reject both require a written reason."
                : "Organisation view of supervisor promotion recommendations. Decisions stay with HR."}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Employee ID</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Supervisor</th>
                  <th className="px-3 py-2">Current PDP score</th>
                  <th className="px-3 py-2">Performance band</th>
                  <th className="px-3 py-2">Recommendation date</th>
                  <th className="px-3 py-2">Supervisor reason</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-stone-100">
                    <td className="px-3 py-3 font-medium">{item.employee.name}</td>
                    <td className="px-3 py-3">{item.employee.employeeId}</td>
                    <td className="px-3 py-3">{item.employee.department}</td>
                    <td className="px-3 py-3">{item.employee.team}</td>
                    <td className="px-3 py-3">{item.supervisor.name}</td>
                    <td className="px-3 py-3">{item.pdpScore.toFixed(1)} / 100</td>
                    <td className="px-3 py-3">{item.scores?.band ?? item.band ?? "—"}</td>
                    <td className="px-3 py-3">{formatShortDate(item.createdAt)}</td>
                    <td className="max-w-xs px-3 py-3 text-stone-600">{item.reason}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[item.status] ?? ""}`}>
                        {item.status === "PENDING" ? "Pending HR Review" : item.status === "SHORTLISTED" ? "Shortlisted" : "Rejected"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Button type="button" size="sm" variant="outline" onClick={() => { setSelected(item); setMessage(null); setReason(""); }}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-400">Recommendation</p>
                <h2 className="text-xl font-semibold">{selected.employee.name}</h2>
                <p className="text-sm text-stone-500">
                  {selected.employee.employeeId} · {selected.employee.department} · {selected.employee.team} · Supervisor {selected.supervisor.name}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ["PDP score", `${selected.pdpScore.toFixed(1)} / 100`],
                  ["PDP completion", `${selected.pdpProgress ?? 0}%`],
                  ["Self", `${(selected.scores?.self ?? 0).toFixed(1)} / 20`],
                  ["Peer", `${(selected.scores?.peer ?? 0).toFixed(1)} / 20`],
                  ["Supervisor / PDP", `${(selected.scores?.supervisorPdp ?? 0).toFixed(1)} / 60`],
                  ["Final", `${(selected.scores?.total ?? 0).toFixed(1)} / 100`],
                  ["Band", selected.scores?.band ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-stone-50 px-3 py-3">
                    <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm"><span className="font-medium">Supervisor reason: </span>{selected.reason}</p>
              {selected.hrReason ? (
                <p className="text-sm">
                  <span className="font-medium">{selected.status === "REJECTED" ? "Rejection reason" : "HR decision"}: </span>
                  {selected.hrReason}
                  {selected.decidedAt ? ` · ${formatShortDate(selected.decidedAt)}` : ""}
                </p>
              ) : null}
              {canDecide && selected.status === "PENDING" ? (
                <div className="rounded-xl border border-stone-200 p-3">
                  <label className="block text-sm font-medium">
                    HR decision reason
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Required before shortlist or reject"
                    />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" className="bg-amber-400 text-stone-900 hover:bg-amber-300" disabled={decide.isPending || reason.trim().length < 8} onClick={() => decide.mutate("shortlist")}>
                      Shortlist
                    </Button>
                    <Button type="button" variant="outline" disabled={decide.isPending || reason.trim().length < 8} onClick={() => decide.mutate("reject")}>
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
              {message ? <p className="text-sm text-stone-700">{message}</p> : null}
            </section>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  );
}
