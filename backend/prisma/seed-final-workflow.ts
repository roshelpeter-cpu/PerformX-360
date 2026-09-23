import {
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
  NotificationStatus,
  NotificationType,
  PdpStatus,
  PdpSubGoalStatus,
  PeerReviewSubmissionStatus,
  PeerSelectionStatus,
  PrismaClient,
  PromotionRecommendationStatus,
  SelfReviewStatus,
  SupervisorReviewDecision,
} from "../generated/prisma/client.js";
import { PEER_REVIEW_QUESTIONS, scoreForPeerRating } from "../src/constants/peer-review-questions.js";
import { SELF_REVIEW_QUESTIONS } from "../src/constants/self-review-questions.js";
import { scoreForRating, summarizeSelfReview } from "../src/utils/self-review-scoring.js";
import { computeBonus } from "../src/utils/bonus-formula.js";
import { finalPerformanceScore } from "../src/utils/performance-score.js";

const PROTECTED = new Set(["EMP000001", "EMP000901", "EMP000902", "EMP000903", "EMP000904"]);

function evidence() {
  return [
    {
      fileName: "completion-evidence.pdf",
      storedName: "demo-completion-evidence.pdf",
      mimeType: "application/pdf",
      size: 18432,
      uploadedAt: new Date().toISOString(),
    },
  ];
}

export async function seedFinalWorkflow(prisma: PrismaClient) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) {
    console.log("  Final workflow seed skipped: no active cycle");
    return;
  }

  await prisma.notification.deleteMany({
    where: { metadata: { path: ["demoKey"], equals: "final-workflow" } },
  });

  const supervisor = await prisma.employee.findUnique({
    where: { employeeId: "SUP000001" },
    include: {
      supervisedTeams: {
        include: {
          employees: { where: { role: "EMPLOYEE", deactivatedAt: null }, orderBy: { employeeId: "asc" } },
        },
      },
    },
  });
  const hr = await prisma.employee.findUnique({ where: { employeeId: "HR000001" } });
  const hrManager = await prisma.employee.findUnique({ where: { employeeId: "HRM000001" } });
  if (!supervisor || !hr) {
    console.log("  Final workflow seed skipped: demo supervisor or HR missing");
    return;
  }

  const team = supervisor.supervisedTeams[0];
  const candidates = (team?.employees ?? []).filter((employee) => !PROTECTED.has(employee.employeeId));
  await raiseLateStagePdps(prisma, cycle.id, candidates.slice(0, 2).map((employee) => employee.id));
  await seedPeerStates(prisma, cycle.id);
  await seedPromotions(prisma, cycle.id, hr.id);
  await seedDiscussionMeetings(prisma, cycle.id, supervisor.id, hr.id);
  await seedCompletedPackages(prisma, cycle.id, supervisor.id, hr.id);
  if (hrManager) {
    await seedBonusDemo(prisma, cycle.id, hrManager.id);
    await prisma.notification.create({
      data: {
        type: NotificationType.PROMOTION_RECOMMENDED,
        title: "Promotion recommendation submitted",
        message: "A supervisor submitted a promotion recommendation for HR review.",
        recipientId: hr.id,
        status: NotificationStatus.UNREAD,
        metadata: { demoKey: "final-workflow" },
      },
    });
  }
  console.log("  Final evaluation workflow demo states seeded");
}

