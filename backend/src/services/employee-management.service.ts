import { Role, Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AppRole } from "../constants/roles.js";
import { AppError } from "../utils/errors.js";
import {
  demoPdpForEmployee,
  enrichEmployeeProfile,
  getPortraitUrl,
  mergeProfileDetails,
} from "../utils/demo-profile.js";
import type {
  CreateAccountInput,
  HierarchyQuery,
  ReassignEmployeeInput,
  TeamQuery,
} from "../validations/employee-management.validation.js";
import { generateSecurePassword, hashPassword } from "../utils/password.js";

const personSelect = {
  id: true,
  employeeId: true,
  name: true,
  jobTitle: true,
  companyEmail: true,
  role: true,
} as const;

type Actor = { id: string; role: AppRole };

function paginate<T>(items: T[], page = 1, pageSize = 10) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
  };
}

function accountStatus(lockedUntil: Date | null | undefined) {
  return lockedUntil && lockedUntil > new Date() ? "Locked" : "Active";
}

async function getActiveCycle() {
  return prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
}

async function getHrManager() {
  return prisma.employee.findFirst({
    where: { role: Role.HR_MANAGER },
    select: personSelect,
    orderBy: { employeeId: "asc" },
  });
}

export async function serializeManagedProfile(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: true,
      authLock: true,
      hrTeamAssignments: {
        include: { team: { select: { id: true, name: true } } },
        orderBy: { assignedAt: "asc" },
      },
      team: {
        include: {
          supervisor: { select: personSelect },
          hrAssignments: {
            include: { hrEmployee: { select: personSelect } },
            take: 1,
          },
        },
      },
    },
  });

  if (!employee) throw new AppError("Employee not found", 404);

  const demo = mergeProfileDetails(
    enrichEmployeeProfile({
      employeeId: employee.employeeId,
      name: employee.name,
      companyEmail: employee.companyEmail,
      jobTitle: employee.jobTitle,
      createdAt: employee.createdAt,
      role: employee.role,
      departmentName: employee.department?.name ?? null,
    }),
    employee.profileDetails
  );

  const hrResponsible = employee.team?.hrAssignments[0]?.hrEmployee ?? null;
  const hrManager =
    employee.role === Role.HR || employee.role === Role.HR_MANAGER
      ? await getHrManager()
      : null;

  const cycle = await getActiveCycle();
  const supervisorAssignment = cycle
    ? await prisma.employeeSupervisorAssignment.findUnique({
        where: {
          cycleId_employeeId: { cycleId: cycle.id, employeeId: employee.id },
        },
        include: { supervisor: { select: personSelect } },
      })
    : null;

  const supervisor =
    supervisorAssignment?.supervisor ??
    employee.team?.supervisor ??
    (employee.role === Role.HR ? hrManager : null);

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    role: employee.role,
    companyEmail: employee.companyEmail,
    createdAt: employee.createdAt,
    accountStatus: accountStatus(employee.authLock?.lockedUntil),
    department: employee.department,
    team: employee.team
      ? {
          id: employee.team.id,
          name: employee.team.name,
          supervisor: employee.team.supervisor,
        }
      : null,
    supervisor: supervisor
      ? {
          id: supervisor.id,
          employeeId: supervisor.employeeId,
          name: supervisor.name,
          jobTitle: supervisor.jobTitle,
          companyEmail: supervisor.companyEmail,
        }
      : null,
    hrResponsible: hrResponsible
      ? {
          id: hrResponsible.id,
          employeeId: hrResponsible.employeeId,
          name: hrResponsible.name,
          jobTitle: hrResponsible.jobTitle,
          companyEmail: hrResponsible.companyEmail,
        }
      : employee.role === Role.SUPERVISOR || employee.role === Role.EMPLOYEE
        ? null
        : hrManager,
    assignedTeams: employee.hrTeamAssignments.map((row) => ({
      id: row.team.id,
      name: row.team.name,
    })),
    ...demo,
    avatarUrl: demo.avatarUrl ?? getPortraitUrl(employee.employeeId),
  };
}

