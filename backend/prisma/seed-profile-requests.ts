import fs from "node:fs";
import path from "node:path";
import type { PrismaClient, ProfileChangeRequestStatus, ProfileChangeRequestType } from "../generated/prisma/client.js";
import { evidenceDir, ensureUploadDirs } from "../src/lib/uploads.js";

function writeDemoEvidence(filename: string, contents: string) {
  ensureUploadDirs();
  const filePath = path.join(evidenceDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents);
  }
  return {
    filename,
    originalName: filename.replace(/^demo-/, ""),
    mime: filename.endsWith(".jpg") ? "image/jpeg" : "text/plain",
    size: Buffer.byteLength(contents),
  };
}

export async function seedNamedHrManager(prisma: PrismaClient) {
  const hrDept = await prisma.department.findFirst({
    where: { name: "Human Resources" },
  });
  await prisma.employee.updateMany({
    where: { employeeId: "HRM000001" },
    data: {
      name: "Hashini Karunaratne",
      jobTitle: "HR Manager",
      companyEmail: "hashini.karunaratne@altrium.local",
      ...(hrDept ? { departmentId: hrDept.id } : {}),
    },
  });
}

export async function seedDemoProfileChangeRequests(prisma: PrismaClient) {
  const existing = await prisma.profileChangeRequest.count();
  if (existing > 0) return { created: 0, skipped: existing };

  const manager = await prisma.employee.findFirst({
    where: { role: "HR_MANAGER" },
    orderBy: { employeeId: "asc" },
  });
  const hrStaff = await prisma.employee.findMany({
    where: { role: "HR" },
    orderBy: { employeeId: "asc" },
    take: 4,
  });
  const employees = await prisma.employee.findMany({
    where: { role: "EMPLOYEE" },
    include: {
      team: { include: { hrAssignments: true } },
      department: true,
    },
    orderBy: { employeeId: "asc" },
    take: 40,
  });
  const supervisors = await prisma.employee.findMany({
    where: { role: "SUPERVISOR" },
    include: {
      team: { include: { hrAssignments: true } },
      department: true,
    },
    orderBy: { employeeId: "asc" },
    take: 20,
  });

  if (!manager || hrStaff.length === 0) return { created: 0, skipped: 0 };

  const photo = writeDemoEvidence(
    "demo-mobile_verification.txt",
    "Demo supporting evidence for a contact-number update."
  );
  const letter = writeDemoEvidence(
    "demo-name_change_letter.txt",
    "Demo supporting letter for a name update."
  );

  const samples: Array<{
    requester: (typeof employees)[number] | (typeof supervisors)[number] | (typeof hrStaff)[number];
    recipientId: string;
    requestType: ProfileChangeRequestType;
    summary: string;
    currentValue: string;
    requestedValue: string;
    reason: string;
    status: ProfileChangeRequestStatus;
    evidence?: typeof photo;
  }> = [];

  const hrFor = (person: { team: { hrAssignments: Array<{ hrEmployeeId: string }> } | null }) =>
    person.team?.hrAssignments[0]?.hrEmployeeId ?? hrStaff[0]!.id;

  if (employees[0]) {
    samples.push({
      requester: employees[0],
      recipientId: hrFor(employees[0]),
      requestType: "CONTACT_NUMBER",
      summary: "Contact Number Update",
      currentValue: "+94 77 123 4567",
      requestedValue: "+94 76 987 6543",
      reason: "I have changed my mobile number. Please update it in my profile.",
      status: "PENDING",
      evidence: photo,
    });
  }
  if (employees[1]) {
    samples.push({
      requester: employees[1],
      recipientId: hrFor(employees[1]),
      requestType: "ADDRESS",
      summary: "Address Update",
      currentValue: "Colombo 03, Sri Lanka",
      requestedValue: "Rajagiriya, Sri Lanka",
      reason: "I recently moved and need my work location updated.",
      status: "PENDING",
    });
  }
  if (employees[2]) {
    samples.push({
      requester: employees[2],
      recipientId: hrFor(employees[2]),
      requestType: "EMERGENCY_CONTACT",
      summary: "Emergency Contact Update",
      currentValue: "Nimali Fernando · Parent · +94 77 111 2222",
      requestedValue: "Kasun Fernando · Spouse · +94 77 333 4444",
      reason: "Please update my emergency contact to my spouse.",
      status: "APPROVED",
    });
  }
  if (employees[3]) {
    samples.push({
      requester: employees[3],
      recipientId: hrFor(employees[3]),
      requestType: "EMAIL",
      summary: "Email Address Update",
      currentValue: employees[3].companyEmail,
      requestedValue: employees[3].companyEmail.replace("@", ".updated@"),
      reason: "Please use my updated work email going forward.",
      status: "REJECTED",
    });
  }
  if (supervisors[0]) {
    samples.push({
      requester: supervisors[0],
      recipientId: hrFor(supervisors[0]),
      requestType: "CONTACT_NUMBER",
      summary: "Phone Number Update",
      currentValue: "+94 71 555 0101",
      requestedValue: "+94 71 555 0199",
      reason: "My office mobile was replaced last week.",
      status: "PENDING",
    });
  }
  if (supervisors[1]) {
    samples.push({
      requester: supervisors[1],
      recipientId: hrFor(supervisors[1]),
      requestType: "NAME",
      summary: "Name Update",
      currentValue: supervisors[1].name,
      requestedValue: supervisors[1].name.replace(" ", " A. "),
      reason: "Please include my middle initial on the official profile.",
      status: "PENDING",
      evidence: letter,
    });
  }
  if (hrStaff[0]) {
    samples.push({
      requester: hrStaff[0],
      recipientId: manager.id,
      requestType: "CONTACT_NUMBER",
      summary: "Contact Number Update",
      currentValue: "+94 11 200 1001",
      requestedValue: "+94 11 200 1099",
      reason: "HR desk phone extension has changed.",
      status: "PENDING",
    });
  }
  if (hrStaff[1]) {
    samples.push({
      requester: hrStaff[1],
      recipientId: manager.id,
      requestType: "ADDRESS",
      summary: "Work Location Update",
      currentValue: "Colombo, Sri Lanka",
      requestedValue: "Colombo 07, Sri Lanka",
      reason: "I am now based at the head-office campus.",
      status: "APPROVED",
    });
  }
  if (hrStaff[2]) {
    samples.push({
      requester: hrStaff[2],
      recipientId: manager.id,
      requestType: "EMERGENCY_CONTACT",
      summary: "Emergency Contact Update",
      currentValue: "Grace Tan · Spouse · +94 77 200 3000",
      requestedValue: "Mei Tan · Sister · +94 77 200 3111",
      reason: "Please update my emergency contact details.",
      status: "REJECTED",
    });
  }

  let created = 0;
  for (const sample of samples) {
    const createdAt = new Date(Date.now() - created * 36 * 60 * 60 * 1000);
    await prisma.profileChangeRequest.create({
      data: {
        requesterId: sample.requester.id,
        recipientId: sample.recipientId,
        requestType: sample.requestType,
        summary: sample.summary,
        currentValue: sample.currentValue,
        requestedValue: sample.requestedValue,
        reason: sample.reason,
        status: sample.status,
        createdAt,
        ...(sample.status === "PENDING"
          ? {}
          : { reviewedAt: createdAt, reviewedById: sample.recipientId }),
        ...(sample.evidence
          ? {
              evidence: sample.evidence.filename,
              evidenceName: sample.evidence.originalName,
              evidenceMime: sample.evidence.mime,
              evidenceSize: sample.evidence.size,
            }
          : {}),
      },
    });
    created += 1;
  }

  return { created, skipped: 0 };
}
