import {
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
  PrismaClient,
  Role,
} from "../generated/prisma/client.js";

type Db = PrismaClient;

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

function demoNotes(employeeName: string, hrAttended: boolean) {
  return {
    previousAppraisal: {
      context: `${employeeName} met expectations last cycle with a B rating. Delivery was reliable and teamwork was a clear strength.`,
      discussion: "Reviewed last year's result, stakeholder feedback, and how stretch work landed.",
      decisions: "Keep the current role pathway and raise the quality bar on stakeholder communication.",
    },
    previousPdp: {
      context: "Previous PDP focused on documentation quality and one stretch delivery objective.",
      discussion: "Two of three previous objectives were completed. Presentation confidence still needs practice.",
      decisions: "Carry forward communication coaching and replace the completed stretch objective with a new ownership goal.",
    },
    strengthsWeaknesses: {
      context: "Strengths: reliability, peer support, technical follow-through. Development: stakeholder updates and documentation discipline.",
      discussion: "Employee recognised the same strengths and asked for earlier exposure to client conversations.",
      decisions: hrAttended
        ? "Supervisor and HR agreed to pair the employee with a mentor for monthly stakeholder briefings."
        : "Supervisor will mentor stakeholder briefings. HR declined attendance and the meeting continued.",
    },
    departmentObjectives: {
      context: "Department objectives emphasise secure delivery, reduced incident rework, and knowledge sharing.",
      discussion: "Employee can contribute through playbook updates and pairing on high-risk changes.",
      decisions: "Assign one knowledge-sharing session per quarter and one playbook improvement this cycle.",
    },
    companyObjectives: {
      context: "Company objectives include service reliability, people development, and customer trust.",
      discussion: "Aligned the employee's work to reliability and customer-facing communication.",
      decisions: "Include a measurable reliability contribution in the new PDP.",
    },
    developmentNeeds: {
      context: "Technical depth is solid. Soft skills and structured communication are the main development needs.",
      discussion: "Employee requested presentation coaching and a clearer path toward senior individual-contributor work.",
      decisions: "Book internal presentation coaching and review progress in the first follow-up meeting.",
    },
  };
}

