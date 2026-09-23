export function performanceBand(score: number) {
  if (score >= 90) return "Outstanding";
  if (score >= 80) return "Exceeds Expectations";
  if (score >= 70) return "Meets Expectations";
  if (score >= 60) return "Needs Improvement";
  return "Performance Improvement Required";
}

/** Existing PDP score is out of 100. Supervisor/PDP review contributes 60 of the final 100. */
export function scalePdpToSupervisorMarks(earnedPoints: number) {
  const safe = Number.isFinite(earnedPoints) ? earnedPoints : 0;
  return Number(((Math.min(100, Math.max(0, safe)) / 100) * 60).toFixed(2));
}

export function finalPerformanceScore(selfScore: number, peerScore: number, pdpEarnedPoints: number) {
  const self = Number(selfScore.toFixed(2));
  const peer = Number(peerScore.toFixed(2));
  const supervisorPdp = scalePdpToSupervisorMarks(pdpEarnedPoints);
  const total = Number((self + peer + supervisorPdp).toFixed(2));
  return {
    self,
    peer,
    supervisorPdp,
    total,
    band: performanceBand(total),
  };
}
