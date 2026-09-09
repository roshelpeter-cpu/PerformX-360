/**
 * DEVELOPMENT-ONLY seed for authentication and Appraisal Cycle Management.
 * Do NOT use these credentials in production.
 *
 * Run with: npm run db:seed
 *
 * Dataset targets:
 * - 15 realistic IT-company departments
 * - 693 EMPLOYEE + 170 SUPERVISOR = 863 assignable people
 * - 2025 COMPLETED historical cycle
 * - 2026 ACTIVE demonstration cycle (small unassigned set for lecturer demos)
 * - 2027 UPCOMING confirmed cycle
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
      name: "HR Administrator",
      role: "HR" as const,
      jobTitle: "HR Administrator",
      companyEmail: "hr.admin@altrium.local",
      departmentId: hrDept.id,
    },
    {
      employeeId: "HR000002",
      name: "Nadeesha Bandara",
      role: "HR" as const,
      jobTitle: "HR Officer",
      companyEmail: "nadeesha.bandara@altrium.local",
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

  const hrUser = await prisma.employee.findUniqueOrThrow({
    where: { employeeId: "HR000001" },
  });

  await seedAppraisalCycles(hrUser.id, random);

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
  await prisma.batchAssignmentHistory.deleteMany();
  await prisma.supervisorAssignmentHistory.deleteMany();
  await prisma.employeeBatchAssignment.deleteMany();
  await prisma.employeeSupervisorAssignment.deleteMany();
  await prisma.appraisalBatch.deleteMany();
  await prisma.appraisalCycle.deleteMany();
}

async function seedAppraisalCycles(
  hrUserId: string,
  random: () => number
) {
  await resetCycleData();

  const assignable = await prisma.employee.findMany({
    where: { role: { in: ["EMPLOYEE", "SUPERVISOR"] } },
    select: {
      id: true,
      employeeId: true,
      role: true,
      departmentId: true,
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

  function pickBatchIndex(employeeId: string) {
    const n = Number(employeeId.replace(/\D/g, "")) || 0;
    const slot = n % 10;
    if (slot < 4) return 0;
    if (slot < 7) return 1;
    return 2;
  }

  async function createCycle(options: {
    name: string;
    description: string;
    status: "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED";
    start: Date;
    batchStarts: [Date, Date, Date];
    confirmedAt?: Date;
    activatedAt?: Date;
    completedAt?: Date;
  }) {
    const end = addOneYear(options.start);
    return prisma.appraisalCycle.create({
      data: {
        name: options.name,
        description: options.description,
        startDate: options.start,
        endDate: end,
        status: options.status,
        activeLock: options.status === "ACTIVE" ? "ACTIVE" : null,
        confirmedAt: options.confirmedAt ?? null,
        activatedAt: options.activatedAt ?? null,
        completedAt: options.completedAt ?? null,
        createdById: hrUserId,
        batches: {
          create: options.batchStarts.map((start, index) => ({
            batchNumber: index + 1,
            name: `Batch ${index + 1}`,
            description: `Appraisal batch ${index + 1} for ${options.name}`,
            startDate: start,
            endDate: addOneYear(start),
            status:
              options.status === "COMPLETED"
                ? "FINISHED"
                : start > new Date()
                  ? "UPCOMING"
                  : addOneYear(start) <= new Date()
                    ? "FINISHED"
                    : "ONGOING",
          })),
        },
      },
      include: { batches: { orderBy: { batchNumber: "asc" } } },
    });
  }

  const historical = await createCycle({
    name: "2025 Annual Appraisal",
    description: "Completed historical appraisal cycle retained for reference.",
    status: "COMPLETED",
    start: utcDate(2025, 3, 1),
    batchStarts: [utcDate(2025, 3, 1), utcDate(2025, 5, 1), utcDate(2025, 8, 1)],
    confirmedAt: utcDate(2025, 2, 10),
    activatedAt: utcDate(2025, 3, 1),
    completedAt: utcDate(2026, 3, 10),
  });

  const active = await createCycle({
    name: "2026 Annual Appraisal",
    description:
      "Current active appraisal cycle. Most employees are already assigned; a small set of new joiners still need a batch or supervisor.",
    status: "ACTIVE",
    start: utcDate(2026, 3, 1),
    batchStarts: [utcDate(2026, 3, 1), utcDate(2026, 5, 1), utcDate(2026, 10, 1)],
    confirmedAt: utcDate(2026, 2, 12),
    activatedAt: utcDate(2026, 3, 1),
  });

  const upcoming = await createCycle({
    name: "2027 Annual Appraisal",
    description: "Confirmed upcoming cycle. Ready to activate after 2026 is completed.",
    status: "UPCOMING",
    start: utcDate(2027, 3, 1),
    batchStarts: [utcDate(2027, 3, 1), utcDate(2027, 5, 1), utcDate(2027, 8, 1)],
    confirmedAt: utcDate(2026, 8, 1),
  });

  const employeesOnly = assignable.filter((person) => person.role === "EMPLOYEE");
  const unassignedNeither = new Set(
    employeesOnly.slice(-7, -2).map((person) => person.id)
  );
  const unassignedBatchOnly = new Set(
    employeesOnly.slice(-2).map((person) => person.id)
  );
  const unassignedSupervisorOnly = new Set(
    employeesOnly.slice(-12, -7).map((person) => person.id)
  );

  async function assignCycle(
    cycle: typeof active,
    mode: "full" | "demo-active"
  ) {
    const batchAssignments = [];
    const supervisorAssignments = [];

    for (const person of assignable) {
      const skipBatch =
        mode === "demo-active" &&
        (unassignedNeither.has(person.id) || unassignedBatchOnly.has(person.id));
      const skipSupervisor =
        mode === "demo-active" &&
        (unassignedNeither.has(person.id) ||
          unassignedSupervisorOnly.has(person.id));

      if (!skipBatch) {
        const batch = cycle.batches[pickBatchIndex(person.employeeId)]!;
        batchAssignments.push({
          cycleId: cycle.id,
          batchId: batch.id,
          employeeId: person.id,
        });
      }

      if (person.role === "EMPLOYEE" && !skipSupervisor) {
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
  }

  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(historical, "full");

  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(active, "demo-active");

  for (const supervisor of supervisors) supervisorLoad.set(supervisor.id, 0);
  await assignCycle(upcoming, "full");

  const sampleEmployee = employeesOnly[20];
  const sampleEmployee2 = employeesOnly[35];
  if (sampleEmployee && sampleEmployee2 && active.batches[0] && active.batches[1]) {
    await prisma.batchAssignmentHistory.create({
      data: {
        cycleId: active.id,
        employeeId: sampleEmployee.id,
        previousBatchId: active.batches[0].id,
        newBatchId: active.batches[1].id,
        reason: "Long leave covering Batch 1 window",
        changedById: hrUserId,
        effectiveDate: utcDate(2026, 6, 1),
      },
    });

    const deptSupervisors = supervisors.filter(
      (item) => item.departmentId === sampleEmployee2.departmentId
    );
    if (deptSupervisors.length >= 2) {
      await prisma.supervisorAssignmentHistory.create({
        data: {
          cycleId: active.id,
          employeeId: sampleEmployee2.id,
          previousSupervisorId: deptSupervisors[0]!.id,
          newSupervisorId: deptSupervisors[1]!.id,
          reason: "Organizational change within the department",
          changedById: hrUserId,
          effectiveDate: utcDate(2026, 7, 15),
        },
      });
    }
  }

  console.log("Appraisal cycle demo data seeded.");
  console.log(
    `Cycles: ${historical.name} (COMPLETED), ${active.name} (ACTIVE), ${upcoming.name} (UPCOMING)`
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