async function loadCycleContext(employeeIds: string[]) {
  const cycle = await getActiveCycle();
  if (!cycle || employeeIds.length === 0) {
    return {
      cycle,
      batchByEmployee: new Map<string, { id: string; name: string; batchNumber: number }>(),
      pdpByEmployee: new Map<
        string,
        { status: string; progressPercent: number; label: string; active: boolean }
      >(),
      completedReviewIds: new Set<string>(),
    };
  }

  const [batches, pdps, outcomes] = await Promise.all([
    prisma.employeeBatchAssignment.findMany({
      where: { cycleId: cycle.id, employeeId: { in: employeeIds } },
      include: { batch: { select: { id: true, name: true, batchNumber: true } } },
    }),
    prisma.personalDevelopmentPlan.findMany({
      where: { cycleId: cycle.id, employeeId: { in: employeeIds } },
      include: { goals: { select: { progress: true } } },
    }),
    prisma.appraisalOutcome.findMany({
      where: { cycleId: cycle.id, employeeId: { in: employeeIds } },
      select: { employeeId: true },
    }),
  ]);

  const batchByEmployee = new Map(
    batches.map((row) => [
      row.employeeId,
      {
        id: row.batch.id,
        name: row.batch.name,
        batchNumber: row.batch.batchNumber,
      },
    ])
  );

  const pdpByEmployee = new Map<
    string,
    { status: string; progressPercent: number; label: string; active: boolean }
  >();
  for (const pdp of pdps) {
    const progress =
      pdp.goals.length > 0
        ? Math.round(
            pdp.goals.reduce((sum, goal) => sum + goal.progress, 0) / pdp.goals.length
          )
        : 0;
    const active = pdp.status !== "COMPLETED" && pdp.status !== "DRAFT";
    pdpByEmployee.set(pdp.employeeId, {
      status: pdp.status,
      progressPercent: progress,
      label: pdp.status === "APPROVED" ? "APPROVED" : pdp.status === "DRAFT" ? "DRAFT" : `${progress}%`,
      active: active || pdp.status === "APPROVED",
    });
  }

  return {
    cycle,
    batchByEmployee,
    pdpByEmployee,
    completedReviewIds: new Set(outcomes.map((row) => row.employeeId)),
  };
}

function memberPdp(
  employeeId: string,
  pdpByEmployee: Map<
    string,
    { status: string; progressPercent: number; label: string; active: boolean }
  >
) {
  return pdpByEmployee.get(employeeId) ?? demoPdpForEmployee(employeeId);
}

async function supervisedEmployeeIds(supervisorId: string) {
  const teams = await prisma.team.findMany({
    where: { supervisorId },
    select: { id: true },
  });
  const members = await prisma.employee.findMany({
    where: {
      role: Role.EMPLOYEE,
      teamId: { in: teams.map((team) => team.id) },
    },
    select: { id: true },
  });
  return new Set(members.map((member) => member.id));
}

async function hrScopeEmployeeIds(hrEmployeeId: string) {
  const assignments = await prisma.hrTeamAssignment.findMany({
    where: { hrEmployeeId },
    include: {
      team: {
        include: {
          supervisor: { select: { id: true } },
          employees: { select: { id: true, role: true } },
        },
      },
    },
  });

  const ids = new Set<string>([hrEmployeeId]);
  for (const assignment of assignments) {
    if (assignment.team.supervisor?.id) ids.add(assignment.team.supervisor.id);
    for (const employee of assignment.team.employees) ids.add(employee.id);
  }
  return ids;
}

export async function assertCanViewEmployee(actor: Actor, targetId: string) {
  if (actor.id === targetId) return;

  if (actor.role === Role.EMPLOYEE) {
    throw new AppError("You do not have permission to view this profile.", 403);
  }

  if (actor.role === Role.SUPERVISOR) {
    const allowed = await supervisedEmployeeIds(actor.id);
    if (!allowed.has(targetId)) {
      throw new AppError("You can only view employees on your team.", 403);
    }
    return;
  }

  if (actor.role === Role.HR) {
    const allowed = await hrScopeEmployeeIds(actor.id);
    if (!allowed.has(targetId)) {
      throw new AppError("This person is outside your HR responsibility.", 403);
    }
    return;
  }

  if (actor.role === Role.HR_MANAGER) {
    const target = await prisma.employee.findUnique({
      where: { id: targetId },
      select: { role: true },
    });
    if (!target || target.role === Role.LEADERSHIP) {
      throw new AppError("Employee not found", 404);
    }
    return;
  }

  throw new AppError("You do not have permission to view this profile.", 403);
}

async function assertCanManageEmployee(actor: Actor, targetId: string) {
  if (actor.role !== Role.HR) {
    throw new AppError("Only HR can reassign employees to teams and supervisors.", 403);
  }
  await assertCanViewEmployee(actor, targetId);
}

