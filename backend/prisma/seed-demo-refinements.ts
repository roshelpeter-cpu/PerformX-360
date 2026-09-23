/**
 * Supplemental demo data for employee final evaluation snapshots and inbox notifications.
 * Deletes only rows tagged metadata.demoKey = "inbox-demo". Does not touch PDP, self-review, or PIP rows.
 */
import {
  BonusAuthorizationStatus,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  PromotionRecommendationStatus,
} from "../generated/prisma/client.js";
import { computeBonus } from "../src/utils/bonus-formula.js";
import { computePdpScoring } from "../src/utils/pdp-scoring.js";
import { finalPerformanceScore } from "../src/utils/performance-score.js";

const DEMO_KEY = "inbox-demo";

type Note = {
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  href?: string;
};

function employeeNotes(base: string): Note[] {
  return [
    {
      type: NotificationType.SUPERVISOR_REVIEW_DECIDED,
      title: "Supervisor submitted your review",
      message: "Your supervisor submitted the appraisal review for this cycle.",
      status: NotificationStatus.UNREAD,
      href: `${base}/final-evaluation`,
    },
    {
      type: NotificationType.FINAL_EVALUATION_APPROVED,
      title: "Final evaluation is available",
      message: "Your final evaluation summary is ready to view.",
      status: NotificationStatus.READ,
      href: `${base}/final-evaluation`,
    },
    {
      type: NotificationType.SELF_REVIEW_SUBMITTED,
      title: "Performance review recorded",
      message: "Your performance review package now includes the latest supervisor comments.",
      status: NotificationStatus.READ,
      href: `${base}/final-evaluation`,
    },
    {
      type: NotificationType.PDP_APPROVED,
      title: "PDP updated",
      message: "Your supervisor updated progress on an approved development goal.",
      status: NotificationStatus.UNREAD,
      href: `${base}/pdp`,
    },
    {
      type: NotificationType.PDP_CHANGES_REQUESTED,
      title: "Sub-goal needs attention",
      message: "A sub-goal is waiting for evidence before it can be marked complete.",
      status: NotificationStatus.UNREAD,
      href: `${base}/pdp`,
    },
    {
      type: NotificationType.PDP_GOAL_ADDED,
      title: "Development goal refreshed",
      message: "A development goal on your PDP was refreshed for the current cycle.",
      status: NotificationStatus.READ,
      href: `${base}/pdp`,
    },
    {
      type: NotificationType.PIP_SUBMITTED,
      title: "PIP review is approaching",
      message: "A PIP checkpoint is coming up. Review the open actions before the meeting.",
      status: NotificationStatus.UNREAD,
      href: `${base}/pip`,
    },
    {
      type: NotificationType.PIP_ASSIGNED,
      title: "PIP checkpoint reminder",
      message: "Please confirm the evidence requested on your performance improvement plan.",
      status: NotificationStatus.READ,
      href: `${base}/pip`,
    },
    {
      type: NotificationType.PEER_REVIEW_ASSIGNED,
      title: "Peer review assigned",
      message: "You have been asked to complete a confidential peer review.",
      status: NotificationStatus.UNREAD,
      href: `${base}/peer-review`,
    },
    {
      type: NotificationType.PEER_REVIEW_SUBMITTED,
      title: "Peer review submitted",
      message: "A peer review of your work was submitted. Reviewer names stay confidential.",
      status: NotificationStatus.READ,
      href: `${base}/peer-review`,
    },
    {
      type: NotificationType.FOLLOW_UP_SCHEDULED,
      title: "Follow-up meeting scheduled",
      message: "A follow-up meeting has been placed on your appraisal schedule.",
      status: NotificationStatus.UNREAD,
      href: `${base}/meetings/follow-up`,
    },
    {
      type: NotificationType.FOLLOW_UP_RESCHEDULE_REQUEST,
      title: "Reschedule requested",
      message: "A follow-up meeting has a reschedule request waiting for a response.",
      status: NotificationStatus.READ,
      href: `${base}/meetings/follow-up`,
    },
    {
      type: NotificationType.MEETING_CONFIRMED,
      title: "Follow-up meeting confirmed",
      message: "A follow-up meeting on your schedule was confirmed.",
      status: NotificationStatus.READ,
      href: `${base}/meetings/follow-up`,
    },
    {
      type: NotificationType.AWARD_APPROVED,
      title: "Award approved",
      message: "An award recommendation for you was approved.",
      status: NotificationStatus.UNREAD,
      href: `${base}/final-evaluation`,
    },
    {
      type: NotificationType.AWARD_RECOMMENDED,
      title: "You were recognised",
      message: "Your supervisor recognised a contribution from this appraisal cycle.",
      status: NotificationStatus.READ,
    },
    {
      type: NotificationType.BONUS_AUTHORIZED,
      title: "Bonus calculated",
      message: "A bonus amount has been calculated from your final score and band.",
      status: NotificationStatus.UNREAD,
      href: `${base}/final-evaluation`,
    },
    {
      type: NotificationType.BONUS_AUTHORIZED,
      title: "Bonus authorized",
      message: "HR authorised the calculated bonus for this appraisal cycle.",
      status: NotificationStatus.READ,
      href: `${base}/final-evaluation`,
    },
    {
      type: NotificationType.PROMOTION_RECOMMENDED,
      title: "Promotion recommendation submitted",
      message: "Your supervisor submitted a promotion recommendation for HR review.",
      status: NotificationStatus.UNREAD,
      href: `${base}/final-evaluation`,
    },
    {
      type: NotificationType.PROMOTION_DECIDED,
      title: "Promotion recommendation reviewed",
      message: "HR reviewed the promotion recommendation for this cycle.",
      status: NotificationStatus.READ,
      href: `${base}/final-evaluation`,
    },
    {
      type: NotificationType.SECURITY_WARNING,
      title: "Sign-in reminder",
      message: "Your last sign-in from this workstation was recorded successfully.",
      status: NotificationStatus.READ,
    },
    {
      type: NotificationType.PASSWORD_RESET_COMPLETE,
      title: "Password is current",
      message: "No password reset is waiting. Your account password remains active.",
      status: NotificationStatus.READ,
    },
    {
      type: NotificationType.BATCH_STAGE_CHANGED,
      title: "Appraisal batch update",
      message: "Your appraisal batch moved to the current review stage.",
      status: NotificationStatus.UNREAD,
    },
  ];
}

