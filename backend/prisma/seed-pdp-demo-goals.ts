/**
 * Deterministic active-dashboard goal packs for demo employee My PDP views.
 * Used only for EMP000901 / EMP000902 (high progress) and EMP000904 (zero progress).
 * Does not affect EMP000001 / EMP000903 goal generation.
 */

import {
  PdpGoalPriority,
  PdpGoalStatus,
  PdpSubGoalStatus,
} from "../generated/prisma/client.js";

type SubGoalSeed = {
  title: string;
  description: string;
  dueDate: Date;
  expectedOutcome: string;
  successCriteria: string;
  sortOrder: number;
  status: PdpSubGoalStatus;
  evidenceCount: number;
  comment: string | null;
};

type GoalSeed = {
  title: string;
  objective: string;
  expectedOutcome: string;
  developmentArea: string;
  category: string;
  successCriteria: string;
  dueDate: Date;
  sortOrder: number;
  priority: PdpGoalPriority;
  notes: string;
  progress: number;
  status: PdpGoalStatus;
  subGoals: { create: SubGoalSeed[] };
};

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function progressFromSubs(subs: SubGoalSeed[]) {
  const completed = subs.filter((s) => s.status === PdpSubGoalStatus.COMPLETED).length;
  const inProgress = subs.filter((s) => s.status === PdpSubGoalStatus.IN_PROGRESS).length;
  // Partial credit for in-progress keeps goal % aligned with sub-goal mix.
  return Math.round(((completed + inProgress * 0.5) / subs.length) * 100);
}

function goalStatusFromProgress(progress: number): PdpGoalStatus {
  if (progress >= 100) return PdpGoalStatus.COMPLETED;
  if (progress > 0) return PdpGoalStatus.IN_PROGRESS;
  return PdpGoalStatus.NOT_STARTED;
}

function buildSubs(
  rows: Array<{
    title: string;
    description: string;
    due: Date;
    status: PdpSubGoalStatus;
    evidenceCount?: number;
    comment?: string | null;
  }>
): SubGoalSeed[] {
  return rows.map((row, index) => ({
    title: row.title,
    description: row.description,
    dueDate: row.due,
    expectedOutcome: `Complete "${row.title}" with supervisor-visible evidence.`,
    successCriteria: "Supervisor confirms completion in a 1:1 check-in.",
    sortOrder: index,
    status: row.status,
    evidenceCount: row.evidenceCount ?? 0,
    comment: row.comment ?? null,
  }));
}

