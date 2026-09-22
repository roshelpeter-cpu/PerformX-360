import type { GoalInput } from "../services/pdp.api";

export function emptySubGoal(sortOrder: number) {
  return {
    title: `Sub-goal ${sortOrder + 1}`,
    description: "",
    dueDate: "",
    expectedOutcome: "",
    successCriteria: "",
    sortOrder,
  };
}

export function emptyMainGoal(sortOrder: number): GoalInput {
  return {
    title: `Main Goal ${sortOrder + 1}`,
    objective: "",
    expectedOutcome: "",
    successCriteria: "",
    category: "Skill Development",
    developmentArea: "",
    notes: "",
    dueDate: "",
    sortOrder,
    subGoals: Array.from({ length: 5 }, (_, index) => emptySubGoal(index)),
  };
}

export function defaultFiveGoals(): GoalInput[] {
  return Array.from({ length: 5 }, (_, index) => emptyMainGoal(index));
}

export function goalsFromApi(
  goals: Array<{
    id: string;
    title: string;
    objective: string;
    expectedOutcome: string | null;
    dueDate: string | null;
    successCriteria: string | null;
    category: string | null;
    developmentArea: string | null;
    notes: string | null;
    priority: string;
    sortOrder: number;
    subGoals?: Array<{
      id: string;
      title: string;
      description: string;
      dueDate: string | null;
      expectedOutcome: string | null;
      successCriteria: string | null;
      sortOrder: number;
    }>;
  }>
): GoalInput[] {
  if (!goals.length) return defaultFiveGoals();
  return goals.map((goal, index) => {
    const subs = goal.subGoals ?? [];
    const paddedSubs = Array.from({ length: 5 }, (_, subIndex) => {
      const existing = subs[subIndex];
      return existing
        ? {
            id: existing.id,
            title: existing.title,
            description: existing.description,
            dueDate: existing.dueDate ? existing.dueDate.slice(0, 10) : "",
            expectedOutcome: existing.expectedOutcome ?? "",
            successCriteria: existing.successCriteria ?? "",
            sortOrder: existing.sortOrder ?? subIndex,
          }
        : emptySubGoal(subIndex);
    });
    return {
      id: goal.id,
      title: goal.title,
      objective: goal.objective,
      expectedOutcome: goal.expectedOutcome ?? "",
      successCriteria: goal.successCriteria ?? "",
      category: goal.category ?? "",
      developmentArea: goal.developmentArea ?? "",
      notes: goal.notes ?? "",
      dueDate: goal.dueDate ? goal.dueDate.slice(0, 10) : "",
      priority: goal.priority,
      sortOrder: goal.sortOrder ?? index,
      subGoals: paddedSubs,
    };
  });
}
