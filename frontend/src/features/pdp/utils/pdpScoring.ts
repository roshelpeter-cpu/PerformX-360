/** Frontend mirror of backend PDP scoring (approved COMPLETED sub-goals only). */

export type SubGoalScoreInput = { id: string; status: string };
export type GoalScoreInput = { id: string; subGoals: SubGoalScoreInput[] };

export function formatPdpPoints(value: number) {
  return value.toFixed(2);
}

export function isApprovedSubGoalStatus(status: string) {
  return status === "COMPLETED";
}

export function computePdpScoring(goals: GoalScoreInput[]) {
  const totalWeight = 100;
  const mainGoalCount = goals.length;
  if (mainGoalCount === 0) {
    return {
      totalWeight,
      earnedPoints: 0,
      progressPercent: 0,
      mainGoalCount: 0,
      goals: [] as Array<{
        id: string;
        weight: number;
        subGoalCount: number;
        approvedCount: number;
        earned: number;
        progressPercent: number;
        subGoals: Array<{ id: string; weight: number; earned: number }>;
      }>,
    };
  }

  const mainWeight = totalWeight / mainGoalCount;
  const scoredGoals = goals.map((goal) => {
    const subGoalCount = goal.subGoals.length;
    const subWeight = subGoalCount > 0 ? mainWeight / subGoalCount : 0;
    const subGoals = goal.subGoals.map((sub) => {
      const counts = isApprovedSubGoalStatus(sub.status);
      return {
        id: sub.id,
        weight: subWeight,
        earned: counts ? subWeight : 0,
      };
    });
    const approvedCount = subGoals.filter((s) => s.earned > 0).length;
    const earned = subGoals.reduce((sum, s) => sum + s.earned, 0);
    const progressPercent = mainWeight > 0 ? Math.round((earned / mainWeight) * 100) : 0;
    return {
      id: goal.id,
      weight: mainWeight,
      subGoalCount,
      approvedCount,
      earned,
      progressPercent,
      subGoals,
    };
  });

  const earnedPoints = scoredGoals.reduce((sum, g) => sum + g.earned, 0);
  return {
    totalWeight,
    earnedPoints,
    progressPercent: Math.round((earnedPoints / totalWeight) * 100),
    mainGoalCount,
    goals: scoredGoals,
  };
}
