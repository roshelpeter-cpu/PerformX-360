import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { ApiClientError } from "@/services/api/client";
import { reviewsApi } from "../services/reviews.api";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "Peer Selection In Progress",
  SELECTED: "Peers Selected",
};

export default function HrPeerReviewPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const directory = useQuery({
    queryKey: ["peer-review", "directory"],
    queryFn: async () => (await reviewsApi.peerDirectory()).directory,
  });
  const selection = useQuery({
    queryKey: ["peer-review", "selection", selectedId],
    queryFn: async () => (await reviewsApi.peerSelection(selectedId as string)).selection,
    enabled: Boolean(selectedId),
  });

  const generate = useMutation({
    mutationFn: async () => reviewsApi.generatePeers(selectedId as string),
    onSuccess: async () => {
      setPicked([]);
      setMessage(null);
      await client.invalidateQueries({ queryKey: ["peer-review"] });
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to generate recommendations."),
  });
  const choose = useMutation({
    mutationFn: async () => reviewsApi.selectPeers(selectedId as string, picked),
    onSuccess: async () => {
      setMessage("Two peers selected.");
      await client.invalidateQueries({ queryKey: ["peer-review"] });
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Select exactly two peers."),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (directory.data?.departments ?? [])
      .map((department) => ({
        ...department,
        teams: department.teams
          .map((team) => ({
            ...team,
            employees: team.employees.filter((employee) =>
              !term
                ? true
                : `${employee.name} ${employee.employeeId} ${team.name} ${department.name}`.toLowerCase().includes(term)
            ),
          }))
          .filter((team) => team.employees.length > 0),
      }))
      .filter((department) => department.teams.length > 0);
  }, [directory.data, search]);

  return (
    <DashboardLayout>
      {directory.isLoading ? (
        <DashboardLoading />
      ) : directory.isError ? (
        <DashboardError message="Unable to load peer review." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Peer Review</h1>
              <p className="mt-1 text-sm text-stone-500">
                Choose a department, team, and employee. Generate five recommendations, then select exactly two peers.
              </p>
              <p className="text-xs text-stone-400">{directory.data?.cycle.name}</p>
            </div>
            <input
              className="h-10 w-full max-w-md rounded-xl border border-stone-200 px-3 text-sm"
              placeholder="Search employee, team, or department"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {filtered.map((department) => (
              <section key={department.name} className="rounded-2xl border border-stone-200 bg-white p-4">
                <h2 className="font-semibold">{department.name}</h2>
                {department.teams.map((team) => (
                  <div key={team.name} className="mt-3">
                    <p className="text-sm font-medium text-stone-700">{team.name}</p>
                    <ul className="mt-1 divide-y divide-stone-100">
                      {team.employees.map((employee) => (
                        <li key={employee.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                          <div>
                            <p className="font-medium">{employee.name}</p>
                            <p className="text-xs text-stone-500">
                              {employee.employeeId} · {STATUS_LABEL[employee.selectionStatus] ?? employee.selectionStatus}
                              {employee.selectedPeers.length
                                ? ` · ${employee.selectedPeers.map((peer) => peer.name).join(", ")}`
                                : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedId === employee.id ? "default" : "outline"}
                            onClick={() => {
                              setSelectedId(employee.id);
                              setPicked([]);
                              setMessage(null);
                            }}
                          >
                            Select
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>

          <aside className="rounded-2xl border border-stone-200 bg-white p-4 xl:sticky xl:top-4 xl:self-start">
            {!selectedId ? (
              <p className="text-sm text-stone-500">Select an employee to generate peer recommendations.</p>
            ) : selection.isLoading ? (
              <p className="text-sm text-stone-500">Loading recommendations...</p>
            ) : selection.data ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">Employee</p>
                  <p className="font-semibold">{selection.data.subject.name}</p>
                  <p className="text-sm text-stone-500">
                    {STATUS_LABEL[selection.data.status] ?? selection.data.status}
                  </p>
                </div>
                <Button type="button" className="bg-amber-400 text-stone-900 hover:bg-amber-300" disabled={generate.isPending} onClick={() => generate.mutate()}>
                  {generate.isPending ? "Generating..." : "Generate Recommendation"}
                </Button>
                <ul className="space-y-2">
                  {selection.data.recommendations.map((peer, index) => {
                    const checked = picked.includes(peer.id) || (picked.length === 0 && peer.selected);
                    return (
                      <li key={peer.id} className="rounded-xl border border-stone-100 px-3 py-2 text-sm">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={picked.length > 0 ? picked.includes(peer.id) : Boolean(peer.selected)}
                            onChange={() => {
                              setPicked((current) => {
                                const base = current.length > 0 ? current : selection.data.recommendations.filter((item) => item.selected).map((item) => item.id);
                                return base.includes(peer.id) ? base.filter((id) => id !== peer.id) : [...base, peer.id].slice(0, 2);
                              });
                            }}
                          />
                          <span>
                            <span className="font-medium">
                              {peer.selected ? `Selected Peer ${selection.data.recommendations.filter((item) => item.selected).findIndex((item) => item.id === peer.id) + 1}` : `Recommendation ${index + 1}`}
                            </span>
                            <span className="block text-stone-600">
                              {peer.name} · {peer.employeeId}
                            </span>
                            <span className="block text-xs text-stone-500">
                              {peer.department} · {peer.team} · {peer.jobTitle ?? "Employee"}
                            </span>
                          </span>
                        </label>
                        {checked && peer.selected ? null : null}
                      </li>
                    );
                  })}
                </ul>
                <Button type="button" disabled={picked.length !== 2 || choose.isPending} onClick={() => choose.mutate()}>
                  Confirm 2 peers
                </Button>
                {message ? <p className="text-sm text-stone-700">{message}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-rose-700">Unable to load this employee.</p>
            )}
          </aside>
        </div>
      )}
    </DashboardLayout>
  );
}