function mapTeamMember(
  employee: {
    id: string;
    employeeId: string;
    name: string;
    jobTitle: string | null;
    companyEmail: string;
    createdAt: Date;
    role: Role;
    department: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
    authLock: { lockedUntil: Date } | null;
  },
  context: Awaited<ReturnType<typeof loadCycleContext>>
) {
  const demo = enrichEmployeeProfile({
    employeeId: employee.employeeId,
    name: employee.name,
    companyEmail: employee.companyEmail,
    jobTitle: employee.jobTitle,
    createdAt: employee.createdAt,
    role: employee.role,
    departmentName: employee.department?.name ?? null,
  });
  const pdp = memberPdp(employee.id, context.pdpByEmployee);
  const status = accountStatus(employee.authLock?.lockedUntil);
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    jobTitle: demo.jobTitle,
    companyEmail: employee.companyEmail,
    role: employee.role,
    avatarUrl: demo.avatarUrl,
    department: employee.department,
    team: employee.team,
    batch: context.batchByEmployee.get(employee.id) ?? null,
    pdp,
    status,
    reviewCompleted: context.completedReviewIds.has(employee.id),
  };
}

export async function getSupervisorTeam(actor: Actor, query: TeamQuery) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only supervisors can access My Team.", 403);
  }

  const teams = await prisma.team.findMany({
    where: { supervisorId: actor.id },
    select: { id: true, name: true },
  });

  const employees = await prisma.employee.findMany({
    where: {
      role: Role.EMPLOYEE,
      teamId: { in: teams.map((team) => team.id) },
    },
    include: {
      department: true,
      authLock: true,
      team: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const context = await loadCycleContext(employees.map((employee) => employee.id));
  let rows = employees.map((employee) => mapTeamMember(employee, context));

  const search = query.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(search) ||
        row.employeeId.toLowerCase().includes(search) ||
        row.jobTitle.toLowerCase().includes(search)
    );
  }
  if (query.batchId) {
    rows = rows.filter((row) => row.batch?.id === query.batchId);
  }
  if (query.departmentId) {
    rows = rows.filter((row) => row.department?.id === query.departmentId);
  }
  if (query.status) {
    rows = rows.filter((row) => row.status.toLowerCase() === query.status!.toLowerCase());
  }

  const activePdps = rows.filter((row) => row.pdp.active || row.pdp.status === "APPROVED").length;
  const avgProgress =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((sum, row) => sum + row.pdp.progressPercent, 0) / rows.length);
  const completedReviews = rows.filter((row) => row.reviewCompleted).length;

  const page = paginate(rows, query.page ?? 1, query.pageSize ?? 10);

  const batches = [
    ...new Map(
      employees
        .map((employee) => context.batchByEmployee.get(employee.id))
        .filter((batch): batch is { id: string; name: string; batchNumber: number } => Boolean(batch))
        .map((batch) => [batch.id, batch])
    ).values(),
  ];
  const departments = [
    ...new Map(
      employees
        .flatMap((employee) =>
          employee.department
            ? [[employee.department.id, { id: employee.department.id, name: employee.department.name }] as const]
            : []
        )
    ).values(),
  ];

  return {
    cycle: context.cycle,
    summary: {
      teamSize: employees.length,
      filteredCount: rows.length,
      activePdps,
      avgPdpProgress: avgProgress,
      completedReviews,
    },
    filters: {
      batches,
      departments,
      statuses: ["Active", "Locked"],
    },
    ...page,
    employees: page.items,
  };
}

type HierarchyEmployee = ReturnType<typeof mapTeamMember>;

interface SupervisorTeamGroup {
  id: string;
  name: string;
  department: { id: string; name: string } | null;
  employees: HierarchyEmployee[];
}

interface SupervisorNode {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string;
  role: string;
  avatarUrl: string;
  department: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  employeeCount: number;
  employees: HierarchyEmployee[];
  teams: SupervisorTeamGroup[];
}

interface HrNode {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string;
  role: string;
  avatarUrl: string;
  status: string;
  joinedAt: Date;
  teamName: string | null;
  department: { id: string; name: string } | null;
  supervisorCount: number;
  employeeCount: number;
  supervisors: SupervisorNode[];
}