export async function seedPlanningMeetings(prisma: Db) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) {
    console.log("Skipping planning meetings: no active appraisal cycle.");
    return;
  }

  const previousCycle = await prisma.appraisalCycle.findFirst({
    where: { startDate: { lt: cycle.startDate } },
    orderBy: { startDate: "desc" },
  });
  const previousBatch = previousCycle
    ? await prisma.appraisalBatch.findFirst({ where: { cycleId: previousCycle.id }, orderBy: { batchNumber: "asc" } })
    : null;

  const teams = await prisma.team.findMany({
    where: { supervisorId: { not: null } },
    include: {
      supervisor: true,
      department: true,
      hrAssignments: { include: { hrEmployee: true } },
      employees: {
        where: { role: Role.EMPLOYEE, deactivatedAt: null },
        include: { department: true },
        orderBy: { name: "asc" },
      },
    },
  });

  const team = teams
    .filter((item) => item.employees.length >= 8)
    .sort((a, b) => b.employees.length - a.employees.length)[0];

  if (!team?.supervisor) {
    console.log("Skipping planning meetings: no supervisor team with enough employees.");
    return;
  }

  const hr = team.hrAssignments[0]?.hrEmployee ?? (await prisma.employee.findFirst({ where: { role: Role.HR } }));
  const supervisor = team.supervisor;
  const members = team.employees.slice(0, 10);
  const departmentId = team.departmentId;

  await prisma.meeting.deleteMany({
    where: {
      type: MeetingType.PERFORMANCE_PLANNING,
      employeeId: { in: members.map((member) => member.id) },
    },
  });

  const companyCount = await prisma.companyObjective.count({ where: { cycleId: cycle.id } });
  if (companyCount === 0) {
    await prisma.companyObjective.createMany({
      data: [
        {
          cycleId: cycle.id,
          title: "Service reliability",
          description: "Reduce severity-1 incidents and improve recovery time across delivery teams.",
        },
        {
          cycleId: cycle.id,
          title: "People development",
          description: "Build coaching, presentation, and succession depth in every team.",
        },
        {
          cycleId: cycle.id,
          title: "Customer trust",
          description: "Improve stakeholder communication quality and delivery predictability.",
        },
      ],
    });
  }

  const deptCount = await prisma.departmentObjective.count({
    where: { departmentId, cycleId: cycle.id },
  });
  if (deptCount === 0) {
    await prisma.departmentObjective.createMany({
      data: [
        {
          departmentId,
          cycleId: cycle.id,
          title: "Secure and reliable delivery",
          description: "Keep change failure rate down and document high-risk procedures.",
        },
        {
          departmentId,
          cycleId: cycle.id,
          title: "Knowledge sharing",
          description: "Run quarterly internal sessions so expertise is not concentrated in a few people.",
        },
      ],
    });
  }

  if (previousCycle) {
    for (const member of members.slice(0, 5)) {
      await prisma.appraisalOutcome.upsert({
        where: { cycleId_employeeId: { cycleId: previousCycle.id, employeeId: member.id } },
        create: {
          employeeId: member.id,
          cycleId: previousCycle.id,
          overallResult: "Meets Expectations",
          ratingBand: "B",
          overallScore: 3.6,
          supervisorComments: "Consistent delivery and strong collaboration with the team.",
          developmentRecommendations: "Build presentation confidence and stretch ownership of larger initiatives.",
          achievements: "Delivered assigned cycle objectives on time and supported peer onboarding.",
          areasForImprovement: "Stakeholder communication and documentation discipline.",
          outcomes: "Confirmed in role with a standard increment pathway.",
        },
        update: {},
      });

      if (previousBatch) {
        await prisma.personalDevelopmentPlan.upsert({
          where: { cycleId_employeeId: { cycleId: previousCycle.id, employeeId: member.id } },
          create: {
            employeeId: member.id,
            supervisorId: supervisor.id,
            cycleId: previousCycle.id,
            batchId: previousBatch.id,
            createdById: supervisor.id,
            status: "COMPLETED",
            summary: `Previous-cycle PDP for ${member.name} covering delivery quality and communication.`,
            goals: {
              create: [
                {
                  title: "Improve documentation quality",
                  objective: "Keep runbooks current for assigned services.",
                  expectedOutcome: "Fewer handover gaps during incidents.",
                  progress: 90,
                  status: "COMPLETED",
                  sortOrder: 1,
                },
                {
                  title: "Lead one stretch delivery",
                  objective: "Own a mid-sized change from planning through release.",
                  expectedOutcome: "Independent ownership with supervisor oversight.",
                  progress: 80,
                  status: "COMPLETED",
                  sortOrder: 2,
                },
                {
                  title: "Stakeholder briefing practice",
                  objective: "Present a monthly update to the supervisor and one peer.",
                  expectedOutcome: "Clearer verbal updates with less prompting.",
                  progress: 45,
                  status: "IN_PROGRESS",
                  sortOrder: 3,
                },
              ],
            },
          },
          update: {},
        });
      }
    }
  }

  async function createMeeting(params: {
    employee: (typeof members)[number];
    status: MeetingStatus;
    scheduledAt: Date;
    endAt: Date;
    employeeResponse: MeetingParticipantResponse;
    employeeReason?: string;
    hrResponse?: MeetingParticipantResponse;
    hrReason?: string;
    notes?: boolean;
    reschedule?: string;
  }) {
    const meeting = await prisma.meeting.create({
      data: {
        type: MeetingType.PERFORMANCE_PLANNING,
        title: `Performance Planning Meeting — ${params.employee.name}`,
        description: "Initial performance planning meeting for the current appraisal cycle.",
        employeeId: params.employee.id,
        supervisorId: supervisor.id,
        createdById: supervisor.id,
        cycleId: cycle.id,
        scheduledAt: params.scheduledAt,
        endAt: params.endAt,
        location: "Microsoft Teams (Online)",
        status: params.status,
        participants: {
          create: [
            {
              employeeId: supervisor.id,
              participantRole: MeetingParticipantRole.SUPERVISOR,
              response: MeetingParticipantResponse.ACCEPTED,
              respondedAt: new Date(),
            },
            {
              employeeId: params.employee.id,
              participantRole: MeetingParticipantRole.EMPLOYEE,
              response: params.employeeResponse,
              responseMessage: params.employeeReason ?? null,
              respondedAt:
                params.employeeResponse === MeetingParticipantResponse.PENDING ? null : params.scheduledAt,
            },
            ...(hr
              ? [
                  {
                    employeeId: hr.id,
                    participantRole: MeetingParticipantRole.HR,
                    response: params.hrResponse ?? MeetingParticipantResponse.PENDING,
                    responseMessage: params.hrReason ?? null,
                    respondedAt:
                      !params.hrResponse || params.hrResponse === MeetingParticipantResponse.PENDING
                        ? null
                        : params.scheduledAt,
                  },
                ]
              : []),
          ],
        },
      },
    });

    if (params.notes) {
      const sections = demoNotes(params.employee.name, params.hrResponse === MeetingParticipantResponse.ACCEPTED);
      await prisma.meetingNotes.create({
        data: {
          meetingId: meeting.id,
          createdById: supervisor.id,
          discussionSummary: sections.strengthsWeaknesses.discussion,
          keyPoints: sections.previousAppraisal.context,
          decisionsMade: sections.developmentNeeds.decisions,
          actionItemsList: sections,
        },
      });
    }

    if (params.reschedule) {
      await prisma.meetingRescheduleRequest.create({
        data: {
          meetingId: meeting.id,
          requesterId: params.employee.id,
          reason: params.reschedule,
          status: "PENDING",
        },
      });
    }

    return meeting;
  }

  const [one, two, three, pending, reschedule, hrDeclined] = members;

  if (one) {
    await createMeeting({
      employee: one,
      status: MeetingStatus.COMPLETED,
      scheduledAt: at(2026, 9, 8, 4, 30),
      endAt: at(2026, 9, 8, 5, 30),
      employeeResponse: MeetingParticipantResponse.ACCEPTED,
      hrResponse: MeetingParticipantResponse.ACCEPTED,
      notes: true,
    });
  }
  if (two) {
    await createMeeting({
      employee: two,
      status: MeetingStatus.COMPLETED,
      scheduledAt: at(2026, 9, 10, 8, 0),
      endAt: at(2026, 9, 10, 9, 0),
      employeeResponse: MeetingParticipantResponse.ACCEPTED,
      hrResponse: MeetingParticipantResponse.ACCEPTED,
      notes: true,
    });
  }
  if (three) {
    await createMeeting({
      employee: three,
      status: MeetingStatus.COMPLETED,
      scheduledAt: at(2026, 9, 12, 5, 0),
      endAt: at(2026, 9, 12, 6, 0),
      employeeResponse: MeetingParticipantResponse.ACCEPTED,
      hrResponse: MeetingParticipantResponse.REJECTED,
      hrReason: "Conflicting onboarding session; supervisor and employee proceeded.",
      notes: true,
    });
  }
  if (pending) {
    await createMeeting({
      employee: pending,
      status: MeetingStatus.SCHEDULED,
      scheduledAt: at(2026, 9, 24, 8, 0),
      endAt: at(2026, 9, 24, 9, 0),
      employeeResponse: MeetingParticipantResponse.PENDING,
      hrResponse: MeetingParticipantResponse.PENDING,
    });
  }
  if (reschedule) {
    await createMeeting({
      employee: reschedule,
      status: MeetingStatus.RESCHEDULE_REQUESTED,
      scheduledAt: at(2026, 9, 25, 9, 0),
      endAt: at(2026, 9, 25, 10, 0),
      employeeResponse: MeetingParticipantResponse.RESCHEDULE_REQUESTED,
      employeeReason: "Clash with a client workshop already booked that afternoon.",
      hrResponse: MeetingParticipantResponse.PENDING,
      reschedule: "Clash with a client workshop already booked that afternoon.",
    });
  }
  if (hrDeclined) {
    await createMeeting({
      employee: hrDeclined,
      status: MeetingStatus.SCHEDULED,
      scheduledAt: at(2026, 9, 26, 5, 30),
      endAt: at(2026, 9, 26, 6, 30),
      employeeResponse: MeetingParticipantResponse.ACCEPTED,
      hrResponse: MeetingParticipantResponse.REJECTED,
      hrReason: "Conflicting onboarding session; supervisor and employee can proceed.",
    });
  }

  console.log(
    `Seeded performance planning meetings for ${supervisor.name} / team ${team.name} (${members.length} employees, 3 completed).`
  );
}
