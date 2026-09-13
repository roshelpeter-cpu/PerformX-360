import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileEdit,
  Plus,
  Users2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActiveCycleSummaryCard from "@/features/hr/components/ActiveCycleSummaryCard";
import { ActionMenu, fieldClass } from "@/features/hr/components/ActionMenu";
import CreateCycleDialog from "@/features/hr/components/CreateCycleDialog";
import {
  ActivateCycleDialog,
  CompleteCycleDialog,
  ConfirmCycleDialog,
  DeleteDraftCycleDialog,
} from "@/features/hr/components/CycleActionDialogs";
import { StatusBadge } from "@/features/hr/components/StatusBadge";
import {
  useAppraisalCycles,
  useRecentCycleActivity,
  useWorkforceSummary,
} from "@/features/hr/hooks/useAppraisalCycles";
import type { AppraisalCycle } from "@/features/hr/types";
import {
  formatShortDate,
  formatShortDateRange,
} from "@/features/hr/utils/dates";

const TABS = ["All Cycles", "Active", "Upcoming", "Completed", "Drafts"] as const;

export default function AppraisalCyclesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All Cycles");
  const [selected, setSelected] = useState<AppraisalCycle | null>(null);
  const [actionCycle, setActionCycle] = useState<AppraisalCycle | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();

  const allCyclesQuery = useAppraisalCycles();
  const workforceQuery = useWorkforceSummary();
  const activityQuery = useRecentCycleActivity();

  const allCycles = allCyclesQuery.data ?? [];
  const workforce = workforceQuery.data;
  const activities = activityQuery.data ?? [];

  useEffect(() => {
    if (!selected && allCycles.length > 0) {
      const preferred =
        allCycles.find((cycle) => cycle.status === "ACTIVE") ?? allCycles[0]!;
      setSelected(preferred);
    }
  }, [allCycles, selected]);

  const years = useMemo(
    () =>
      Array.from(new Set(allCycles.map((cycle) => cycle.year))).sort(
        (a, b) => b - a
      ),
    [allCycles]
  );

  const counts = {
    active: workforce?.activeCycles ?? 0,
    upcoming: workforce?.upcomingCycles ?? 0,
    completed: workforce?.completedCycles ?? 0,
    drafts: workforce?.draftCycles ?? 0,
    employees: workforce?.totalAssignableEmployees ?? 0,
  };

  const displayedCycles = useMemo(() => {
    let filtered = allCycles;
    if (activeTab === "Active") {
      filtered = filtered.filter((cycle) => cycle.status === "ACTIVE");
    } else if (activeTab === "Upcoming") {
      filtered = filtered.filter((cycle) => cycle.status === "UPCOMING");
    } else if (activeTab === "Completed") {
      filtered = filtered.filter((cycle) => cycle.status === "COMPLETED");
    } else if (activeTab === "Drafts") {
      filtered = filtered.filter((cycle) => cycle.status === "DRAFT");
    }
    if (status !== "ALL") {
      filtered = filtered.filter((cycle) => cycle.status === status);
    }
    if (year !== "ALL") {
      filtered = filtered.filter((cycle) => String(cycle.year) === year);
    }
    if (search.trim()) {
      const needle = search.toLowerCase();
      filtered = filtered.filter((cycle) =>
        cycle.name.toLowerCase().includes(needle)
      );
    }
    return filtered;
  }, [allCycles, activeTab, status, search, year]);

  function openAction(
    cycle: AppraisalCycle,
    action: "confirm" | "activate" | "complete" | "delete"
  ) {
    setActionCycle(cycle);
    if (action === "confirm") setConfirmOpen(true);
    if (action === "activate") setActivateOpen(true);
    if (action === "complete") setCompleteOpen(true);
    if (action === "delete") setDeleteOpen(true);
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <nav className="flex items-center space-x-2 text-sm text-stone-500">
          <Link to="/hr/dashboard" className="hover:text-stone-900">
            HR
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>Appraisal Management</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-stone-900 dark:text-stone-100">
            Appraisal Cycles
          </span>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">
              Appraisal Cycles
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Create, manage and monitor appraisal cycles across the organization.
            </p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Cycle
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            icon={<CalendarDays className="h-6 w-6" />}
            iconClass="bg-amber-100 text-amber-600"
            value={counts.active}
            label="Active Cycle"
            hint="Currently running"
          />
          <SummaryCard
            icon={<CalendarCheck className="h-6 w-6" />}
            iconClass="bg-sky-100 text-sky-600"
            value={counts.upcoming}
            label="Upcoming Cycle"
            hint="Starting soon"
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-6 w-6" />}
            iconClass="bg-emerald-100 text-emerald-600"
            value={counts.completed}
            label="Completed Cycles"
            hint="In the system"
          />
          <SummaryCard
            icon={<FileEdit className="h-6 w-6" />}
            iconClass="bg-stone-100 text-stone-600"
            value={counts.drafts}
            label="Draft Cycle"
            hint="Not started"
          />
          <SummaryCard
            icon={<Users2 className="h-6 w-6" />}
            iconClass="bg-stone-100 text-stone-600"
            value={counts.employees}
            label="Total Employees"
            hint="Across the organization"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900 lg:col-span-2">
            <div className="border-b border-stone-200 px-2 pt-2 dark:border-stone-800">
              <div className="flex overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "border-b-2 border-amber-400 text-stone-900 dark:text-white"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cycles..."
                className="h-9 w-full sm:w-56"
              />
              <select
                className={`${fieldClass} h-9 w-36`}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <select
                className={`${fieldClass} h-9 w-32`}
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="ALL">All Years</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto px-4 pb-4">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-stone-100 text-xs font-medium text-stone-500 dark:border-stone-800">
                  <tr>
                    <th className="px-3 py-3">Cycle Name</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Employees</th>
                    <th className="px-3 py-3">Progress</th>
                    <th className="px-3 py-3">Created On</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allCyclesQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-500">
                        Loading cycles...
                      </td>
                    </tr>
                  ) : allCyclesQuery.isError ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-red-600">
                        Unable to load appraisal cycles from the server.
                      </td>
                    </tr>
                  ) : displayedCycles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-500">
                        No cycles found.
                      </td>
                    </tr>
                  ) : (
                    displayedCycles.map((cycle) => {
                      const progress = cycle.progress;
                      const selectedRow = selected?.id === cycle.id;
                      return (
                        <tr
                          key={cycle.id}
                          onClick={() => setSelected(cycle)}
                          className={`cursor-pointer border-b border-stone-50 last:border-0 dark:border-stone-800/50 ${
                            selectedRow ? "bg-amber-50/60 dark:bg-amber-400/5" : ""
                          }`}
                        >
                          <td className="px-3 py-4 font-semibold text-stone-900 dark:text-stone-100">
                            {cycle.name}
                          </td>
                          <td className="px-3 py-4 text-stone-600">
                            {formatShortDateRange(cycle.startDate, cycle.endDate)}
                          </td>
                          <td className="px-3 py-4">
                            <StatusBadge status={cycle.status} />
                          </td>
                          <td className="px-3 py-4 text-stone-600">
                            {progress.completed + progress.inProgress} /{" "}
                            {progress.totalEmployees}
                          </td>
                          <td className="px-3 py-4">
                            <div className="w-28">
                              <p className="text-xs font-medium">
                                {progress.progressPercent}%
                              </p>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                                <div
                                  className={`h-full ${
                                    progress.progressPercent >= 100
                                      ? "bg-emerald-500"
                                      : progress.progressPercent > 0
                                        ? "bg-amber-400"
                                        : "bg-stone-300"
                                  }`}
                                  style={{
                                    width: `${progress.progressPercent}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-stone-600">
                            {formatShortDate(cycle.createdAt)}
                          </td>
                          <td
                            className="px-3 py-4 text-right"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ActionMenu
                              items={[
                                {
                                  label: "View details",
                                  onClick: () =>
                                    navigate(`/hr/appraisal-cycles/${cycle.id}`),
                                },
                                {
                                  label: "Submit",
                                  hidden: cycle.status !== "DRAFT",
                                  onClick: () => openAction(cycle, "confirm"),
                                },
                                {
                                  label: "Activate",
                                  hidden: cycle.status !== "UPCOMING",
                                  onClick: () => openAction(cycle, "activate"),
                                },
                                {
                                  label: "Complete",
                                  hidden: cycle.status !== "ACTIVE",
                                  onClick: () => openAction(cycle, "complete"),
                                },
                                {
                                  label: "Delete",
                                  hidden: cycle.status !== "DRAFT",
                                  onClick: () => openAction(cycle, "delete"),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            {selected ? (
              <ActiveCycleSummaryCard cycle={selected} />
            ) : (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-500 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                Select a cycle to preview details.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
            <h3 className="font-semibold text-stone-900 dark:text-stone-100">
              Recent Activity
            </h3>
            <span className="text-xs text-stone-500">View All</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-stone-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {activityQuery.isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-stone-500">
                      Loading activity...
                    </td>
                  </tr>
                ) : activities.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-stone-500">
                      No recent activity.
                    </td>
                  </tr>
                ) : (
                  activities.slice(0, 8).map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-stone-50 dark:border-stone-800/60"
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-stone-600">
                        {formatShortDate(item.date)}
                      </td>
                      <td className="px-5 py-3">{item.user.name}</td>
                      <td className="px-5 py-3 font-medium">{item.action}</td>
                      <td className="px-5 py-3 text-stone-600">{item.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreateCycleDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {actionCycle ? (
        <>
          <ConfirmCycleDialog
            cycle={actionCycle}
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
          />
          <ActivateCycleDialog
            cycle={actionCycle}
            open={activateOpen}
            onClose={() => setActivateOpen(false)}
          />
          <CompleteCycleDialog
            cycle={actionCycle}
            open={completeOpen}
            onClose={() => setCompleteOpen(false)}
          />
          <DeleteDraftCycleDialog
            cycle={actionCycle}
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
          />
        </>
      ) : null}
    </DashboardLayout>
  );
}

function SummaryCard({
  icon,
  iconClass,
  value,
  label,
  hint,
}: {
  icon: ReactNode;
  iconClass: string;
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className={`rounded-full p-3 ${iconClass}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
          {value}
        </div>
        <div className="text-sm font-medium text-stone-900 dark:text-stone-200">
          {label}
        </div>
        <div className="text-xs text-stone-500">{hint}</div>
      </div>
    </div>
  );
}