function supervisorNotes(): Note[] {
  return [
    {
      type: NotificationType.PDP_SUBMITTED,
      title: "PDP approval requested",
      message: "An employee submitted PDP evidence that needs your approval.",
      status: NotificationStatus.UNREAD,
      href: "/supervisor/pdp",
    },
    {
      type: NotificationType.PDP_SUBMITTED,
      title: "Sub-goal ready for approval",
      message: "A completed sub-goal is waiting for supervisor approval.",
      status: NotificationStatus.UNREAD,
      href: "/supervisor/pdp",
    },
    {
      type: NotificationType.PDP_EMPLOYEE_RESPONSE,
      title: "Employee replied on a PDP goal",
      message: "An employee responded to your requested PDP change.",
      status: NotificationStatus.READ,
      href: "/supervisor/pdp",
    },
    {
      type: NotificationType.SUPERVISOR_REVIEW_DECIDED,
      title: "Employee review requested",
      message: "An employee package is ready for your supervisor review.",
      status: NotificationStatus.UNREAD,
      href: "/supervisor/review",
    },
    {
      type: NotificationType.SELF_REVIEW_SUBMITTED,
      title: "Self review submitted",
      message: "A team member submitted a self review for you to consider.",
      status: NotificationStatus.READ,
      href: "/supervisor/review",
    },
    {
      type: NotificationType.PIP_ASSIGNED,
      title: "PIP draft needs your update",
      message: "An employee PIP is waiting for the next supervisor checkpoint.",
      status: NotificationStatus.UNREAD,
      href: "/supervisor/pip",
    },
    {
      type: NotificationType.PIP_SUBMITTED,
      title: "PIP submitted for review",
      message: "A PIP was submitted and needs a supervisor follow-up.",
      status: NotificationStatus.READ,
      href: "/supervisor/pip",
    },
    {
      type: NotificationType.PROMOTION_RECOMMENDED,
      title: "Promotion case to complete",
      message: "A promotion recommendation is still in draft on your team.",
      status: NotificationStatus.UNREAD,
      href: "/supervisor/final-evaluation",
    },
    {
      type: NotificationType.PROMOTION_DECIDED,
      title: "Promotion returned from HR",
      message: "HR sent a promotion recommendation back with a decision note.",
      status: NotificationStatus.READ,
      href: "/supervisor/final-evaluation",
    },
    {
      type: NotificationType.MEETING_RESCHEDULE_REQUEST,
      title: "Meeting reschedule requested",
      message: "An employee asked to move a scheduled meeting.",
      status: NotificationStatus.UNREAD,
      href: "/supervisor/meetings/other",
    },
    {
      type: NotificationType.FOLLOW_UP_RESCHEDULE_REQUEST,
      title: "Follow-up reschedule requested",
      message: "A follow-up meeting has a pending reschedule reason.",
      status: NotificationStatus.UNREAD,
      href: "/supervisor/meetings/follow-up",
    },
    {
      type: NotificationType.FOLLOW_UP_REMINDER,
      title: "Follow-up reminder",
      message: "A follow-up meeting with your team is coming up this week.",
      status: NotificationStatus.READ,
      href: "/supervisor/meetings/follow-up",
    },
    {
      type: NotificationType.SECURITY_WARNING,
      title: "Team access check",
      message: "No unusual sign-in activity was found for your team this week.",
      status: NotificationStatus.READ,
    },
    {
      type: NotificationType.BATCH_STAGE_CHANGED,
      title: "Batch stage changed",
      message: "Your team's appraisal batch advanced to supervisor review.",
      status: NotificationStatus.UNREAD,
    },
  ];
}