async function buildHrNode(
  hr: {
    id: string;
    employeeId: string;
    name: string;
    jobTitle: string | null;
    companyEmail: string;
    createdAt: Date;
    role: Role;
    department: { id: string; name: string } | null;
  },
  query: HierarchyQuery
): Promise<HrNode> {
  const assignments = await prisma.hrTeamAssignment.findMany({
    where: { hrEmployeeId: hr.id },
    include: {
      team: {
        include: {
          department: true,
          supervisor: {
            include: {
              department: true,
              authLock: true,
              team: { select: { id: true, name: true } },
            },
          },
          employees: {
            where: { role: Role.EMPLOYEE },
            include: {
              department: true,
              authLock: true,
              team: { select: { id: true, name: true } },
            },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });

  const allEmployeeIds = assignments.flatMap((row) => row.team.employees.map((item) => item.id));
  const context = await loadCycleContext(allEmployeeIds);

  const bySupervisor = new Map<string, SupervisorNode>();

  for (const assignment of assignments) {
    const team = assignment.team;
    if (query.teamId && team.id !== query.teamId) continue;
    if (query.departmentId && team.departmentId !== query.departmentId) continue;

    const supervisor = team.supervisor;
    if (!supervisor) continue;

    const supervisorDemo = enrichEmployeeProfile({
      employeeId: supervisor.employeeId,
      name: supervisor.name,
      companyEmail: supervisor.companyEmail,
      jobTitle: supervisor.jobTitle,
      createdAt: supervisor.createdAt,
      role: supervisor.role,
      departmentName: supervisor.department?.name ?? team.department?.name ?? null,
    });

    if (!bySupervisor.has(supervisor.id)) {
      bySupervisor.set(supervisor.id, {
        id: supervisor.id,
        employeeId: supervisor.employeeId,
        name: supervisor.name,
        jobTitle: supervisorDemo.jobTitle,
        role: supervisor.role,
        avatarUrl: supervisorDemo.avatarUrl,
        department: supervisor.department ?? team.department,
        team: { id: team.id, name: team.name },
        employeeCount: 0,
        employees: [],
        teams: [],
      });
    }

    const node = bySupervisor.get(supervisor.id)!;
    let teamGroup = node.teams.find((item) => item.id === team.id);
    if (!teamGroup) {
      teamGroup = {
        id: team.id,
        name: team.name,
        department: team.department,
        employees: [],
      };
      node.teams.push(teamGroup);
    }
    for (const employee of team.employees) {
      node.employees.push(mapTeamMember(employee, context));
      teamGroup.employees.push(mapTeamMember(employee, context));
    }
  }

  const search = query.search?.trim().toLowerCase();
  const status = query.status?.trim().toLowerCase();
  const hrMatches = Boolean(
    search &&
      (hr.name.toLowerCase().includes(search) ||
        hr.employeeId.toLowerCase().includes(search))
  );

  let supervisors = Array.from(bySupervisor.values()).map((node) => {
    const unique = [
      ...new Map(node.employees.map((employee) => [employee.id, employee])).values(),
    ];
    let employees = unique;
    if (search && !hrMatches) {
      employees = employees.filter(
        (employee) =>
          employee.name.toLowerCase().includes(search) ||
          employee.employeeId.toLowerCase().includes(search)
      );
    }
    if (status) {
      employees = employees.filter((employee) => employee.status.toLowerCase() === status);
    }
    const teams = node.teams.map((team) => {
      const teamEmployees = team.employees.filter((employee) =>
        employees.some((item) => item.id === employee.id)
      );
      return { ...team, employees: teamEmployees };
    }).filter((team) => team.employees.length > 0 || Boolean(search && hrMatches));
    return { ...node, employees, teams, employeeCount: unique.length };
  });

  if (search && !hrMatches) {
    supervisors = supervisors.filter((node) => {
      const selfMatch =
        node.name.toLowerCase().includes(search) ||
        node.employeeId.toLowerCase().includes(search);
      return selfMatch || node.employees.length > 0;
    });
    supervisors = supervisors.map((node) => {
      const selfMatch =
        node.name.toLowerCase().includes(search) ||
        node.employeeId.toLowerCase().includes(search);
      if (selfMatch) {
        const original = bySupervisor.get(node.id);
        return original
          ? { ...node, employees: original.employees, employeeCount: original.employees.length }
          : node;
      }
      return node;
    });
  }

  supervisors.sort((a, b) => a.name.localeCompare(b.name));

  const hrDemo = enrichEmployeeProfile({
    employeeId: hr.employeeId,
    name: hr.name,
    companyEmail: hr.companyEmail,
    jobTitle: hr.jobTitle,
    createdAt: hr.createdAt,
    role: hr.role,
    departmentName: hr.department?.name ?? null,
  });

  const employeeCount = supervisors.reduce((sum, node) => sum + node.employeeCount, 0);

  return {
    id: hr.id,
    employeeId: hr.employeeId,
    name: hr.name,
    jobTitle: hrDemo.jobTitle,
    role: hr.role,
    avatarUrl: hrDemo.avatarUrl,
    status: "Active",
    joinedAt: hr.createdAt,
    teamName: assignments[0]?.team.name ?? (hr.role === Role.HR_MANAGER || hr.role === Role.HR ? "HR Team" : null),
    department: hr.department,
    supervisorCount: supervisors.length,
    employeeCount,
    supervisors,
  };
}

export async function getOrgHierarchy(actor: Actor, query: HierarchyQuery) {
  if (actor.role !== Role.HR && actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only HR staff can view the organisation hierarchy.", 403);
  }

  const hrWhere =
    actor.role === Role.HR
      ? { id: actor.id, role: Role.HR }
      : { role: { in: [Role.HR, Role.HR_MANAGER] } };

  const hrStaff = await prisma.employee.findMany({
    where: hrWhere,
    include: { department: true },
    orderBy: { employeeId: "asc" },
  });

  const search = query.search?.trim().toLowerCase();
  let groups = [];
  for (const hr of hrStaff) {
    const node = await buildHrNode(hr, query);
    groups.push(node);
  }

  if (search) {
    groups = groups.filter((group) => {
      const selfMatch =
        group.name.toLowerCase().includes(search) ||
        group.employeeId.toLowerCase().includes(search);
      return selfMatch || group.supervisors.length > 0;
    });
  }

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const teamWhere =
    actor.role === Role.HR ? { hrAssignments: { some: { hrEmployeeId: actor.id } } } : {};
  const teams = await prisma.team.findMany({
    where: teamWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const scopedEmployeeIds = new Set(
    groups.flatMap((group) =>
      group.supervisors.flatMap((supervisor) =>
        supervisor.teams.flatMap((team) => team.employees.map((employee) => employee.id))
      )
    )
  );
  const supervisorCount = groups.reduce((sum, group) => sum + group.supervisorCount, 0);
  const scopedEmployees = groups.reduce((sum, group) => sum + group.employeeCount, 0);

  const [employeeTotal, assignedEmployees, pendingRequests, inProgressPdps, activeCycles] =
    await Promise.all([
      prisma.employee.count({ where: { role: Role.EMPLOYEE } }),
      prisma.employee.count({ where: { role: Role.EMPLOYEE, teamId: { not: null } } }),
      prisma.profileChangeRequest.count({
        where: {
          status: "PENDING",
          ...(actor.role === Role.HR ? { recipientId: actor.id } : {}),
        },
      }),
      prisma.personalDevelopmentPlan.count({
        where: {
          status: {
            in: ["SUBMITTED", "PENDING_HR_REVIEW", "PENDING_EMPLOYEE_REVIEW", "CHANGES_REQUESTED"],
          },
        },
      }),
      prisma.appraisalCycle.count({ where: { status: "ACTIVE" } }),
    ]);
  const coverageBase = actor.role === Role.HR ? scopedEmployees : employeeTotal;
  const coverageAssigned =
    actor.role === Role.HR ? scopedEmployeeIds.size : assignedEmployees;
  const coverage =
    coverageBase === 0 ? 100 : Math.round((coverageAssigned / coverageBase) * 100);

  return {
    viewerRole: actor.role,
    groups,
    summary: {
      hrMembers: groups.length,
      supervisorCount,
      teamCount: teams.length,
      totalEmployees: actor.role === Role.HR ? scopedEmployees : employeeTotal,
      ongoingProcesses: pendingRequests + inProgressPdps + activeCycles,
      employeeCoveragePercent: coverage,
    },
    filters: {
      departments,
      teams,
      statuses: ["Active", "Locked"],
    },
  };
}

export async function getManagedEmployeeProfile(actor: Actor, targetId: string) {
  await assertCanViewEmployee(actor, targetId);
  return serializeManagedProfile(targetId);
}

export async function listEligibleSupervisors(actor: Actor, employeeId: string) {
  await assertCanManageEmployee(actor, employeeId);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { departmentId: true, role: true },
  });
  if (!employee || employee.role !== Role.EMPLOYEE) {
    throw new AppError("Only employees can be reassigned to a supervisor.", 400);
  }

  let supervisorIds: string[] | undefined;
  if (actor.role === Role.HR) {
    const assignments = await prisma.hrTeamAssignment.findMany({
      where: { hrEmployeeId: actor.id },
      include: { team: { select: { supervisorId: true } } },
    });
    supervisorIds = assignments
      .map((row) => row.team.supervisorId)
      .filter((id): id is string => Boolean(id));
  }

  const supervisors = await prisma.employee.findMany({
    where: {
      role: Role.SUPERVISOR,
      ...(employee.departmentId ? { departmentId: employee.departmentId } : {}),
      ...(supervisorIds ? { id: { in: supervisorIds } } : {}),
    },
    include: {
      department: true,
      supervisedTeams: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return supervisors.map((supervisor) => ({
    id: supervisor.id,
    employeeId: supervisor.employeeId,
    name: supervisor.name,
    jobTitle: supervisor.jobTitle,
    department: supervisor.department,
    teams: supervisor.supervisedTeams,
  }));
}

export async function reassignEmployee(
  actor: Actor,
  employeeId: string,
  input: ReassignEmployeeInput
) {
  await assertCanManageEmployee(actor, employeeId);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { department: true, team: true },
  });
  if (!employee) throw new AppError("Employee not found", 404);
  if (employee.role !== Role.EMPLOYEE) {
    throw new AppError("Only employees can be moved between supervisors.", 400);
  }

  let team = input.teamId
    ? await prisma.team.findUnique({ where: { id: input.teamId } })
    : null;

  if (input.teamId && !team) {
    throw new AppError("Team not found.", 404);
  }

  if (team) {
    if (actor.role === Role.HR) {
      const allowed = await hrScopeEmployeeIds(actor.id);
      if (team.supervisorId && !allowed.has(team.supervisorId) && !allowed.has(employee.id)) {
        throw new AppError("That team is outside your HR responsibility.", 403);
      }
      const assignment = await prisma.hrTeamAssignment.findUnique({ where: { teamId: team.id } });
      if (assignment && assignment.hrEmployeeId !== actor.id) {
        throw new AppError("That team is outside your HR responsibility.", 403);
      }
    }
    if (
      employee.departmentId &&
      team.departmentId &&
      employee.departmentId !== team.departmentId
    ) {
      throw new AppError("Keep department consistent: choose a team in the same department.", 400);
    }
  }

  const supervisor = await prisma.employee.findFirst({
    where: {
      id: team?.supervisorId || input.supervisorId,
      role: Role.SUPERVISOR,
    },
    include: {
      department: true,
      supervisedTeams: true,
    },
  });
  if (!supervisor) {
    throw new AppError("New supervisor not found or is not a supervisor.", 400);
  }

  if (actor.role === Role.HR) {
    const allowed = await hrScopeEmployeeIds(actor.id);
    if (!allowed.has(supervisor.id)) {
      throw new AppError("That supervisor is outside your HR responsibility.", 403);
    }
  }

  if (
    employee.departmentId &&
    supervisor.departmentId &&
    employee.departmentId !== supervisor.departmentId
  ) {
    throw new AppError(
      "Keep department consistent: choose a supervisor in the same department.",
      400
    );
  }

  if (!team) {
    team = supervisor.supervisedTeams[0] ?? null;
  }
  if (!team) {
    throw new AppError("The selected supervisor does not lead a team.", 400);
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      teamId: team.id,
      departmentId: employee.departmentId ?? team.departmentId,
    },
  });

  const cycle = await getActiveCycle();
  if (cycle) {
    const existing = await prisma.employeeSupervisorAssignment.findUnique({
      where: {
        cycleId_employeeId: { cycleId: cycle.id, employeeId: employee.id },
      },
    });
    if (existing) {
      if (existing.supervisorId !== supervisor.id) {
        await prisma.$transaction([
          prisma.supervisorAssignmentHistory.create({
            data: {
              cycleId: cycle.id,
              employeeId: employee.id,
              previousSupervisorId: existing.supervisorId,
              newSupervisorId: supervisor.id,
              reason: input.reason,
              changedById: actor.id,
              effectiveDate: new Date(),
            },
          }),
          prisma.employeeSupervisorAssignment.update({
            where: { id: existing.id },
            data: { supervisorId: supervisor.id },
          }),
        ]);
      }
    } else {
      await prisma.employeeSupervisorAssignment.create({
        data: {
          cycleId: cycle.id,
          employeeId: employee.id,
          supervisorId: supervisor.id,
        },
      });
    }
  }

  return serializeManagedProfile(employee.id);
}

export async function listEligibleTeams(actor: Actor, departmentId?: string) {
  if (actor.role !== Role.HR && actor.role !== Role.HR_MANAGER) {
    throw new AppError("You do not have permission to manage assignments.", 403);
  }
  const teams = await prisma.team.findMany({
    where: {
      ...(departmentId ? { departmentId } : {}),
      ...(actor.role === Role.HR
        ? { hrAssignments: { some: { hrEmployeeId: actor.id } } }
        : {}),
    },
    include: {
      department: { select: { id: true, name: true } },
      supervisor: { select: personSelect },
    },
    orderBy: { name: "asc" },
  });
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    department: team.department,
    supervisor: team.supervisor,
  }));
}

