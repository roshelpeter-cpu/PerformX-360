import { Button } from "@/components/ui/button";
import type { GoalInput } from "../services/pdp.api";
import { emptyMainGoal, emptySubGoal } from "../utils/goalDefaults";

const fieldClass =
  "mt-1 h-10 w-full rounded-lg border border-stone-300 px-3 dark:border-stone-700 dark:bg-stone-900";
const areaClass =
  "mt-1 min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900";

export function GoalEditor({
  goals,
  onChange,
  editable,
}: {
  goals: GoalInput[];
  onChange: (goals: GoalInput[]) => void;
  editable: boolean;
}) {
  const updateGoal = (index: number, patch: Partial<GoalInput>) => {
    onChange(goals.map((goal, i) => (i === index ? { ...goal, ...patch } : goal)));
  };

  const updateSub = (
    goalIndex: number,
    subIndex: number,
    patch: Partial<NonNullable<GoalInput["subGoals"]>[number]>
  ) => {
    onChange(
      goals.map((goal, i) => {
        if (i !== goalIndex) return goal;
        const subGoals = [...(goal.subGoals ?? [])];
        subGoals[subIndex] = { ...subGoals[subIndex]!, ...patch };
        return { ...goal, subGoals };
      })
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Main Goals & Sub-goals</h3>
        {editable && goals.length < 5 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...goals, emptyMainGoal(goals.length)])}
          >
            + Add Main Goal
          </Button>
        ) : null}
      </div>

      {goals.map((goal, goalIndex) => (
        <section
          key={goal.id ?? goalIndex}
          className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Main Goal {goalIndex + 1}
            </h4>
            {editable && goals.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(goals.filter((_, i) => i !== goalIndex))}
              >
                Remove
              </Button>
            ) : null}
          </div>

          {editable ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                Goal Title
                <input
                  className={fieldClass}
                  value={goal.title}
                  onChange={(event) => updateGoal(goalIndex, { title: event.target.value })}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                Goal Description
                <textarea
                  className={areaClass}
                  value={goal.objective}
                  onChange={(event) => updateGoal(goalIndex, { objective: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Category
                <input
                  className={fieldClass}
                  value={goal.category ?? ""}
                  onChange={(event) => updateGoal(goalIndex, { category: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Due Date
                <input
                  type="date"
                  className={fieldClass}
                  value={goal.dueDate ?? ""}
                  onChange={(event) => updateGoal(goalIndex, { dueDate: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Expected Outcome
                <input
                  className={fieldClass}
                  value={goal.expectedOutcome ?? ""}
                  onChange={(event) => updateGoal(goalIndex, { expectedOutcome: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Success Criteria
                <input
                  className={fieldClass}
                  value={goal.successCriteria ?? ""}
                  onChange={(event) => updateGoal(goalIndex, { successCriteria: event.target.value })}
                />
              </label>
            </div>
          ) : (
            <GoalReadonly goal={goal} />
          )}

          <div className="mt-5 space-y-3 border-t border-stone-100 pt-4 dark:border-stone-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Sub-goals</p>
            {(goal.subGoals ?? []).map((sub, subIndex) => (
              <div
                key={sub.id ?? subIndex}
                className="rounded-xl border border-dashed border-stone-200 p-3 dark:border-stone-700"
              >
                <p className="mb-2 text-xs font-medium text-stone-500">Sub-goal {subIndex + 1}</p>
                {editable ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-sm sm:col-span-2">
                      Title
                      <input
                        className={fieldClass}
                        value={sub.title}
                        onChange={(event) => updateSub(goalIndex, subIndex, { title: event.target.value })}
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      Description
                      <textarea
                        className={areaClass}
                        value={sub.description}
                        onChange={(event) =>
                          updateSub(goalIndex, subIndex, { description: event.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Due Date
                      <input
                        type="date"
                        className={fieldClass}
                        value={sub.dueDate ?? ""}
                        onChange={(event) => updateSub(goalIndex, subIndex, { dueDate: event.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      Expected Outcome
                      <input
                        className={fieldClass}
                        value={sub.expectedOutcome ?? ""}
                        onChange={(event) =>
                          updateSub(goalIndex, subIndex, { expectedOutcome: event.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      Success Criteria
                      <input
                        className={fieldClass}
                        value={sub.successCriteria ?? ""}
                        onChange={(event) =>
                          updateSub(goalIndex, subIndex, { successCriteria: event.target.value })
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{sub.title || "Untitled sub-goal"}</p>
                    <p className="text-stone-600">{sub.description || "—"}</p>
                    <p className="text-xs text-stone-400">
                      Due: {sub.dueDate || "—"} · Outcome: {sub.expectedOutcome || "—"} · Criteria:{" "}
                      {sub.successCriteria || "—"}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {editable && (goal.subGoals?.length ?? 0) < 5 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateGoal(goalIndex, {
                    subGoals: [...(goal.subGoals ?? []), emptySubGoal(goal.subGoals?.length ?? 0)],
                  })
                }
              >
                + Add Sub-goal
              </Button>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

function GoalReadonly({ goal }: { goal: GoalInput }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-lg font-medium">{goal.title || "Untitled goal"}</p>
      <p className="text-stone-600">{goal.objective || "No description"}</p>
      <div className="flex flex-wrap gap-3 text-xs text-stone-500">
        {goal.category ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">{goal.category}</span> : null}
        <span>Due: {goal.dueDate || "—"}</span>
        <span>Outcome: {goal.expectedOutcome || "—"}</span>
        <span>Criteria: {goal.successCriteria || "—"}</span>
      </div>
    </div>
  );
}