function hrNotes(): Note[] {
  return [
    {
      type: NotificationType.PEER_REVIEW_SUBMITTED,
      title: "Peer review completed",
      message: "A confidential peer review was submitted for an employee in the active cycle.",
      status: NotificationStatus.UNREAD,
      href: "/hr/peer-review",
    },
    {
      type: NotificationType.PEER_REVIEW_SUBMITTED,
      title: "Second peer review completed",
      message: "Another peer review was completed. Reviewer names stay on the HR record only.",
      status: NotificationStatus.READ,
      href: "/hr/peer-review",
    },
    {
      type: NotificationType.FINAL_EVALUATION_APPROVED,
      title: "Final evaluation awaiting approval",
      message: "A completed appraisal package is ready for HR final approval.",
      status: NotificationStatus.UNREAD,
      href: "/hr/final-evaluation",
    },
    {
      type: NotificationType.SUPERVISOR_REVIEW_DECIDED,
      title: "HR review task",
      message: "A supervisor review was recorded and now needs the HR check.",
      status: NotificationStatus.UNREAD,
      href: "/hr/performance-evaluation",
    },
    {
      type: NotificationType.SELF_REVIEW_SUBMITTED,
      title: "Self review filed",
      message: "An employee self review is available inside the evaluation package.",
      status: NotificationStatus.READ,
      href: "/hr/performance-evaluation",
    },
    {
      type: NotificationType.PROMOTION_RECOMMENDED,
      title: "Promotion submitted",
      message: "A supervisor submitted a promotion recommendation for HR review.",
      status: NotificationStatus.UNREAD,
      href: "/hr/promotions",
    },
    {
      type: NotificationType.PROMOTION_DECIDED,
      title: "Promotion decision recorded",
      message: "A promotion recommendation was shortlisted for the next panel.",
      status: NotificationStatus.READ,
      href: "/hr/promotions",
    },
    {
      type: NotificationType.PIP_SUBMITTED,
      title: "PIP awaiting HR approval",
      message: "An employee accepted a PIP and it is waiting for HR approval.",
      status: NotificationStatus.UNREAD,
      href: "/hr/pip",
    },
    {
      type: NotificationType.PIP_ASSIGNED,
      title: "Active PIP on record",
      message: "An active PIP is open and due for the next HR checkpoint.",
      status: NotificationStatus.READ,
      href: "/hr/pip",
    },
    {
      type: NotificationType.AWARD_RECOMMENDED,
      title: "Award awaiting approval",
      message: "An award nomination is waiting for HR review.",
      status: NotificationStatus.UNREAD,
      href: "/hr/final-evaluation",
    },
    {
      type: NotificationType.AWARD_RECOMMENDED,
      title: "Second award nomination",
      message: "Another award nomination was filed for this appraisal cycle.",
      status: NotificationStatus.READ,
    },
    {
      type: NotificationType.MEETING_RESCHEDULE_REQUEST,
      title: "Meeting request for HR",
      message: "A discussion meeting is waiting for an HR response.",
      status: NotificationStatus.UNREAD,
      href: "/hr/meetings/other",
    },
    {
      type: NotificationType.FOLLOW_UP_SCHEDULED,
      title: "Follow-up schedule published",
      message: "A supervisor published a follow-up schedule you can monitor.",
      status: NotificationStatus.READ,
      href: "/hr/meetings/follow-up",
    },
    {
      type: NotificationType.BATCH_STAGE_CHANGED,
      title: "Appraisal batch advanced",
      message: "An appraisal batch moved into the HR review stage.",
      status: NotificationStatus.READ,
    },
    {
      type: NotificationType.SECURITY_WARNING,
      title: "HR access review",
      message: "Routine access review found no locked HR accounts.",
      status: NotificationStatus.READ,
    },
  ];
}

