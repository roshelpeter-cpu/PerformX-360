import { Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AppRole } from "../constants/roles.js";
import { AppError } from "../utils/errors.js";
import {
  demoPdpForEmployee,
  enrichEmployeeProfile,
  getPortraitUrl,
} from "../utils/demo-profile.js";
import type {
  HierarchyQuery,
  ReassignEmployeeInput,
  TeamQuery,
} from "../validations/employee-management.validation.js";

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

  const demo = enrichEmployeeProfile({
    employeeId: employee.employeeId,
    name: employee.name,
    companyEmail: employee.companyEmail,
    jobTitle: employee.jobTitle,
    createdAt: employee.createdAt,
    role: employee.role,
    departmentName: employee.department?.name ?? null,
  });

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
  if (actor.role !== Role.HR && actor.role !== Role.HR_MANAGER) {
    throw new AppError("You do not have permission to reassign employees.", 403);
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
}

interface HrNode {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string;
  role: string;
  avatarUrl: string;
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
      });
    }

    const node = bySupervisor.get(supervisor.id)!;
    for (const employee of team.employees) {
      node.employees.push(mapTeamMember(employee, context));
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
    return { ...node, employees, employeeCount: unique.length };
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
      : { role: Role.HR };

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

  return {
    viewerRole: actor.role,
    groups,
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

  const supervisor = await prisma.employee.findFirst({
    where: { id: input.supervisorId, role: Role.SUPERVISOR },
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

  let team = input.teamId
    ? supervisor.supervisedTeams.find((item) => item.id === input.teamId)
    : supervisor.supervisedTeams[0];

  if (input.teamId && !team) {
    throw new AppError("The selected team does not belong to that supervisor.", 400);
  }
  if (!team) {
    throw new AppError("The selected supervisor does not lead a team.", 400);
  }

  if (team.departmentId !== employee.departmentId && employee.departmentId) {
    const matching = supervisor.supervisedTeams.find(
      (item) => item.departmentId === employee.departmentId
    );
    if (matching) team = matching;
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
