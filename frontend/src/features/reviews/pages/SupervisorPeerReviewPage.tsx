import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { reviewsApi } from "../services/reviews.api";

function slotLabel(slot: { status: string; score: number | null }) {
  if (slot.status === "Completed") return `Completed ${slot.score?.toFixed(0) ?? 0}/10`;
  if (slot.status === "Not Completed") return "Not Completed Pending";
  return slot.status;
}

export default function SupervisorPeerReviewPage() {
  const query = useQuery({
    queryKey: ["peer-review", "team"],
    queryFn: async () => (await reviewsApi.teamPeerBoard()).board,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = query.data?.employees.find((employee) => employee.id === openId) ?? null;

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !query.data ? (
        <DashboardError message="Unable to load peer reviews for your team." />
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Peer Review</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Peer status for your team. HR selects the two peers. You can view identities and scores, and you cannot change the selection.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Employee ID</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Peer 1</th>
                  <th className="px-3 py-2">Peer 2</th>
                  <th className="px-3 py-2">Review Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {query.data.employees.map((employee) => (
                  <tr key={employee.id} className="border-t border-stone-100">
                    <td className="px-3 py-3 font-medium">{employee.name}</td>
                    <td className="px-3 py-3">{employee.employeeId}</td>
                    <td className="px-3 py-3">{employee.team}</td>
                    <td className="px-3 py-3">{employee.peer1.name}</td>
                    <td className="px-3 py-3">{employee.peer2.name}</td>
                    <td className="px-3 py-3">{employee.reviewStatus}</td>
                    <td className="px-3 py-3">
                      <Button type="button" size="sm" className="bg-amber-400 text-stone-900 hover:bg-amber-300" onClick={() => setOpenId(employee.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-stone-400">Peer review detail</p>
              <h2 className="text-xl font-semibold">{selected.name}</h2>
              <p className="text-sm text-stone-500">{selected.employeeId} · {selected.team}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[selected.peer1, selected.peer2].map((peer, index) => (
                  <div key={peer.employeeId + index} className="rounded-xl border border-stone-100 px-3 py-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-stone-400">Peer {index + 1}</p>
                    <p className="mt-1 font-medium">{peer.name}</p>
                    <p className="text-stone-500">{peer.employeeId}</p>
                    <p className="mt-2">{slotLabel(peer)}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  );
}