export async function listEligibleHrStaff() {
  return prisma.employee.findMany({
    where: { role: Role.HR },
    select: personSelect,
    orderBy: { employeeId: "asc" },
  });
}

export async function reassignTeamHr(
  actor: Actor,
  teamId: string,
  newHrEmployeeId: string,
  reason: string
) {
  if (actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only an HR Manager can reassign a team to another HR.", 403);
  }
  const trimmed = reason.trim();
  if (!trimmed) throw new AppError("Reason is required.", 400);

  const [team, hr] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      include: { hrAssignments: true },
    }),
    prisma.employee.findFirst({
      where: { id: newHrEmployeeId, role: Role.HR },
      select: personSelect,
    }),
  ]);
  if (!team) throw new AppError("Team not found", 404);
  if (!hr) throw new AppError("HR staff member not found", 404);

  const previousHrId = team.hrAssignments[0]?.hrEmployeeId ?? null;
  if (previousHrId === newHrEmployeeId) {
    throw new AppError("Selected HR already manages this team.", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.hrTeamAssignment.deleteMany({ where: { teamId } });
    await tx.hrTeamAssignment.create({
      data: { teamId, hrEmployeeId: newHrEmployeeId },
    });
    const cycle = await tx.appraisalCycle.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    if (cycle) {
      await tx.hrTeamReassignmentHistory.create({
        data: {
          cycleId: cycle.id,
          teamId,
          previousHrId,
          newHrId: newHrEmployeeId,
          reason: trimmed,
          evidence: "org-reassignment",
          evidenceName: "employee-management.txt",
          changedById: actor.id,
        },
      });
    }
  });

  return {
    teamId: team.id,
    teamName: team.name,
    hr,
  };
}

