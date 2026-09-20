import type { PrismaClient } from "../generated/prisma/client.js";

const TARGET_TEAM_SIZE = 10;

export async function redistributeOrgTeams(prisma: PrismaClient) {
  await prisma.hrTeamAssignment.deleteMany();
  await prisma.employee.updateMany({ data: { teamId: null } });
  await prisma.team.deleteMany();

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const hrStaff = await prisma.employee.findMany({
    where: { role: "HR" },
    orderBy: { employeeId: "asc" },
  });
  if (hrStaff.length === 0) return { teamCount: 0 };

  let teamCounter = 0;
  const createdTeams: Array<{ id: string; supervisorId: string | null }> = [];

  for (const department of departments) {
    const supervisors = await prisma.employee.findMany({
      where: { role: "SUPERVISOR", departmentId: department.id },
      orderBy: { employeeId: "asc" },
    });
    const employees = await prisma.employee.findMany({
      where: { role: "EMPLOYEE", departmentId: department.id },
      orderBy: { employeeId: "asc" },
    });
    if (supervisors.length === 0) continue;

    const teamCount = Math.max(
      1,
      Math.min(supervisors.length, Math.ceil(employees.length / TARGET_TEAM_SIZE) || 1)
    );

    for (let index = 0; index < teamCount; index += 1) {
      teamCounter += 1;
      const supervisor = supervisors[index]!;
      const team = await prisma.team.create({
        data: {
          name: `Team ${teamCounter} – ${department.name}`,
          departmentId: department.id,
          supervisorId: supervisor.id,
        },
      });
      createdTeams.push({ id: team.id, supervisorId: supervisor.id });

      await prisma.employee.update({
        where: { id: supervisor.id },
        data: { teamId: team.id },
      });

      const sliceStart = Math.floor((employees.length * index) / teamCount);
      const sliceEnd = Math.floor((employees.length * (index + 1)) / teamCount);
      const members = employees.slice(sliceStart, sliceEnd);
      if (members.length > 0) {
        await prisma.employee.updateMany({
          where: { id: { in: members.map((member) => member.id) } },
          data: { teamId: team.id },
        });
      }
    }
  }

  for (let index = 0; index < createdTeams.length; index += 1) {
    const hr = hrStaff[index % hrStaff.length]!;
    await prisma.hrTeamAssignment.create({
      data: {
        teamId: createdTeams[index]!.id,
        hrEmployeeId: hr.id,
      },
    });
  }

  const activeCycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (activeCycle) {
    const members = await prisma.employee.findMany({
      where: { role: "EMPLOYEE", teamId: { not: null } },
      select: {
        id: true,
        team: { select: { supervisorId: true } },
      },
    });
    for (const member of members) {
      const supervisorId = member.team?.supervisorId;
      if (!supervisorId) continue;
      await prisma.employeeSupervisorAssignment.upsert({
        where: {
          cycleId_employeeId: { cycleId: activeCycle.id, employeeId: member.id },
        },
        update: { supervisorId },
        create: {
          cycleId: activeCycle.id,
          employeeId: member.id,
          supervisorId,
        },
      });
    }
  }

  return { teamCount: createdTeams.length, hrCount: hrStaff.length };
}