/** High-progress pack (~94% avg goal progress; most goals complete; one ~70%). */
export function highProgressDemoGoals(
  pdpId: string,
  versionId: string,
  employeeName: string,
  variant: "EMP000901" | "EMP000902"
): GoalSeed[] {
  const C = PdpSubGoalStatus.COMPLETED;
  const I = PdpSubGoalStatus.IN_PROGRESS;
  const N = PdpSubGoalStatus.NOT_STARTED;

  // Slight title/comment flavour per employee while keeping the same structure.
  const techComment =
    variant === "EMP000901"
      ? "Great learning experience!"
      : "Certification path mapped; course finished.";
  const projectComment =
    variant === "EMP000901"
      ? "Project deployed successfully."
      : "Demo environment reviewed with supervisor.";

  const packs: Array<{
    title: string;
    objective: string;
    category: string;
    due: Date;
    subs: SubGoalSeed[];
    /** Optional override when discrete sub-goal math should stay near a target %. */
    progressOverride?: number;
  }> = [
    {
      title: "Enhance Technical Skills",
      objective: "Build strong full-stack development skills and obtain relevant certifications.",
      category: "Skill Development",
      due: utcDate(2026, 11, 30),
      // 5/5 → 100%
      subs: buildSubs([
        {
          title: "Complete React Advanced Course",
          description: `${employeeName} completes the advanced React curriculum with assessed labs.`,
          due: utcDate(2026, 6, 12),
          status: C,
          evidenceCount: 1,
          comment: techComment,
        },
        {
          title: "Build a full-stack project (MERN)",
          description: "Deliver a production-ready MERN application with documented deployment.",
          due: utcDate(2026, 6, 30),
          status: C,
          evidenceCount: 2,
          comment: projectComment,
        },
        {
          title: "Learn RESTful API development",
          description: "Design and implement REST endpoints with auth and validation.",
          due: utcDate(2026, 8, 31),
          status: C,
          evidenceCount: 1,
          comment: "API module signed off.",
        },
        {
          title: "Obtain certification (e.g. AWS)",
          description: "Sit a cloud fundamentals certification relevant to delivery work.",
          due: utcDate(2026, 10, 30),
          status: C,
          evidenceCount: 1,
          comment: "Certificate uploaded.",
        },
        {
          title: "Practice testing and deployment",
          description: "Add automated tests and a repeatable CI/CD deploy path.",
          due: utcDate(2026, 11, 30),
          status: C,
          evidenceCount: 1,
          comment: "Pipeline green on main.",
        },
      ]),
    },
    {
      title: "Improve Project Management Skills",
      objective: "Plan delivery, manage risks, and keep stakeholders aligned throughout the cycle.",
      category: "Delivery Quality",
      due: utcDate(2026, 12, 15),
      // 5/5 → 100%
      subs: buildSubs([
        {
          title: "Complete project planning essentials module",
          description: "Finish the internal PM fundamentals learning path.",
          due: utcDate(2026, 5, 20),
          status: C,
          evidenceCount: 1,
          comment: "Module quiz passed.",
        },
        {
          title: "Lead sprint planning for one initiative",
          description: "Facilitate backlog refinement and sprint commitment.",
          due: utcDate(2026, 7, 15),
          status: C,
          evidenceCount: 1,
          comment: "Sprint plan shared with team.",
        },
        {
          title: "Maintain a living risk register",
          description: "Track top risks weekly with mitigation owners.",
          due: utcDate(2026, 8, 30),
          status: C,
          evidenceCount: 1,
          comment: "Register reviewed in stand-up.",
        },
        {
          title: "Deliver a mid-cycle status pack",
          description: "Produce a concise progress pack for supervisor and HR.",
          due: utcDate(2026, 9, 30),
          status: C,
          evidenceCount: 2,
          comment: "Status pack archived.",
        },
        {
          title: "Close initiative with lessons learned",
          description: "Run a retrospective and capture reusable improvements.",
          due: utcDate(2026, 12, 10),
          status: C,
          evidenceCount: 1,
          comment: "Retro notes captured.",
        },
      ]),
    },
    {
      title: "Develop Leadership Skills",
      objective: "Practice coaching behaviours and take ownership of team outcomes.",
      category: "Leadership",
      due: utcDate(2027, 1, 31),
      // 4 completed + 1 in progress → ~98% (progressOverride)
      subs: buildSubs([
        {
          title: "Complete situational leadership workshop",
          description: "Attend workshop and apply one framework in a 1:1.",
          due: utcDate(2026, 6, 5),
          status: C,
          evidenceCount: 1,
          comment: "Workshop certificate filed.",
        },
        {
          title: "Mentor a junior colleague for 6 weeks",
          description: "Run fortnightly mentoring sessions with agreed goals.",
          due: utcDate(2026, 8, 20),
          status: C,
          evidenceCount: 1,
          comment: "Mentoring log complete.",
        },
        {
          title: "Facilitate a team knowledge share",
          description: "Host a 30-minute knowledge-sharing session.",
          due: utcDate(2026, 9, 15),
          status: C,
          evidenceCount: 1,
          comment: "Session recording shared.",
        },
        {
          title: "Own an on-call escalation playbook update",
          description: "Refresh playbook steps and socialise with the team.",
          due: utcDate(2026, 10, 25),
          status: C,
          evidenceCount: 1,
          comment: "Playbook PR merged.",
        },
        {
          title: "Present a leadership reflection to supervisor",
          description: "Summarise growth and next stretch opportunities.",
          due: utcDate(2027, 1, 20),
          status: I,
          evidenceCount: 0,
          comment: "Reflection draft in review.",
        },
      ]),
      progressOverride: 98,
    },
    {
      title: "Improve Communication Skills",
      objective: "Communicate clearly with stakeholders across written and verbal channels.",
      category: "Communication",
      due: utcDate(2027, 2, 28),
      // 5/5 completed → 100%
      subs: buildSubs([
        {
          title: "Complete business writing clinic",
          description: "Apply clinic templates to weekly status updates.",
          due: utcDate(2026, 5, 28),
          status: C,
          evidenceCount: 1,
          comment: "Clinic completed.",
        },
        {
          title: "Deliver a stakeholder demo walkthrough",
          description: "Present a feature demo to a cross-functional audience.",
          due: utcDate(2026, 7, 22),
          status: C,
          evidenceCount: 1,
          comment: "Demo feedback positive.",
        },
        {
          title: "Improve meeting note quality",
          description: "Publish structured notes within 24 hours of key meetings.",
          due: utcDate(2026, 9, 5),
          status: C,
          evidenceCount: 2,
          comment: "Notes template adopted.",
        },
        {
          title: "Practice difficult conversation role-play",
          description: "Complete HR-facilitated feedback conversation practice.",
          due: utcDate(2026, 11, 12),
          status: C,
          evidenceCount: 1,
          comment: "Role-play completed.",
        },
        {
          title: "Publish a cycle communication retrospective",
          description: "Share what worked and what to improve in team channels.",
          due: utcDate(2027, 2, 15),
          status: C,
          evidenceCount: 1,
          comment: "Retrospective published.",
        },
      ]),
    },
    {
      title: "Focus on Professional / Personal Well-being",
      objective: "Sustain healthy work habits and protect focus time across the appraisal cycle.",
      category: "Professional Growth",
      due: utcDate(2027, 3, 15),
      // 3 completed + 1 in progress + 1 not started → 70%; keeps mix of statuses
      progressOverride: 70,
      subs: buildSubs([
        {
          title: "Set a sustainable weekly focus block",
          description: "Protect two focus blocks per week in the calendar.",
          due: utcDate(2026, 4, 30),
          status: C,
          evidenceCount: 1,
          comment: "Calendar blocks active.",
        },
        {
          title: "Complete wellbeing micro-learning series",
          description: "Finish the short series on energy and recovery.",
          due: utcDate(2026, 6, 18),
          status: C,
          evidenceCount: 1,
          comment: "Series completed.",
        },
        {
          title: "Agree workload boundaries with supervisor",
          description: "Document capacity agreements for peak delivery weeks.",
          due: utcDate(2026, 8, 8),
          status: C,
          evidenceCount: 1,
          comment: "Boundaries agreed.",
        },
        {
          title: "Run a monthly wellbeing check-in",
          description: "Track energy and adjust commitments with supervisor.",
          due: utcDate(2026, 12, 5),
          status: I,
          evidenceCount: 0,
          comment: "October check-in pending.",
        },
        {
          title: "Share wellbeing practices with the team",
          description: "Facilitate a short peer tip-share on sustainable pace.",
          due: utcDate(2027, 3, 1),
          status: N,
          evidenceCount: 0,
          comment: null,
        },
      ]),
    },
  ];

  return packs.map((pack, index) => {
    const progress = pack.progressOverride ?? progressFromSubs(pack.subs);
    return {
      pdpId,
      versionId,
      title: pack.title,
      objective: pack.objective,
      expectedOutcome: `Demonstrable improvement in ${pack.category.toLowerCase()} by cycle review.`,
      developmentArea: pack.category,
      category: pack.category,
      successCriteria: "Evidence reviewed with supervisor at mid-cycle and year-end check-ins.",
      dueDate: pack.due,
      sortOrder: index,
      priority: index < 2 ? PdpGoalPriority.HIGH : PdpGoalPriority.MEDIUM,
      notes: `Deterministic demo goals for ${variant}.`,
      progress,
      status: goalStatusFromProgress(progress),
      subGoals: { create: pack.subs },
    };
  });
}