async function raiseLateStagePdps(prisma: PrismaClient, cycleId: string, employeeIds: string[]) {
  const ratios = [1, 0.92];
  for (const [index, employeeId] of employeeIds.entries()) {
    const pdp = await prisma.personalDevelopmentPlan.findFirst({
      where: { cycleId, employeeId },
      include: { goals: { include: { subGoals: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } },
    });
    if (!pdp) continue;
    const subs = pdp.goals.flatMap((goal) => goal.subGoals);
    if (subs.length === 0) continue;
    const keep = Math.max(1, Math.round(subs.length * (ratios[index] ?? 0.86)));
    for (const [subIndex, sub] of subs.entries()) {
      const completed = subIndex < keep;
      await prisma.pdpSubGoal.update({
        where: { id: sub.id },
        data: completed
          ? {
              status: PdpSubGoalStatus.COMPLETED,
              submittedStatus: PdpSubGoalStatus.COMPLETED,
              approvedAt: new Date(),
              reviewedAt: new Date(),
              evidenceCount: 1,
              evidenceFiles: evidence(),
              supervisorComment: "Approved with evidence. This counts toward the PDP score.",
            }
          : {
              status: PdpSubGoalStatus.IN_PROGRESS,
              submittedStatus: null,
              approvedAt: null,
              evidenceCount: 0,
              evidenceFiles: [],
            },
      });
    }
    await prisma.personalDevelopmentPlan.update({
      where: { id: pdp.id },
      data: { status: PdpStatus.ACTIVE },
    });
  }

  const completed = await prisma.personalDevelopmentPlan.findFirst({
    where: {
      cycleId,
      status: { in: [PdpStatus.ACTIVE, PdpStatus.APPROVED] },
      employeeId: { notIn: employeeIds },
      employee: { employeeId: { notIn: [...PROTECTED] }, role: "EMPLOYEE" },
    },
    select: { id: true, employeeId: true },
  });
  if (completed) {
    await prisma.personalDevelopmentPlan.update({
      where: { id: completed.id },
      data: { status: PdpStatus.COMPLETED },
    });
  }
}

async function seedPeerStates(prisma: PrismaClient, cycleId: string) {
  const existing = await prisma.peerSelection.findMany({
    where: { cycleId },
    select: { subjectEmployeeId: true, status: true },
  });
  const taken = new Set(existing.map((row) => row.subjectEmployeeId));
  const pool = await prisma.employee.findMany({
    where: { role: "EMPLOYEE", deactivatedAt: null, employeeId: { notIn: [...PROTECTED] }, id: { notIn: [...taken] } },
    orderBy: { employeeId: "asc" },
    take: 80,
  });
  let inProgressCount = existing.filter((row) => row.status === "IN_PROGRESS").length;
  let selectedCount = existing.filter((row) => row.status === "SELECTED").length;
  let cursor = 0;

  function nextGroup(size: number) {
    const slice = pool.slice(cursor, cursor + size);
    cursor += size;
    return slice;
  }

  while (inProgressCount < 8 && pool.length - cursor >= 6) {
    const group = nextGroup(6);
    const [subject, ...peers] = group;
    if (!subject) break;
    await prisma.peerSelection.create({
      data: {
        cycleId,
        subjectEmployeeId: subject.id,
        status: PeerSelectionStatus.IN_PROGRESS,
        recommendations: {
          create: peers.slice(0, 5).map((peer, index) => ({
            peerEmployeeId: peer.id,
            selected: false,
            sortOrder: index + 1,
          })),
        },
      },
    });
    inProgressCount += 1;
  }

  let extraSelected = selectedCount;
  while (extraSelected < 10 && pool.length - cursor >= 6) {
    const group = nextGroup(6);
    const [subject, ...peers] = group;
    if (!subject) break;
    await prisma.peerSelection.create({
      data: {
        cycleId,
        subjectEmployeeId: subject.id,
        status: PeerSelectionStatus.SELECTED,
        recommendations: {
          create: peers.slice(0, 5).map((peer, index) => ({
            peerEmployeeId: peer.id,
            selected: index < 2,
            sortOrder: index + 1,
          })),
        },
      },
    });
    extraSelected += 1;
  }
}

async function seedPromotions(prisma: PrismaClient, cycleId: string, hrId: string) {
  await prisma.promotionRecommendation.deleteMany({ where: { cycleId } });
  const supervisors = await prisma.employee.findMany({
    where: { role: "SUPERVISOR", deactivatedAt: null },
    include: {
      supervisedTeams: {
        include: {
          department: true,
          employees: { where: { role: "EMPLOYEE", deactivatedAt: null }, take: 1, orderBy: { name: "asc" } },
        },
      },
    },
    take: 20,
  });
  const reasons = [
    "Consistently delivered the agreed PDP outcomes and is ready for a broader role.",
    "Led delivery for the team while keeping quality evidence on every completed sub-goal.",
    "Customer outcomes improved and the current PDP score supports a promotion case.",
    "Ready for the next grade based on sustained delivery across this appraisal cycle.",
    "Strong stakeholder feedback and a completed development plan justify a shortlist.",
    "The role has outgrown the current grade. Promotion would match the work already being done.",
    "Demonstrated the next-level behaviours in the active PDP, including mentoring peers.",
    "Delivery, evidence, and supervisor review all support moving this case to HR.",
    "A promotion now would recognise the stretch work already operating at the next grade.",
    "HR should review this case. The PDP is mature and the supervisor recommendation is specific.",
  ];
  const statuses: PromotionRecommendationStatus[] = [
    "PENDING",
    "PENDING",
    "PENDING",
    "PENDING",
    "SHORTLISTED",
    "SHORTLISTED",
    "SHORTLISTED",
    "REJECTED",
    "REJECTED",
    "REJECTED",
  ];
  const hrReasons = [
    "Shortlisted for the next promotion panel. The PDP score and supervisor case are consistent.",
    "Shortlisted. Evidence and the supervisor reason support a formal promotion review.",
    "Shortlisted with a note to confirm the grade budget before the panel.",
    "Rejected for this cycle. The case needs another period of sustained delivery.",
    "Rejected. The recommendation is noted, but the current band does not yet support promotion.",
    "Rejected after review. Ask the supervisor to revisit this at the next appraisal cycle.",
  ];
  let created = 0;
  let decisionIndex = 0;
  const used = new Set<string>();
  for (const supervisor of supervisors) {
    if (created >= 10) break;
    const employee = supervisor.supervisedTeams.flatMap((team) => team.employees)[0];
    if (!employee || used.has(employee.id)) continue;
    used.add(employee.id);
    const status = statuses[created] ?? "PENDING";
    const decided = status !== "PENDING";
    await prisma.promotionRecommendation.create({
      data: {
        cycleId,
        employeeId: employee.id,
        supervisorId: supervisor.id,
        reason: reasons[created] ?? reasons[0]!,
        pdpScore: 70 + created,
        status,
        hrReason: decided ? hrReasons[decisionIndex] ?? null : null,
        decidedById: decided ? hrId : null,
        decidedAt: decided ? new Date(Date.UTC(2026, 8, 10 + created)) : null,
        createdAt: new Date(Date.UTC(2026, 8, 1 + created)),
      },
    });
    if (decided) decisionIndex += 1;
    created += 1;
  }
}

async function seedDiscussionMeetings(
  prisma: PrismaClient,
  cycleId: string,
  supervisorId: string,
  hrId: string
) {
  await prisma.meeting.deleteMany({
    where: { type: { in: [MeetingType.PDP_DISAGREEMENT, MeetingType.PIP_DISCUSSION] } },
  });
  const nethmi = await prisma.employee.findUnique({ where: { employeeId: "EMP000901" } });
  const others = await prisma.employee.findMany({
    where: { role: "EMPLOYEE", deactivatedAt: null, employeeId: { notIn: [...PROTECTED] }, team: { supervisorId: { not: null } } },
    include: { team: { select: { supervisorId: true } } },
    orderBy: { employeeId: "asc" },
    take: 80,
  });
  const seenSupervisors = new Set<string>([supervisorId]);
  const withSupervisor = others.filter((employee) => {
    const owner = employee.team?.supervisorId;
    if (!owner || seenSupervisors.has(owner)) return false;
    seenSupervisors.add(owner);
    return true;
  });
  const pick = (index: number) => withSupervisor[index] ?? others[index];
  if (!nethmi) return;

  async function createMeeting(input: {
    type: MeetingType;
    title: string;
    purpose: string;
    employeeId: string;
    supervisorId: string;
    hrId: string;
    status: MeetingStatus;
    employeeResponse: MeetingParticipantResponse;
    hrResponse: MeetingParticipantResponse;
    reason?: string;
    when: Date;
  }) {
    const end = new Date(input.when.getTime() + 60 * 60 * 1000);
    const meeting = await prisma.meeting.create({
      data: {
        type: input.type,
        title: input.title,
        description: input.purpose,
        employeeId: input.employeeId,
        supervisorId: input.supervisorId,
        createdById: input.supervisorId,
        cycleId,
        scheduledAt: input.when,
        endAt: end,
        location: "Altrium Meeting Room",
        status: input.status,
        participants: {
          create: [
            {
              employeeId: input.supervisorId,
              participantRole: MeetingParticipantRole.SUPERVISOR,
              response: MeetingParticipantResponse.ACCEPTED,
              respondedAt: input.when,
            },
            {
              employeeId: input.employeeId,
              participantRole: MeetingParticipantRole.EMPLOYEE,
              response: input.employeeResponse,
              responseMessage: input.reason ?? null,
              respondedAt: input.employeeResponse === "PENDING" ? null : input.when,
            },
            {
              employeeId: input.hrId,
              participantRole: MeetingParticipantRole.HR,
              response: input.hrResponse,
              respondedAt: input.hrResponse === "PENDING" ? null : input.when,
            },
          ],
        },
      },
    });
    if (input.reason) {
      await prisma.meetingRescheduleRequest.create({
        data: {
          meetingId: meeting.id,
          requesterId: input.employeeId,
          reason: input.reason,
          status: "PENDING",
        },
      });
    }
    const recipients = [input.employeeId, input.hrId, input.supervisorId];
    for (const recipientId of recipients) {
      await prisma.notification.create({
        data: {
          type:
            input.status === MeetingStatus.CONFIRMED
              ? NotificationType.MEETING_CONFIRMED
              : input.status === MeetingStatus.RESCHEDULE_REQUESTED
                ? NotificationType.MEETING_RESCHEDULE_REQUEST
                : NotificationType.MEETING_INVITATION,
          title:
            input.type === MeetingType.PIP_DISCUSSION
              ? "PIP meeting invitation"
              : "PDP disagreement meeting invitation",
          message: `${input.title}. ${input.purpose}`,
          recipientId,
          subjectEmployeeId: input.employeeId,
          status: NotificationStatus.UNREAD,
          metadata: { demoKey: "final-workflow", meetingId: meeting.id },
        },
      });
    }
  }

  await createMeeting({
    type: MeetingType.PDP_DISAGREEMENT,
    title: "PDP Disagreement Discussion – EMP000901",
    purpose: "Discuss the disagreed stretch goal and agree what stays in the active PDP.",
    employeeId: nethmi.id,
    supervisorId,
    hrId,
    status: MeetingStatus.CONFIRMED,
    employeeResponse: MeetingParticipantResponse.ACCEPTED,
    hrResponse: MeetingParticipantResponse.ACCEPTED,
    when: new Date(Date.UTC(2026, 8, 24, 9, 0, 0)),
  });

  const rescheduleEmployee = pick(0);
  const pendingEmployee = pick(1);
  const pipEmployee = pick(2);
  const pipReschedule = pick(3);
  if (!rescheduleEmployee?.team?.supervisorId || !pendingEmployee?.team?.supervisorId || !pipEmployee?.team?.supervisorId || !pipReschedule?.team?.supervisorId) {
    return;
  }

  await createMeeting({
    type: MeetingType.PDP_DISAGREEMENT,
    title: `PDP Disagreement Discussion – ${rescheduleEmployee.employeeId}`,
    purpose: "The employee disagrees with one success measure and asked for a later discussion.",
    employeeId: rescheduleEmployee.id,
    supervisorId: rescheduleEmployee.team.supervisorId,
    hrId,
    status: MeetingStatus.RESCHEDULE_REQUESTED,
    employeeResponse: MeetingParticipantResponse.RESCHEDULE_REQUESTED,
    hrResponse: MeetingParticipantResponse.PENDING,
    reason: "I am with a customer workshop at the proposed time. Please move this to the following morning.",
    when: new Date(Date.UTC(2026, 8, 25, 11, 0, 0)),
  });
  await createMeeting({
    type: MeetingType.PDP_DISAGREEMENT,
    title: `PDP Disagreement Discussion – ${pendingEmployee.employeeId}`,
    purpose: "Pending participant response on a disagreed development objective.",
    employeeId: pendingEmployee.id,
    supervisorId: pendingEmployee.team.supervisorId,
    hrId,
    status: MeetingStatus.SCHEDULED,
    employeeResponse: MeetingParticipantResponse.PENDING,
    hrResponse: MeetingParticipantResponse.PENDING,
    when: new Date(Date.UTC(2026, 8, 28, 14, 0, 0)),
  });
  await createMeeting({
    type: MeetingType.PIP_DISCUSSION,
    title: `PIP Discussion – ${pipEmployee.employeeId}`,
    purpose: "Confirm the performance improvement plan, the support available, and the review date.",
    employeeId: pipEmployee.id,
    supervisorId: pipEmployee.team.supervisorId,
    hrId,
    status: MeetingStatus.CONFIRMED,
    employeeResponse: MeetingParticipantResponse.ACCEPTED,
    hrResponse: MeetingParticipantResponse.ACCEPTED,
    when: new Date(Date.UTC(2026, 8, 26, 10, 0, 0)),
  });
  await createMeeting({
    type: MeetingType.PIP_DISCUSSION,
    title: `PIP Discussion – ${pipReschedule.employeeId}`,
    purpose: "Discuss the improvement plan after a missed milestone. The employee has asked to reschedule.",
    employeeId: pipReschedule.id,
    supervisorId: pipReschedule.team.supervisorId,
    hrId,
    status: MeetingStatus.RESCHEDULE_REQUESTED,
    employeeResponse: MeetingParticipantResponse.RESCHEDULE_REQUESTED,
    hrResponse: MeetingParticipantResponse.ACCEPTED,
    reason: "I need my union representative present. Please offer a time later the same week.",
    when: new Date(Date.UTC(2026, 8, 27, 15, 0, 0)),
  });
}

function peerResponses(name: string, rating: number) {
  return PEER_REVIEW_QUESTIONS.map((question) => ({
    questionKey: question.key,
    question: question.text,
    sortOrder: question.sortOrder,
    rating,
    score: scoreForPeerRating(rating),
    reason: `${name} rated this ${rating} out of 5 based on shared work during the appraisal period.`,
  }));
}

function selfResponses(name: string, rating: number) {
  const scores = SELF_REVIEW_QUESTIONS.map(() => scoreForRating(rating));
  const summary = summarizeSelfReview(scores);
  return {
    summary,
    responses: SELF_REVIEW_QUESTIONS.map((question, index) => ({
      questionKey: question.key,
      question: question.text,
      sortOrder: question.sortOrder,
      evidenceRequired: question.evidenceRequired,
      rating,
      score: scores[index]!,
      reason: `${name} rated this ${rating} out of 5. ${question.text}`,
    })),
  };
}

async function ensureCompletedPdp(
  prisma: PrismaClient,
  cycleId: string,
  employee: { id: string; name: string; employeeId: string },
  supervisorId: string
) {
  let pdp = await prisma.personalDevelopmentPlan.findFirst({
    where: { cycleId, employeeId: employee.id },
    include: { goals: { include: { subGoals: true } } },
  });
  if (!pdp) {
    const batch = await prisma.appraisalBatch.findFirst({
      where: { cycleId },
      select: { id: true },
    });
    if (!batch) return null;
    pdp = await prisma.personalDevelopmentPlan.create({
      data: {
        employeeId: employee.id,
        supervisorId,
        cycleId,
        batchId: batch.id,
        title: `Active PDP — ${employee.name}`,
        summary: `Completed demonstration PDP for ${employee.name}.`,
        status: PdpStatus.ACTIVE,
        createdById: supervisorId,
        currentVersionNumber: 1,
        assignedAt: new Date(Date.UTC(2026, 3, 1)),
        activatedAt: new Date(Date.UTC(2026, 3, 2)),
        approvedAt: new Date(Date.UTC(2026, 2, 28)),
        approvedById: supervisorId,
        goals: {
          create: [
            {
              title: "Deliver agreed cycle outcomes",
              objective: `${employee.name} will complete the agreed development outcomes.`,
              expectedOutcome: "Goals completed with evidence.",
              developmentArea: "Delivery Quality",
              category: "Delivery Quality",
              sortOrder: 0,
              subGoals: {
                create: [1, 2, 3].map((index) => ({
                  title: `Outcome milestone ${index}`,
                  description: `Complete milestone ${index} for ${employee.name}.`,
                  sortOrder: index - 1,
                  status: PdpSubGoalStatus.COMPLETED,
                  submittedStatus: PdpSubGoalStatus.COMPLETED,
                  approvedAt: new Date(),
                  reviewedAt: new Date(),
                  evidenceCount: 1,
                  evidenceFiles: evidence(),
                  supervisorComment: "Approved with evidence.",
                })),
              },
            },
          ],
        },
      },
      include: { goals: { include: { subGoals: true } } },
    });
    await prisma.pdpVersion.create({
      data: {
        pdpId: pdp.id,
        versionNumber: 1,
        title: pdp.title,
        summary: pdp.summary,
        isCurrent: true,
        createdById: supervisorId,
      },
    });
    return pdp;
  }
  for (const goal of pdp.goals) {
    for (const sub of goal.subGoals) {
      if (sub.status === PdpSubGoalStatus.COMPLETED) continue;
      await prisma.pdpSubGoal.update({
        where: { id: sub.id },
        data: {
          status: PdpSubGoalStatus.COMPLETED,
          submittedStatus: PdpSubGoalStatus.COMPLETED,
          approvedAt: new Date(),
          reviewedAt: new Date(),
          evidenceCount: 1,
          evidenceFiles: evidence(),
          supervisorComment: "Approved with evidence. This counts toward the PDP score.",
        },
      });
    }
  }
  await prisma.personalDevelopmentPlan.update({
    where: { id: pdp.id },
    data: { status: PdpStatus.ACTIVE },
  });
  return pdp;
}

async function seedCompletedPackages(
  prisma: PrismaClient,
  cycleId: string,
  fallbackSupervisorId: string,
  hrId: string
) {
  const supervisorTeam = await prisma.employee.findMany({
    where: {
      role: "EMPLOYEE",
      deactivatedAt: null,
      employeeId: { notIn: [...PROTECTED] },
      team: { supervisorId: fallbackSupervisorId },
    },
    include: { team: { select: { supervisorId: true } } },
    orderBy: { employeeId: "asc" },
    take: 6,
  });
  const others = await prisma.employee.findMany({
    where: {
      role: "EMPLOYEE",
      deactivatedAt: null,
      employeeId: { notIn: [...PROTECTED] },
      id: { notIn: supervisorTeam.map((employee) => employee.id) },
    },
    include: { team: { select: { supervisorId: true } } },
    orderBy: { employeeId: "asc" },
    take: 40,
  });
  const reviewers = await prisma.employee.findMany({
    where: { role: "EMPLOYEE", deactivatedAt: null, employeeId: { notIn: [...PROTECTED] } },
    orderBy: { employeeId: "desc" },
    take: 80,
  });
  const targets = [...supervisorTeam.slice(0, 3), ...others].slice(0, 30);

  for (const [index, employee] of targets.entries()) {
    const supervisorId = employee.team?.supervisorId ?? fallbackSupervisorId;
    const pdp = await ensureCompletedPdp(prisma, cycleId, employee, supervisorId);
    if (!pdp) continue;

    const rating = index % 5 === 0 ? 5 : index % 4 === 0 ? 3 : 4;
    const self = selfResponses(employee.name, rating);
    await prisma.selfReview.upsert({
      where: { employeeId_cycleId: { employeeId: employee.id, cycleId } },
      create: {
        employeeId: employee.id,
        cycleId,
        status: SelfReviewStatus.SUBMITTED,
        totalScore: self.summary.totalScore,
        percentage: self.summary.percentage,
        submittedAt: new Date(Date.UTC(2026, 8, 16, 10, 0, 0)),
        responses: { create: self.responses },
      },
      update: {
        status: SelfReviewStatus.SUBMITTED,
        totalScore: self.summary.totalScore,
        percentage: self.summary.percentage,
        submittedAt: new Date(Date.UTC(2026, 8, 16, 10, 0, 0)),
      },
    });

    const peerPair = reviewers.filter((person) => person.id !== employee.id).slice(index, index + 2);
    if (peerPair.length < 2) continue;
    const existingSelection = await prisma.peerSelection.findUnique({
      where: { cycleId_subjectEmployeeId: { cycleId, subjectEmployeeId: employee.id } },
    });
    if (!existingSelection) {
      await prisma.peerSelection.create({
        data: {
          cycleId,
          subjectEmployeeId: employee.id,
          status: PeerSelectionStatus.SELECTED,
          recommendations: {
            create: peerPair.map((peer, peerIndex) => ({
              peerEmployeeId: peer.id,
              selected: true,
              sortOrder: peerIndex + 1,
            })),
          },
        },
      });
    }
    for (const peer of peerPair) {
      const total = Number((scoreForPeerRating(rating) * PEER_REVIEW_QUESTIONS.length).toFixed(2));
      await prisma.peerReview.upsert({
        where: {
          cycleId_subjectEmployeeId_reviewerEmployeeId: {
            cycleId,
            subjectEmployeeId: employee.id,
            reviewerEmployeeId: peer.id,
          },
        },
        create: {
          cycleId,
          subjectEmployeeId: employee.id,
          reviewerEmployeeId: peer.id,
          status: PeerReviewSubmissionStatus.SUBMITTED,
          totalScore: total,
          comment: `${peer.name} completed a confidential peer review of ${employee.name}.`,
          submittedAt: new Date(Date.UTC(2026, 8, 18, 9, 0, 0)),
          responses: { create: peerResponses(peer.name, rating) },
        },
        update: {
          status: PeerReviewSubmissionStatus.SUBMITTED,
          totalScore: total,
          comment: `${peer.name} completed a confidential peer review of ${employee.name}.`,
          submittedAt: new Date(Date.UTC(2026, 8, 18, 9, 0, 0)),
        },
      });
    }

    await prisma.supervisorReview.upsert({
      where: { cycleId_employeeId: { cycleId, employeeId: employee.id } },
      create: {
        cycleId,
        employeeId: employee.id,
        supervisorId,
        decision: SupervisorReviewDecision.APPROVED,
        comment: `${employee.name} completed the agreed PDP with evidence. Supervisor review is approved.`,
        decidedAt: new Date(Date.UTC(2026, 8, 21, 11, 0, 0)),
      },
      update: {
        decision: SupervisorReviewDecision.APPROVED,
        comment: `${employee.name} completed the agreed PDP with evidence. Supervisor review is approved.`,
        decidedAt: new Date(Date.UTC(2026, 8, 21, 11, 0, 0)),
      },
    });

    if (index < 6) {
      await prisma.finalEvaluation.upsert({
        where: { cycleId_employeeId: { cycleId, employeeId: employee.id } },
        create: {
          cycleId,
          employeeId: employee.id,
          status: "FINAL_APPROVED",
          approvedById: hrId,
          approvedAt: new Date(Date.UTC(2026, 8, 22, 14, 0, 0)),
        },
        update: {
          status: "FINAL_APPROVED",
          approvedById: hrId,
          approvedAt: new Date(Date.UTC(2026, 8, 22, 14, 0, 0)),
        },
      });
    }
  }
}

async function seedBonusDemo(prisma: PrismaClient, cycleId: string, hrmId: string) {
  await prisma.bonusCalculation.deleteMany({ where: { cycleId } });
  const approved = await prisma.supervisorReview.findMany({
    where: {
      cycleId,
      decision: SupervisorReviewDecision.APPROVED,
      employee: { employeeId: { notIn: [...PROTECTED] } },
    },
    select: { employeeId: true },
    take: 40,
  });
  const authorizedIds = approved.slice(0, 10).map((row) => row.employeeId);
  for (const employeeId of authorizedIds) {
    const pdp = await prisma.personalDevelopmentPlan.findFirst({
      where: { cycleId, employeeId },
      select: { goals: { select: { subGoals: { select: { status: true } } } } },
    });
    const completed = pdp?.goals.flatMap((goal) => goal.subGoals).filter((sub) => sub.status === "COMPLETED").length ?? 0;
    const total = pdp?.goals.flatMap((goal) => goal.subGoals).length ?? 1;
    const earned = total ? (completed / total) * 100 : 80;
    const self = await prisma.selfReview.findUnique({
      where: { employeeId_cycleId: { employeeId, cycleId } },
      select: { totalScore: true, status: true },
    });
    const peers = await prisma.peerReview.findMany({
      where: { cycleId, subjectEmployeeId: employeeId, status: "SUBMITTED" },
      select: { totalScore: true },
    });
    const scores = finalPerformanceScore(
      self?.status === "SUBMITTED" ? self.totalScore : 16,
      Number(peers.reduce((sum, review) => sum + review.totalScore, 0).toFixed(2)),
      earned
    );
    const computed = computeBonus(scores.total);
    await prisma.bonusCalculation.create({
      data: {
        cycleId,
        employeeId,
        finalScore: computed.finalScore,
        band: computed.band,
        bonusMonths: computed.bonusMonths,
        dailyAmount: computed.dailyAmount,
        workingDaysPerMonth: computed.workingDaysPerMonth,
        amount: computed.amount,
        calculation: computed.calculation,
        status: "AUTHORIZED",
        authorizedById: hrmId,
        authorizedAt: new Date(Date.UTC(2026, 8, 23, 9, 0, 0)),
      },
    });
  }
}