export async function reassignSupervisorHr(
  actor: Actor,
  supervisorId: string,
  newHrEmployeeId: string,
  reason: string
) {
  if (actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only an HR Manager can reassign a supervisor to another HR.", 403);
  }
  const supervisor = await prisma.employee.findFirst({
    where: { id: supervisorId, role: Role.SUPERVISOR },
    select: personSelect,
  });
  if (!supervisor) throw new AppError("Supervisor not found", 404);

  const teams = await prisma.team.findMany({
    where: { supervisorId },
    select: { id: true, name: true },
  });
  if (teams.length === 0) {
    throw new AppError("This supervisor has no teams to reassign.", 400);
  }

  const results = [];
  for (const team of teams) {
    results.push(await reassignTeamHr(actor, team.id, newHrEmployeeId, reason));
  }
  return { supervisor, teams: results };
}

export async function nextEmployeeId(role: Role) {
  const prefix =
    role === Role.HR_MANAGER
      ? "HRM"
      : role === Role.HR
        ? "HR"
        : role === Role.SUPERVISOR
          ? "SUP"
          : role === Role.LEADERSHIP
            ? "LED"
            : "EMP";
  const existing = await prisma.employee.findMany({
    where: { employeeId: { startsWith: prefix } },
    select: { employeeId: true },
  });
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const row of existing) {
    const match = row.employeeId.match(pattern);
    if (!match) continue;
    const numeric = Number(match[1]);
    if (!Number.isNaN(numeric) && numeric > max) max = numeric;
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

export async function createAccount(actor: Actor, input: CreateAccountInput) {
  if (actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only an HR Manager can create accounts.", 403);
  }

  const role = input.role as Role;
  let departmentId = input.departmentId || null;
  let teamId = input.teamId || null;
  const teamIds = [...new Set(input.teamIds ?? [])];
  let supervisorId: string | null = null;

  if (role === Role.LEADERSHIP) {
    departmentId = null;
    teamId = null;
  } else if (role === Role.EMPLOYEE) {
    if (!teamId) throw new AppError("Select a team so the supervisor can be assigned automatically.", 400);
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { department: true, hrAssignments: true },
    });
    if (!team) throw new AppError("Team not found", 404);
    if (departmentId && team.departmentId !== departmentId) {
      throw new AppError("That team does not belong to the selected department.", 400);
    }
    if (!team.supervisorId) {
      throw new AppError("The selected team does not have a supervisor. Choose another team.", 400);
    }
    departmentId = team.departmentId;
    supervisorId = team.supervisorId;
  } else if (role === Role.SUPERVISOR) {
    if (!departmentId) throw new AppError("Department is required for a supervisor account.", 400);
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) throw new AppError("Team not found", 404);
      if (team.departmentId !== departmentId) {
        throw new AppError("That team does not belong to the selected department.", 400);
      }
    }
  } else if (role === Role.HR) {
    if (!departmentId) throw new AppError("Department is required for an HR account.", 400);
    if (teamIds.length > 0) {
      const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, departmentId: true, name: true },
      });
      if (teams.length !== teamIds.length) {
        throw new AppError("One or more selected teams were not found.", 400);
      }
      if (teams.some((team) => team.departmentId !== departmentId)) {
        throw new AppError("Selected teams must belong to the chosen department.", 400);
      }
    }
  }

  const employeeId = await nextEmployeeId(role);
  const existing = await prisma.employee.findFirst({
    where: { companyEmail: input.companyEmail.trim().toLowerCase() },
    select: { companyEmail: true },
  });
  if (existing) {
    throw new AppError("An account with that email already exists.", 409);
  }

  const temporaryPassword = generateSecurePassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const jobTitle =
    input.jobTitle?.trim() ||
    (role === Role.HR_MANAGER
      ? "HR Manager"
      : role === Role.HR
        ? "HR Officer"
        : role === Role.SUPERVISOR
          ? "Supervisor"
          : role === Role.LEADERSHIP
            ? "Leadership"
            : "Associate");

  const profileDetails = Object.fromEntries(
    Object.entries({
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      nationality: input.nationality || "Sri Lankan",
      contactNumber: input.contactNumber,
      employmentType: input.employmentType || "Permanent",
      workLocation: input.workLocation || "Colombo, Sri Lanka",
      dateJoined: input.dateJoined,
      emergencyContactName: input.emergencyContactName,
      emergencyContactRelationship: input.emergencyContactRelationship,
      emergencyContactNumber: input.emergencyContactNumber,
    }).filter(([, value]) => Boolean(value))
  );

  const created = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        employeeId,
        name: input.name.trim(),
        companyEmail: input.companyEmail.trim().toLowerCase(),
        role,
        jobTitle,
        passwordHash,
        mustChangePassword: true,
        profileDetails: profileDetails as Prisma.InputJsonValue,
        ...(departmentId ? { departmentId } : {}),
        ...(teamId && role === Role.EMPLOYEE ? { teamId } : {}),
      },
    });

    if (role === Role.SUPERVISOR && teamId) {
      await tx.team.update({
        where: { id: teamId },
        data: { supervisorId: employee.id },
      });
      await tx.employee.update({
        where: { id: employee.id },
        data: { teamId },
      });
    }

    if (role === Role.EMPLOYEE && supervisorId) {
      const cycle = await tx.appraisalCycle.findFirst({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      if (cycle) {
        await tx.employeeSupervisorAssignment.create({
          data: {
            cycleId: cycle.id,
            employeeId: employee.id,
            supervisorId,
          },
        });
      }
    }

    if (role === Role.HR && teamIds.length > 0) {
      for (const assignedTeamId of teamIds) {
        await tx.hrTeamAssignment.deleteMany({ where: { teamId: assignedTeamId } });
        await tx.hrTeamAssignment.create({
          data: { teamId: assignedTeamId, hrEmployeeId: employee.id },
        });
      }
    }

    return employee;
  });

  return {
    profile: await serializeManagedProfile(created.id),
    temporaryPassword,
  };
}