function hrmNotes(): Note[] {
  return [
    {
      type: NotificationType.BONUS_AUTHORIZED,
      title: "Bonus calculation ready",
      message: "Bonus amounts were calculated for employees with approved final scores.",
      status: NotificationStatus.UNREAD,
      href: "/hr/bonus-calculation",
    },
    {
      type: NotificationType.BONUS_AUTHORIZED,
      title: "Bonus batch calculated",
      message: "A second bonus batch is calculated and waiting for authorisation.",
      status: NotificationStatus.UNREAD,
      href: "/hr/bonus-calculation",
    },
    {
      type: NotificationType.BONUS_AUTHORIZED,
      title: "Bonus authorised",
      message: "You authorised a bonus batch for the active appraisal cycle.",
      status: NotificationStatus.READ,
      href: "/hr/bonus-calculation",
    },
    {
      type: NotificationType.AWARD_RECOMMENDED,
      title: "Awards awaiting approval",
      message: "Award nominations are waiting for HR Manager approval.",
      status: NotificationStatus.UNREAD,
      href: "/hr/awards",
    },
    {
      type: NotificationType.AWARD_APPROVED,
      title: "Award approval recorded",
      message: "An outstanding performer award was approved for the cycle.",
      status: NotificationStatus.READ,
      href: "/hr/awards",
    },
    {
      type: NotificationType.PROMOTION_RECOMMENDED,
      title: "Promotion pipeline update",
      message: "New promotion recommendations entered the HR pipeline.",
      status: NotificationStatus.UNREAD,
      href: "/hr/promotions",
    },
    {
      type: NotificationType.PROMOTION_DECIDED,
      title: "Promotion shortlist updated",
      message: "The promotion shortlist was updated after HR review.",
      status: NotificationStatus.READ,
      href: "/hr/promotions",
    },
    {
      type: NotificationType.FINAL_EVALUATION_APPROVED,
      title: "Final evaluation progress",
      message: "More employees reached a completed final evaluation this week.",
      status: NotificationStatus.UNREAD,
      href: "/hr/final-evaluation",
    },
    {
      type: NotificationType.SUPERVISOR_REVIEW_DECIDED,
      title: "Supervisor reviews progressing",
      message: "Supervisor reviews continue to arrive for the active cycle.",
      status: NotificationStatus.READ,
      href: "/hr/final-evaluation",
    },
    {
      type: NotificationType.BATCH_STAGE_CHANGED,
      title: "Appraisal cycle status",
      message: "The active appraisal cycle remains open for final reviews.",
      status: NotificationStatus.READ,
      href: "/hr/appraisal-cycles",
    },
    {
      type: NotificationType.PDP_APPROVED,
      title: "Cycle PDP completion",
      message: "PDP completion for the active cycle moved forward this week.",
      status: NotificationStatus.UNREAD,
      href: "/hr/appraisal-cycles",
    },
    {
      type: NotificationType.SECURITY_WARNING,
      title: "Authorisation check",
      message: "Bonus authorisation rights for your account are unchanged.",
      status: NotificationStatus.READ,
    },
  ];
}

