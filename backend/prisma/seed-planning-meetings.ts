import { MeetingParticipantResponse, MeetingParticipantRole, MeetingStatus, MeetingType, PrismaClient, Role } from "../generated/prisma/client.js";

type Db = PrismaClient;

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
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

  const teams = await prisma.team.findMany({
    where: { supervisorId: { not: null } },
    include: {
      supervisor: true,
      hrAssignments: { include: { hrEmployee: true } },
      employees: {
        where: { role: Role.EMPLOYEE },
        include: { department: true },
        orderBy: { name: "asc" },
      },
    },
  });

  const team = teams
    .filter((item) => item.employees.length >= 6)
    .sort((a, b) => b.employees.length - a.employees.length)[0];

  if (!team?.supervisor) {
    console.log("Skipping planning meetings: no supervisor team with enough employees.");
    return;
  }

  const hr = team.hrAssignments[0]?.hrEmployee ?? (await prisma.employee.findFirst({ where: { role: Role.HR } }));
  const supervisor = team.supervisor;
  const members = team.employees.slice(0, 8);

  await prisma.meeting.deleteMany({
    where: {
      type: MeetingType.PERFORMANCE_PLANNING,
      employeeId: { in: members.map((member) => member.id) },
    },
  });

  if (previousCycle) {
    for (const member of members.slice(0, 4)) {
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
      await prisma.meetingNotes.create({
        data: {
          meetingId: meeting.id,
          createdById: supervisor.id,
          discussionSummary: "Agreed to focus on stretch ownership and clearer stakeholder updates.",
          keyPoints: "Last year met expectations with strong teamwork.",
          decisionsMade: "Confirm development objectives in the PDP after this meeting.",
          actionItems: "Prepare two development objectives with measurable checkpoints.",
          nextSteps: "Supervisor to share mentoring support and HR to remain optional on follow-ups.",
          additionalComments: "Employee is interested in a future specialist path.",
          developmentAreasAgreed: "Communication with stakeholders.",
          goalsDiscussed: "Grow into a senior individual-contributor role.",
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

  const [completed, accepted, pending, reschedule, hrDeclined] = members;

  if (completed) {
    await createMeeting({
      employee: completed,
      status: MeetingStatus.COMPLETED,
      scheduledAt: at(2026, 9, 12, 4, 30),
      endAt: at(2026, 9, 12, 5, 30),
      employeeResponse: MeetingParticipantResponse.ACCEPTED,
      hrResponse: MeetingParticipantResponse.ACCEPTED,
      notes: true,
    });
  }
  if (accepted) {
    await createMeeting({
      employee: accepted,
      status: MeetingStatus.SCHEDULED,
      scheduledAt: at(2026, 9, 18, 8, 0),
      endAt: at(2026, 9, 18, 9, 0),
      employeeResponse: MeetingParticipantResponse.ACCEPTED,
      hrResponse: MeetingParticipantResponse.ACCEPTED,
    });
  }
  if (pending) {
    await createMeeting({
      employee: pending,
      status: MeetingStatus.SCHEDULED,
      scheduledAt: at(2026, 9, 20, 7, 30),
      endAt: at(2026, 9, 20, 8, 30),
      employeeResponse: MeetingParticipantResponse.PENDING,
      hrResponse: MeetingParticipantResponse.PENDING,
    });
  }
  if (reschedule) {
    await createMeeting({
      employee: reschedule,
      status: MeetingStatus.RESCHEDULE_REQUESTED,
      scheduledAt: at(2026, 9, 22, 9, 0),
      endAt: at(2026, 9, 22, 10, 0),
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
      scheduledAt: at(2026, 9, 25, 5, 30),
      endAt: at(2026, 9, 25, 6, 30),
      employeeResponse: MeetingParticipantResponse.ACCEPTED,
      hrResponse: MeetingParticipantResponse.REJECTED,
      hrReason: "Conflicting onboarding session; supervisor and employee can proceed.",
    });
  }

  console.log(
    `Seeded performance planning meetings for ${supervisor.name} / team ${team.name} (${members.length} employees, leftover rows remain not scheduled).`
  );
}
