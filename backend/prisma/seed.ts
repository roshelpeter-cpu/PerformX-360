/**
 * DEVELOPMENT-ONLY seed for authentication and organization-wide
 * Appraisal Cycle Management. Do NOT use these credentials in production.
 *
 * Run with: npm run db:seed
 *
 * Dataset targets:
 * - 15 realistic IT-company departments with supervisor-led teams
 * - ~863 assignable people (employees + supervisors)
 * - 4 HR staff with team responsibility assignments
 * - Annual Appraisal 2023/2024/2025 COMPLETED
 * - Annual Appraisal 2026 ACTIVE
 * - Annual Appraisal 2027 UPCOMING
 * - Annual Appraisal 2028 DRAFT
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../generated/prisma/client.js";
import bcrypt from "bcrypt";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEV_PASSWORD = "DevTest@2026";
const CHUNK_SIZE = 100;

const DEPARTMENT_PLAN: Array<{
  name: string;
  supervisors: number;
  employees: number;
}> = [
  { name: "Engineering", supervisors: 28, employees: 120 },
  { name: "Information Technology", supervisors: 22, employees: 90 },
  { name: "Product Management", supervisors: 10, employees: 40 },
  { name: "Quality Assurance", supervisors: 14, employees: 55 },
  { name: "DevOps / Cloud", supervisors: 12, employees: 45 },
  { name: "Cybersecurity", supervisors: 8, employees: 28 },
  { name: "Data & Analytics", supervisors: 12, employees: 48 },
  { name: "UI/UX Design", supervisors: 8, employees: 30 },
  { name: "Human Resources", supervisors: 6, employees: 22 },
  { name: "Finance", supervisors: 10, employees: 40 },
  { name: "Sales", supervisors: 12, employees: 50 },
  { name: "Marketing", supervisors: 8, employees: 35 },
  { name: "Customer Success", supervisors: 8, employees: 32 },
  { name: "Operations", supervisors: 8, employees: 38 },
  { name: "Administration", supervisors: 4, employees: 20 },
];

const FIRST_NAMES = [
  "Nimal", "Kavindu", "Sarah", "Anita", "Mohamed", "Ayesha", "Rizwan",
  "Tharushi", "Dinesh", "Ishara", "Priyan", "Malsha", "Hasan", "Nadeesha",
  "Chamath", "Fathima", "Ruwan", "Sanduni", "Lakshan", "Dilini", "Yasith",
  "Harini", "Sanjaya", "Meera", "Kasun", "Amaya", "Nuwan", "Shenali",
  "Ishan", "Rashmi", "Gihan", "Thilini", "Arjun", "Nethmi", "Sahan",
];

const LAST_NAMES = [
  "Fernando", "Perera", "Rahman", "De Silva", "Jayawardena", "Gunasekara",
  "Bandara", "Wickramasinghe", "Hassan", "Rajapaksha", "Silva", "Dissanayake",
  "Karunaratne", "Mendis", "Abeysekera", "Pathirana", "Weerasinghe", "Cooray",
  "Samarasinghe", "Herath",
];

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(value: number, size = 6) {
  return String(value).padStart(size, "0");
}

function addOneYear(date: Date) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + 1);
  return result;
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
  const random = mulberry32(360);

  const departmentRecords = [];
  for (const department of DEPARTMENT_PLAN) {
    const record = await prisma.department.upsert({
      where: { name: department.name },
      update: {},
      create: { name: department.name },
    });
    departmentRecords.push({ ...department, id: record.id });
  }

  const hrDept = departmentRecords.find((item) => item.name === "Human Resources")!;
  const engineering = departmentRecords.find((item) => item.name === "Engineering")!;

  const reservedEmployeeIds = new Set([
    "EMP000001",
    "SUP000001",
    "HR000001",
    "HR000002",
    "HR000003",
    "HR000004",
    "HRM000001",
    "LED000001",
    "EMP000901",
    "EMP000902",
    "EMP000903",
    "EMP000904",
  ]);

  const namedAccounts = [
    {
      employeeId: "EMP000001",
      name: "Alex Perera",
      role: "EMPLOYEE" as const,
      jobTitle: "Software Engineer",
      companyEmail: "alex.perera@altrium.local",
      departmentId: engineering.id,
    },
    {
      employeeId: "SUP000001",
      name: "Sarah Fernando",
      role: "SUPERVISOR" as const,
      jobTitle: "Engineering Supervisor",
      companyEmail: "sarah.fernando@altrium.local",
      departmentId: engineering.id,
    },
    {
      employeeId: "HR000001",
      name: "Nur Aisyah",
      role: "HR" as const,
      jobTitle: "HR Administrator",
      companyEmail: "nur.aisyah@altrium.local",
      departmentId: hrDept.id,
    },
    {
      employeeId: "HR000002",
      name: "Daniel Tan",
      role: "HR" as const,
      jobTitle: "HR Officer",
      companyEmail: "daniel.tan@altrium.local",
      departmentId: hrDept.id,
    },
    {
      employeeId: "HR000003",
      name: "Lim Wei",
      role: "HR" as const,
      jobTitle: "HR Officer",
      companyEmail: "lim.wei@altrium.local",
      departmentId: hrDept.id,
    },
    {
      employeeId: "HR000004",
      name: "Farah Nabila",
      role: "HR" as const,
      jobTitle: "HR Officer",
      companyEmail: "farah.nabila@altrium.local",
      departmentId: hrDept.id,
    },
    {
      employeeId: "HRM000001",
      name: "Maya Wickramasinghe",
      role: "HR_MANAGER" as const,
      jobTitle: "HR Manager",
      companyEmail: "maya.wickramasinghe@altrium.local",
      departmentId: hrDept.id,
    },
    {
      employeeId: "LED000001",
      name: "Daniel Perera",
      role: "LEADERSHIP" as const,
      jobTitle: "Head of Engineering",
      companyEmail: "daniel.perera@altrium.local",
      departmentId: engineering.id,
    },
    {
      employeeId: "EMP000901",
      name: "Nethmi Silva",
      role: "EMPLOYEE" as const,
      jobTitle: "QA Engineer",
      companyEmail: "nethmi.silva@altrium.local",
      departmentId: departmentRecords.find((item) => item.name === "Quality Assurance")!.id,
    },
    {
      employeeId: "EMP000902",
      name: "Kevin Fernando",
      role: "EMPLOYEE" as const,
      jobTitle: "IT Support Specialist",
      companyEmail: "kevin.fernando@altrium.local",
      departmentId: departmentRecords.find((item) => item.name === "Information Technology")!.id,
    },
    {
      employeeId: "EMP000903",
      name: "Amaya Peris",
      role: "EMPLOYEE" as const,
      jobTitle: "Product Analyst",
      companyEmail: "amaya.peris@altrium.local",
      departmentId: departmentRecords.find((item) => item.name === "Product Management")!.id,
    },
    {
      employeeId: "EMP000904",
      name: "Ryan De Silva",
      role: "EMPLOYEE" as const,
      jobTitle: "Cloud Engineer",
      companyEmail: "ryan.desilva@altrium.local",
      departmentId: departmentRecords.find((item) => item.name === "DevOps / Cloud")!.id,
    },
  ];

  for (const employee of namedAccounts) {
    await prisma.employee.upsert({
      where: { employeeId: employee.employeeId },
      update: {
        passwordHash,
        name: employee.name,
        role: employee.role,
        jobTitle: employee.jobTitle,
        companyEmail: employee.companyEmail,
        departmentId: employee.departmentId,
      },
      create: { ...employee, passwordHash },
    });
  }

  const people: Array<{
    employeeId: string;
    name: string;
    role: Role;
    companyEmail: string;
    departmentId: string;
  }> = [];

  let supervisorSeq = 1;
  let employeeSeq = 1;

  for (const department of departmentRecords) {
    for (let index = 0; index < department.supervisors; index += 1) {
      const employeeId = `SUP${pad(supervisorSeq)}`;
      supervisorSeq += 1;
      if (reservedEmployeeIds.has(employeeId)) continue;
      const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]!;
      const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]!;
      people.push({
        employeeId,
        name: `${first} ${last}`,
        role: "SUPERVISOR",
        companyEmail: `${employeeId.toLowerCase()}@altrium.local`,
        departmentId: department.id,
      });
    }

    for (let index = 0; index < department.employees; index += 1) {
      const employeeId = `EMP${pad(employeeSeq)}`;
      employeeSeq += 1;
      if (reservedEmployeeIds.has(employeeId)) continue;
      const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]!;
      const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]!;
      people.push({
        employeeId,
        name: `${first} ${last}`,
        role: "EMPLOYEE",
        companyEmail: `${employeeId.toLowerCase()}@altrium.local`,
        departmentId: department.id,
      });
    }
  }

  const chunkSize = CHUNK_SIZE;
  for (let index = 0; index < people.length; index += chunkSize) {
    const chunk = people.slice(index, index + chunkSize).map((person) => ({
      ...person,
      passwordHash,
    }));
    await prisma.employee.createMany({ data: chunk, skipDuplicates: true });
  }

  const hrManager = await prisma.employee.findUniqueOrThrow({
    where: { employeeId: "HRM000001" },
  });

  await seedTeamsAndHrAssignments(random);
  await seedAppraisalCycles(hrManager.id, random);

  const employeeCount = await prisma.employee.count({ where: { role: "EMPLOYEE" } });
  const supervisorCount = await prisma.employee.count({
    where: { role: "SUPERVISOR" },
  });

  console.log("Development seed completed.");
  console.log(`Employees: ${employeeCount} | Supervisors: ${supervisorCount}`);
  console.log("DEVELOPMENT-ONLY password for all seeded users:", DEV_PASSWORD);
  console.log("Named demo accounts:");
  for (const account of namedAccounts) {
    console.log(`  ${account.employeeId}  ${account.role.padEnd(11)}  ${account.name}`);
  }
}

async function resetCycleData() {
  await prisma.employeeCycleParticipation.deleteMany();
  await prisma.appraisalCycleActivity.deleteMany();
  await prisma.appraisalCycleStage.deleteMany();
  await prisma.batchAssignmentHistory.deleteMany();
  await prisma.supervisorAssignmentHistory.deleteMany();
  await prisma.employeeBatchAssignment.deleteMany();
  await prisma.employeeSupervisorAssignment.deleteMany();
  await prisma.appraisalBatch.deleteMany();
  await prisma.appraisalCycle.deleteMany();
}

async function seedTeamsAndHrAssignments(random: () => number) {
  await prisma.hrTeamAssignment.deleteMany();
  await prisma.employee.updateMany({ data: { teamId: null } });
  await prisma.team.deleteMany();

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const hrStaff = await prisma.employee.findMany({
    where: { role: "HR" },
    orderBy: { employeeId: "asc" },
  });
  if (hrStaff.length === 0) return;

  let teamCounter = 0;
  const createdTeams: Array<{ id: string }> = [];

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

    for (let index = 0; index < supervisors.length; index += 1) {
      teamCounter += 1;
      const supervisor = supervisors[index]!;
      const team = await prisma.team.create({
        data: {
          name: `Team ${teamCounter} – ${department.name}`,
          departmentId: department.id,
          supervisorId: supervisor.id,
        },
      });
      createdTeams.push(team);

      await prisma.employee.update({
        where: { id: supervisor.id },
        data: { teamId: team.id },
      });

      const sliceStart = Math.floor((employees.length * index) / supervisors.length);
      const sliceEnd = Math.floor((employees.length * (index + 1)) / supervisors.length);
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

  console.log(
    `Teams seeded: ${createdTeams.length} teams across ${departments.length} departments for ${hrStaff.length} HR staff.`
  );
}

function defaultStages(start: Date) {
  const year = start.getUTCFullYear();
  return [
    {
      key: "PERFORMANCE_PLANNING" as const,
      title: "Performance Planning",
      sortOrder: 1,
      startDate: utcDate(year, 1, 1),
      endDate: utcDate(year, 2, 28),
    },
    {
      key: "PERFORMANCE_TRACKING" as const,
      title: "Performance Tracking",
      sortOrder: 2,
      startDate: utcDate(year, 3, 1),
      endDate: utcDate(year, 8, 31),
    },
    {
      key: "SELF_REVIEW" as const,
      title: "Self Review",
      sortOrder: 3,
      startDate: utcDate(year, 9, 1),
      endDate: utcDate(year, 9, 30),
    },
    {
      key: "PEER_REVIEW" as const,
      title: "Peer Review",
      sortOrder: 4,
      startDate: utcDate(year, 10, 1),
      endDate: utcDate(year, 10, 15),
    },
    {
      key: "SUPERVISOR_REVIEW" as const,
      title: "Supervisor Review",
      sortOrder: 5,
      startDate: utcDate(year, 10, 16),
      endDate: utcDate(year, 11, 30),
    },
    {
      key: "HR_EVALUATION" as const,
      title: "HR Evaluation",
      sortOrder: 6,
      startDate: utcDate(year, 12, 1),
      endDate: utcDate(year, 12, 31),
    },
  ];
}

async function seedAppraisalCycles(hrUserId: string, random: () => number) {
  await resetCycleData();

  const assignable = await prisma.employee.findMany({
    where: { role: { in: ["EMPLOYEE", "SUPERVISOR"] } },
    select: {
      id: true,
      employeeId: true,
      role: true,
      departmentId: true,
      teamId: true,
    },
    orderBy: { employeeId: "asc" },
  });

  const supervisors = await prisma.employee.findMany({
    where: { role: "SUPERVISOR" },
    select: { id: true, departmentId: true, employeeId: true },
    orderBy: { employeeId: "asc" },
  });

  const supervisorsByDept = new Map<string, string[]>();
  for (const supervisor of supervisors) {
    if (!supervisor.departmentId) continue;
    const list = supervisorsByDept.get(supervisor.departmentId) ?? [];
    list.push(supervisor.id);
    supervisorsByDept.set(supervisor.departmentId, list);
  }

  const supervisorLoad = new Map<string, number>();
  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);

  function pickSupervisor(departmentId: string | null) {
    if (!departmentId) return null;
    const pool = supervisorsByDept.get(departmentId);
    if (!pool?.length) return null;
    return pool.reduce((lowest, current) => {
      const lowestLoad = supervisorLoad.get(lowest) ?? 0;
      const currentLoad = supervisorLoad.get(current) ?? 0;
      const jitter = random() * 3;
      return currentLoad + jitter < lowestLoad ? current : lowest;
    });
  }

  async function createCycle(options: {
    name: string;
    description: string;
    status: "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED";
    year: number;
    confirmedAt?: Date;
    activatedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const start = utcDate(options.year, 1, 1);
    const end = utcDate(options.year, 12, 31);
    return prisma.appraisalCycle.create({
      data: {
        name: options.name,
        description: options.description,
        startDate: start,
        endDate: end,
        status: options.status,
        activeLock: options.status === "ACTIVE" ? "ACTIVE" : null,
        confirmedAt: options.confirmedAt ?? null,
        activatedAt: options.activatedAt ?? null,
        completedAt: options.completedAt ?? null,
        createdById: hrUserId,
        createdAt: options.createdAt,
        updatedAt: options.updatedAt,
        batches: {
          create: [
            {
              batchNumber: 1,
              name: "Organization",
              description: "Internal organization-wide window",
              startDate: start,
              endDate: end,
              status:
                options.status === "COMPLETED"
                  ? "FINISHED"
                  : options.status === "ACTIVE"
                    ? "ONGOING"
                    : "UPCOMING",
            },
          ],
        },
        stages: {
          create: defaultStages(start),
        },
        activities: {
          create: [
            {
              actorId: hrUserId,
              action: "Created cycle",
              details: `Created ${options.name}`,
              createdAt: options.createdAt,
            },
            ...(options.confirmedAt
              ? [
                  {
                    actorId: hrUserId,
                    action: "Submitted cycle",
                    details: `${options.name} moved to Upcoming`,
                    createdAt: options.confirmedAt,
                  },
                ]
              : []),
            ...(options.activatedAt
              ? [
                  {
                    actorId: hrUserId,
                    action: "Activated cycle",
                    details: `${options.name} is now active`,
                    createdAt: options.activatedAt,
                  },
                ]
              : []),
            ...(options.completedAt
              ? [
                  {
                    actorId: hrUserId,
                    action: "Completed cycle",
                    details: `${options.name} marked completed`,
                    createdAt: options.completedAt,
                  },
                ]
              : []),
          ],
        },
      },
      include: { batches: true },
    });
  }

  const completed2023 = await createCycle({
    name: "Annual Appraisal 2023",
    description:
      "Historical organization-wide appraisal cycle for all employees across the organization.",
    status: "COMPLETED",
    year: 2023,
    confirmedAt: utcDate(2022, 11, 15),
    activatedAt: utcDate(2023, 1, 1),
    completedAt: utcDate(2023, 12, 31),
    createdAt: utcDate(2022, 11, 1),
    updatedAt: utcDate(2023, 12, 31),
  });

  const completed2024 = await createCycle({
    name: "Annual Appraisal 2024",
    description:
      "Historical organization-wide appraisal cycle for all employees across the organization.",
    status: "COMPLETED",
    year: 2024,
    confirmedAt: utcDate(2023, 11, 20),
    activatedAt: utcDate(2024, 1, 1),
    completedAt: utcDate(2024, 12, 31),
    createdAt: utcDate(2023, 11, 5),
    updatedAt: utcDate(2024, 12, 31),
  });

  const completed2025 = await createCycle({
    name: "Annual Appraisal 2025",
    description:
      "Historical organization-wide appraisal cycle for all employees across the organization.",
    status: "COMPLETED",
    year: 2025,
    confirmedAt: utcDate(2024, 11, 18),
    activatedAt: utcDate(2025, 1, 1),
    completedAt: utcDate(2025, 12, 31),
    createdAt: utcDate(2024, 11, 2),
    updatedAt: utcDate(2025, 12, 31),
  });

  const active = await createCycle({
    name: "Annual Appraisal 2026",
    description:
      "Annual performance and development appraisal cycle for all employees across the organization.",
    status: "ACTIVE",
    year: 2026,
    confirmedAt: utcDate(2025, 12, 5),
    activatedAt: utcDate(2026, 1, 1),
    createdAt: utcDate(2025, 12, 1),
    updatedAt: utcDate(2025, 12, 15),
  });

  await prisma.appraisalCycleActivity.create({
    data: {
      cycleId: active.id,
      actorId: hrUserId,
      action: "Updated timeline",
      details: "Modified Performance Tracking end date to 31 Aug 2026",
      createdAt: utcDate(2025, 12, 15),
    },
  });

  const upcoming = await createCycle({
    name: "Annual Appraisal 2027",
    description:
      "Upcoming organization-wide appraisal cycle for all employees across the organization.",
    status: "UPCOMING",
    year: 2027,
    confirmedAt: utcDate(2026, 8, 1),
    createdAt: utcDate(2026, 7, 15),
    updatedAt: utcDate(2026, 8, 1),
  });

  const draft = await createCycle({
    name: "Annual Appraisal 2028",
    description:
      "Draft appraisal cycle in preparation. Configure timeline and settings before submitting.",
    status: "DRAFT",
    year: 2028,
    createdAt: utcDate(2026, 9, 1),
    updatedAt: utcDate(2026, 9, 1),
  });

  async function assignCycle(
    cycle: typeof active,
    mode: "completed" | "active" | "upcoming" | "draft"
  ) {
    const batch = cycle.batches[0]!;
    const batchAssignments = [];
    const supervisorAssignments = [];
    const participations = [];

    for (const person of assignable) {
      batchAssignments.push({
        cycleId: cycle.id,
        batchId: batch.id,
        employeeId: person.id,
      });

      if (person.role === "EMPLOYEE") {
        const supervisorId = pickSupervisor(person.departmentId);
        if (supervisorId) {
          supervisorAssignments.push({
            cycleId: cycle.id,
            employeeId: person.id,
            supervisorId,
          });
          supervisorLoad.set(
            supervisorId,
            (supervisorLoad.get(supervisorId) ?? 0) + 1
          );
        }
      }

      if (mode === "completed") {
        participations.push({
          cycleId: cycle.id,
          employeeId: person.id,
          status: "COMPLETED" as const,
          progressPercent: 100,
        });
      } else if (mode === "active") {
        const roll = random();
        if (roll < 0.49) {
          participations.push({
            cycleId: cycle.id,
            employeeId: person.id,
            status: "COMPLETED" as const,
            progressPercent: 100,
          });
        } else if (roll < 0.94) {
          participations.push({
            cycleId: cycle.id,
            employeeId: person.id,
            status: "IN_PROGRESS" as const,
            progressPercent: 35 + Math.floor(random() * 40),
          });
        } else {
          participations.push({
            cycleId: cycle.id,
            employeeId: person.id,
            status: "OVERDUE" as const,
            progressPercent: 10 + Math.floor(random() * 25),
          });
        }
      } else if (mode === "upcoming") {
        participations.push({
          cycleId: cycle.id,
          employeeId: person.id,
          status: "NOT_STARTED" as const,
          progressPercent: 0,
        });
      } else {
        participations.push({
          cycleId: cycle.id,
          employeeId: person.id,
          status: "NOT_STARTED" as const,
          progressPercent: 0,
        });
      }
    }

    for (let index = 0; index < batchAssignments.length; index += CHUNK_SIZE) {
      await prisma.employeeBatchAssignment.createMany({
        data: batchAssignments.slice(index, index + CHUNK_SIZE),
      });
    }
    for (let index = 0; index < supervisorAssignments.length; index += CHUNK_SIZE) {
      await prisma.employeeSupervisorAssignment.createMany({
        data: supervisorAssignments.slice(index, index + CHUNK_SIZE),
      });
    }
    for (let index = 0; index < participations.length; index += CHUNK_SIZE) {
      await prisma.employeeCycleParticipation.createMany({
        data: participations.slice(index, index + CHUNK_SIZE),
      });
    }
  }

  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(completed2023, "completed");
  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(completed2024, "completed");
  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(completed2025, "completed");
  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(active, "active");
  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(upcoming, "upcoming");
  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(draft, "draft");

  console.log("Appraisal cycle demo data seeded.");
  console.log(
    `Cycles: ${completed2023.name}, ${completed2024.name}, ${completed2025.name} (COMPLETED); ${active.name} (ACTIVE); ${upcoming.name} (UPCOMING); ${draft.name} (DRAFT)`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