function leadershipNotes(): Note[] {
  return [
    {
      type: NotificationType.FINAL_EVALUATION_APPROVED,
      title: "Appraisal completion update",
      message: "Final evaluations continue to be approved across the organisation.",
      status: NotificationStatus.UNREAD,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.SUPERVISOR_REVIEW_DECIDED,
      title: "Appraisal cycle momentum",
      message: "Supervisor reviews are landing for the active appraisal cycle.",
      status: NotificationStatus.READ,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.PDP_APPROVED,
      title: "Performance insight",
      message: "PDP completion is strongest in teams that closed evidence early.",
      status: NotificationStatus.UNREAD,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.SELF_REVIEW_SUBMITTED,
      title: "Self review coverage",
      message: "Self review submissions increased since the last leadership report.",
      status: NotificationStatus.READ,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.AWARD_APPROVED,
      title: "Awards approved",
      message: "Approved awards for the cycle are ready in the leadership view.",
      status: NotificationStatus.UNREAD,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.AWARD_RECOMMENDED,
      title: "Award nominations filed",
      message: "New award nominations are waiting for HR Manager approval.",
      status: NotificationStatus.READ,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.BONUS_AUTHORIZED,
      title: "Bonus allocation prepared",
      message: "Calculated bonuses are ready for the authorised allocation review.",
      status: NotificationStatus.UNREAD,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.BONUS_AUTHORIZED,
      title: "Bonus allocation authorised",
      message: "A portion of the cycle bonus allocation has been authorised.",
      status: NotificationStatus.READ,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.PROMOTION_RECOMMENDED,
      title: "Promotion recommendations",
      message: "Supervisors filed promotion recommendations for leadership visibility.",
      status: NotificationStatus.UNREAD,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.PROMOTION_DECIDED,
      title: "Promotion shortlist",
      message: "HR shortlisted promotion cases for the next panel.",
      status: NotificationStatus.READ,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.BATCH_STAGE_CHANGED,
      title: "Report generated",
      message: "The organisation performance report for the active cycle was generated.",
      status: NotificationStatus.UNREAD,
      href: "/leadership/reports",
    },
    {
      type: NotificationType.PDP_HR_FEEDBACK,
      title: "Cycle status report",
      message: "The appraisal cycle status report is available under Reports.",
      status: NotificationStatus.READ,
      href: "/leadership/reports",
    },
  ];
}

async function writeNotes(
  prisma: PrismaClient,
  recipientId: string,
  notes: Note[],
  subjectEmployeeId?: string
) {
  const base = new Date(Date.UTC(2026, 8, 12, 8, 0, 0));
  await prisma.notification.createMany({
    data: notes.map((note, index) => ({
      type: note.type,
      title: note.title,
      message: note.message,
      status: note.status,
      recipientId,
      subjectEmployeeId: subjectEmployeeId ?? recipientId,
      metadata: {
        demoKey: DEMO_KEY,
        ...(note.href ? { href: note.href } : {}),
      },
      createdAt: new Date(base.getTime() + index * 60 * 60 * 1000),
    })),
  });
}