/** Zero-progress pack for EMP000904 assigned-but-unopened dashboard. */
export function zeroProgressDemoGoals(
  pdpId: string,
  versionId: string,
  employeeName: string
): GoalSeed[] {
  const N = PdpSubGoalStatus.NOT_STARTED;

  const packs: Array<{
    title: string;
    objective: string;
    category: string;
    due: Date;
    subTitles: string[];
  }> = [
    {
      title: "Enhance Technical Skills",
      objective: "Build strong full-stack development skills and obtain relevant certifications.",
      category: "Skill Development",
      due: utcDate(2026, 11, 30),
      subTitles: [
        "Complete React Advanced Course",
        "Build a full-stack project (MERN)",
        "Learn RESTful API development",
        "Obtain certification (e.g. AWS)",
        "Practice testing and deployment",
      ],
    },
    {
      title: "Improve Project Management Skills",
      objective: "Plan delivery, manage risks, and keep stakeholders aligned throughout the cycle.",
      category: "Delivery Quality",
      due: utcDate(2026, 12, 15),
      subTitles: [
        "Complete project planning essentials module",
        "Lead sprint planning for one initiative",
        "Maintain a living risk register",
        "Deliver a mid-cycle status pack",
        "Close initiative with lessons learned",
      ],
    },
    {
      title: "Develop Leadership Skills",
      objective: "Practice coaching behaviours and take ownership of team outcomes.",
      category: "Leadership",
      due: utcDate(2027, 1, 31),
      subTitles: [
        "Complete situational leadership workshop",
        "Mentor a junior colleague for 6 weeks",
        "Facilitate a team knowledge share",
        "Own an on-call escalation playbook update",
        "Present a leadership reflection to supervisor",
      ],
    },
    {
      title: "Improve Communication Skills",
      objective: "Communicate clearly with stakeholders across written and verbal channels.",
      category: "Communication",
      due: utcDate(2027, 2, 28),
      subTitles: [
        "Complete business writing clinic",
        "Deliver a stakeholder demo walkthrough",
        "Improve meeting note quality",
        "Practice difficult conversation role-play",
        "Publish a cycle communication retrospective",
      ],
    },
    {
      title: "Focus on Professional / Personal Well-being",
      objective: "Sustain healthy work habits and protect focus time across the appraisal cycle.",
      category: "Professional Growth",
      due: utcDate(2027, 3, 15),
      subTitles: [
        "Set a sustainable weekly focus block",
        "Complete wellbeing micro-learning series",
        "Agree workload boundaries with supervisor",
        "Run a monthly wellbeing check-in",
        "Share wellbeing practices with the team",
      ],
    },
  ];

  const dueOffsets = [
    utcDate(2026, 6, 12),
    utcDate(2026, 6, 30),
    utcDate(2026, 8, 31),
    utcDate(2026, 10, 30),
    utcDate(2026, 11, 30),
  ];

  return packs.map((pack, index) => {
    const subs = buildSubs(
      pack.subTitles.map((title, subIndex) => ({
        title,
        description: `${employeeName} will complete "${title}" during the active PDP period.`,
        due: dueOffsets[subIndex]!,
        status: N,
        evidenceCount: 0,
        comment: null,
      }))
    );
    return {
      pdpId,
      versionId,
      title: pack.title,
      objective: pack.objective,
      expectedOutcome: `Demonstrable improvement in ${pack.category.toLowerCase()} by cycle review.`,
      developmentArea: pack.category,
      category: pack.category,
      successCriteria: "Evidence reviewed with supervisor at mid-cycle and year-end check-ins.",
      dueDate: pack.due,
      sortOrder: index,
      priority: index < 2 ? PdpGoalPriority.HIGH : PdpGoalPriority.MEDIUM,
      notes: "Deterministic zero-progress demo goals for EMP000904.",
      progress: 0,
      status: PdpGoalStatus.NOT_STARTED,
      subGoals: { create: subs },
    };
  });
}
