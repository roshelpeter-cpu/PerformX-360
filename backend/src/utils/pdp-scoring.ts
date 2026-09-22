/** Dynamic PDP scoring: total weight 100, split evenly across main goals then sub-goals. */

export type SubGoalScoreInput = {
  id: string;
  status: string;
};

export type GoalScoreInput = {
  id: string;
  subGoals: SubGoalScoreInput[];
};

export type SubGoalScore = {
  id: string;
  weight: number;
  earned: number;
  countsTowardScore: boolean;
};

export type GoalScore = {
  id: string;
  weight: number;
  subGoalCount: number;
  approvedCount: number;
  earned: number;
  progressPercent: number;
  subGoals: SubGoalScore[];
};

export type PdpScoreSummary = {
  totalWeight: number;
  earnedPoints: number;
  progressPercent: number;
  mainGoalCount: number;
  goals: GoalScore[];
};

export function isApprovedSubGoalStatus(status: string) {
  return status === "COMPLETED";
}

export function formatPdpPoints(value: number) {
  return value.toFixed(2);
}

/**
 * Compute PDP scoring from current goal/sub-goal structure.
 * Only supervisor-approved (COMPLETED) sub-goals earn points.
 */
export function computePdpScoring(goals: GoalScoreInput[]): PdpScoreSummary {
  const totalWeight = 100;
  const mainGoalCount = goals.length;
  if (mainGoalCount === 0) {
    return {
      totalWeight,
      earnedPoints: 0,
      progressPercent: 0,
      mainGoalCount: 0,
      goals: [],
    };
  }

  const mainWeight = totalWeight / mainGoalCount;

  const scoredGoals: GoalScore[] = goals.map((goal) => {
    const subGoalCount = goal.subGoals.length;
    const subWeight = subGoalCount > 0 ? mainWeight / subGoalCount : 0;

    const subGoals: SubGoalScore[] = goal.subGoals.map((sub) => {
      const countsTowardScore = isApprovedSubGoalStatus(sub.status);
      return {
        id: sub.id,
        weight: subWeight,
        earned: countsTowardScore ? subWeight : 0,
        countsTowardScore,
      };
    });

    const approvedCount = subGoals.filter((s) => s.countsTowardScore).length;
    const earned = subGoals.reduce((sum, s) => sum + s.earned, 0);
    const progressPercent =
      mainWeight > 0 ? Math.round((earned / mainWeight) * 100) : 0;

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
  const progressPercent = Math.round((earnedPoints / totalWeight) * 100);

  return {
    totalWeight,
    earnedPoints,
    progressPercent,
    mainGoalCount,
    goals: scoredGoals,
  };
}