async function seedFinalSnapshots(prisma: PrismaClient) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) return;
  const hr = await prisma.employee.findUnique({ where: { employeeId: "HR000001" } });
  const hrm = await prisma.employee.findUnique({ where: { employeeId: "HRM000001" } });
  const people = await prisma.employee.findMany({
    where: { employeeId: { in: ["EMP000901", "EMP000902"] } },
    include: { team: { select: { supervisorId: true } } },
  });

  for (const employee of people) {
    const pdp = await prisma.personalDevelopmentPlan.findFirst({
      where: { employeeId: employee.id, cycleId: cycle.id, planType: "PDP" },
      select: { goals: { select: { id: true, subGoals: { select: { id: true, status: true } } } } },
    });
    const scoring = pdp
      ? computePdpScoring(
          pdp.goals.map((goal) => ({
            id: goal.id,
            subGoals: goal.subGoals.map((sub) => ({ id: sub.id, status: sub.status })),
          }))
        )
      : null;
    const selfReview = await prisma.selfReview.findUnique({
      where: { employeeId_cycleId: { employeeId: employee.id, cycleId: cycle.id } },
      select: { status: true, totalScore: true },
    });
    const peers = await prisma.peerReview.findMany({
      where: { cycleId: cycle.id, subjectEmployeeId: employee.id, status: "SUBMITTED" },
      select: { totalScore: true },
    });
    const scores = finalPerformanceScore(
      selfReview?.status === "SUBMITTED" ? selfReview.totalScore : selfReview?.totalScore ?? 0,
      Number(peers.reduce((sum, review) => sum + review.totalScore, 0).toFixed(2)),
      scoring?.earnedPoints ?? 0
    );
    const bonus = computeBonus(scores.total);
    const supervisorId = employee.team?.supervisorId;
    const isNethmi = employee.employeeId === "EMP000901";
    const position = isNethmi ? "Senior Analyst" : "Senior Specialist";
    const hrComment = isNethmi
      ? "HR approves this final evaluation. The self review, confidential peer score, and supervisor PDP score support the recorded band."
      : "HR has reviewed this final evaluation. The score is recorded and the active PIP remains in place.";

    await prisma.finalEvaluation.upsert({
      where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: employee.id } },
      create: {
        cycleId: cycle.id,
        employeeId: employee.id,
        status: "FINAL_APPROVED",
        hrComment,
        approvedById: hr?.id ?? null,
        approvedAt: new Date(Date.UTC(2026, 8, 22, 14, 0, 0)),
      },
      update: {
        status: "FINAL_APPROVED",
        hrComment,
        approvedById: hr?.id ?? null,
        approvedAt: new Date(Date.UTC(2026, 8, 22, 14, 0, 0)),
      },
    });

    await prisma.bonusCalculation.upsert({
      where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: employee.id } },
      create: {
        cycleId: cycle.id,
        employeeId: employee.id,
        finalScore: bonus.finalScore,
        band: bonus.band,
        bonusMonths: bonus.bonusMonths,
        dailyAmount: bonus.dailyAmount,
        workingDaysPerMonth: bonus.workingDaysPerMonth,
        amount: bonus.amount,
        calculation: bonus.calculation,
        status: isNethmi ? BonusAuthorizationStatus.AUTHORIZED : BonusAuthorizationStatus.CALCULATED,
        authorizedById: isNethmi ? hrm?.id ?? null : null,
        authorizedAt: isNethmi ? new Date(Date.UTC(2026, 8, 23, 9, 0, 0)) : null,
      },
      update: {
        finalScore: bonus.finalScore,
        band: bonus.band,
        bonusMonths: bonus.bonusMonths,
        dailyAmount: bonus.dailyAmount,
        workingDaysPerMonth: bonus.workingDaysPerMonth,
        amount: bonus.amount,
        calculation: bonus.calculation,
        status: isNethmi ? BonusAuthorizationStatus.AUTHORIZED : BonusAuthorizationStatus.CALCULATED,
        authorizedById: isNethmi ? hrm?.id ?? null : null,
        authorizedAt: isNethmi ? new Date(Date.UTC(2026, 8, 23, 9, 0, 0)) : null,
      },
    });

    if (supervisorId) {
      await prisma.promotionRecommendation.upsert({
        where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: employee.id } },
        create: {
          cycleId: cycle.id,
          employeeId: employee.id,
          supervisorId,
          recommendedPosition: position,
          reason: isNethmi
            ? "Sustained delivery and the PDP score support a move into a senior analyst role."
            : "Progress is visible, and a senior specialist role should be considered after the PIP checkpoints.",
          pdpScore: scoring?.earnedPoints ?? 0,
          status: isNethmi ? PromotionRecommendationStatus.SHORTLISTED : PromotionRecommendationStatus.PENDING,
          hrReason: isNethmi
            ? "Shortlisted. The final score and supervisor case support a promotion panel."
            : null,
          decidedById: isNethmi ? hr?.id ?? null : null,
          decidedAt: isNethmi ? new Date(Date.UTC(2026, 8, 22, 16, 0, 0)) : null,
        },
        update: {
          recommendedPosition: position,
          supervisorId,
          reason: isNethmi
            ? "Sustained delivery and the PDP score support a move into a senior analyst role."
            : "Progress is visible, and a senior specialist role should be considered after the PIP checkpoints.",
          pdpScore: scoring?.earnedPoints ?? 0,
          status: isNethmi ? PromotionRecommendationStatus.SHORTLISTED : PromotionRecommendationStatus.PENDING,
          hrReason: isNethmi
            ? "Shortlisted. The final score and supervisor case support a promotion panel."
            : null,
          decidedById: isNethmi ? hr?.id ?? null : null,
          decidedAt: isNethmi ? new Date(Date.UTC(2026, 8, 22, 16, 0, 0)) : null,
        },
      });
    }
  }
}

export async function seedDemoRefinements(prisma: PrismaClient) {
  await seedFinalSnapshots(prisma);
  await prisma.notification.deleteMany({
    where: { metadata: { path: ["demoKey"], equals: DEMO_KEY } },
  });

  const codes = [
    "EMP000001",
    "EMP000901",
    "EMP000902",
    "EMP000903",
    "EMP000904",
    "SUP000001",
    "HR000001",
    "HRM000001",
    "LED000001",
  ];
  const people = await prisma.employee.findMany({
    where: { employeeId: { in: codes } },
    select: { id: true, employeeId: true, role: true },
  });
  const byCode = new Map(people.map((person) => [person.employeeId, person]));

  for (const code of ["EMP000001", "EMP000901", "EMP000902", "EMP000903", "EMP000904"]) {
    const person = byCode.get(code);
    if (person) await writeNotes(prisma, person.id, employeeNotes("/employee"), person.id);
  }
  const supervisor = byCode.get("SUP000001");
  if (supervisor) await writeNotes(prisma, supervisor.id, supervisorNotes(), supervisor.id);
  const hr = byCode.get("HR000001");
  if (hr) await writeNotes(prisma, hr.id, hrNotes(), hr.id);
  const hrm = byCode.get("HRM000001");
  if (hrm) await writeNotes(prisma, hrm.id, hrmNotes(), hrm.id);
  const leadership = byCode.get("LED000001");
  if (leadership) await writeNotes(prisma, leadership.id, leadershipNotes(), leadership.id);

  console.log("Demo refinements seeded: final snapshots for EMP000901/902 and inbox notifications.");
}

if (process.argv[1]?.includes("seed-demo-refinements")) {
  const { default: dotenv } = await import("dotenv/config");
  void dotenv;
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  seedDemoRefinements(prisma)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
