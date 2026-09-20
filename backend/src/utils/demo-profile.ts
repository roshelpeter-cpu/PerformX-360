const FEMALE_FIRST = new Set([
  "sarah",
  "anita",
  "ayesha",
  "tharushi",
  "ishara",
  "malsha",
  "nadeesha",
  "fathima",
  "sanduni",
  "dilini",
  "harini",
  "meera",
  "amaya",
  "shenali",
  "rashmi",
  "thilini",
  "nethmi",
  "nur",
  "farah",
  "maya",
  "nimali",
  "hashini",
  "nimali",
  "malini",
  "grace",
]);

const MALE_FIRST = new Set([
  "alex",
  "daniel",
  "lim",
  "kevin",
  "ryan",
  "kavindu",
  "mohamed",
  "rizwan",
  "dinesh",
  "priyan",
  "hasan",
  "chamath",
  "ruwan",
  "lakshan",
  "yasith",
  "sanjaya",
  "kasun",
  "nuwan",
  "ishan",
  "gihan",
  "arjun",
  "sahan",
  "nimal",
  "wei",
]);

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const NAMED_PORTRAITS: Record<string, string> = {
  EMP000001:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80",
  SUP000001:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400&q=80",
  HR000001:
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&h=400&q=80",
  HR000002:
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&h=400&q=80",
  HR000003:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400&q=80",
  HR000004:
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&h=400&q=80",
  HRM000001:
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&h=400&q=80",
  LED000001:
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400&q=80",
  EMP000901:
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&h=400&q=80",
  EMP000902:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=400&q=80",
  EMP000903:
    "https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=400&h=400&q=80",
  EMP000904:
    "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=400&h=400&q=80",
};

export function getPortraitUrl(employeeId: string) {
  return (
    NAMED_PORTRAITS[employeeId] ??
    `https://i.pravatar.cc/300?u=${encodeURIComponent(employeeId)}`
  );
}

function inferGender(name: string, employeeId: string) {
  const first = name.split(" ")[0]?.toLowerCase() ?? "";
  if (FEMALE_FIRST.has(first)) return "Female";
  if (MALE_FIRST.has(first)) return "Male";
  return hashString(employeeId) % 2 === 0 ? "Male" : "Female";
}

function phoneFromId(employeeId: string, salt: string) {
  const n = (hashString(`${employeeId}:${salt}`) % 9000000) + 1000000;
  const digits = String(n);
  return `+94 77 ${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
}

function dateFromId(employeeId: string, salt: string, startYear: number, span: number) {
  const hash = hashString(`${employeeId}:${salt}`);
  const year = startYear + (hash % span);
  const month = (hash % 12) + 1;
  const day = (hash % 27) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const NAMED_EMERGENCY: Record<string, { name: string; relationship: string }> = {
  EMP000001: { name: "Rohan Perera", relationship: "Father" },
  SUP000001: { name: "Malini Fernando", relationship: "Mother" },
  HR000001: { name: "Ahmad Rahman", relationship: "Spouse" },
  HR000002: { name: "Grace Tan", relationship: "Spouse" },
  HR000003: { name: "Wei Ming", relationship: "Brother" },
  HR000004: { name: "Aisha Nabila", relationship: "Sister" },
  HRM000001: { name: "Arjun Wickramasinghe", relationship: "Spouse" },
  LED000001: { name: "Sanduni Perera", relationship: "Spouse" },
  EMP000901: { name: "Chamath Silva", relationship: "Father" },
  EMP000902: { name: "Ruwan Fernando", relationship: "Father" },
  EMP000903: { name: "Nalini Peris", relationship: "Mother" },
  EMP000904: { name: "Priyan De Silva", relationship: "Brother" },
};

const DEPARTMENT_JOB_TITLES: Record<string, string[]> = {
  Engineering: ["Software Engineer", "Backend Engineer", "Frontend Engineer", "Full-Stack Engineer"],
  "Information Technology": [
    "IT Support Specialist",
    "Systems Administrator",
    "IT Analyst",
    "Network Engineer",
  ],
  "Product Management": ["Product Analyst", "Product Owner", "Associate Product Manager"],
  "Quality Assurance": ["QA Engineer", "Test Analyst", "Quality Analyst"],
  "DevOps / Cloud": ["Cloud Engineer", "DevOps Engineer", "Site Reliability Engineer"],
  Cybersecurity: ["Security Analyst", "Cybersecurity Engineer", "SOC Analyst"],
  "Data & Analytics": ["Data Analyst", "Analytics Engineer", "Business Intelligence Analyst"],
  "UI/UX Design": ["UX Designer", "UI Designer", "Product Designer"],
  "Human Resources": ["HR Coordinator", "People Operations Specialist", "HR Analyst"],
  Finance: ["Finance Analyst", "Accountant", "Payroll Specialist"],
  Sales: ["Sales Executive", "Account Executive", "Sales Analyst"],
  Marketing: ["Marketing Executive", "Content Specialist", "Brand Associate"],
  "Customer Success": ["Customer Success Associate", "Support Specialist"],
  Operations: ["Operations Analyst", "Operations Coordinator"],
  Administration: ["Admin Executive", "Office Coordinator"],
};

export function resolveJobTitle(input: {
  jobTitle: string | null | undefined;
  role: string;
  departmentName?: string | null | undefined;
  employeeId: string;
}) {
  if (input.jobTitle?.trim()) return input.jobTitle.trim();
  const department = input.departmentName ?? "Operations";
  if (input.role === "SUPERVISOR") return `${department} Supervisor`;
  if (input.role === "HR") return "HR Officer";
  if (input.role === "HR_MANAGER") return "HR Manager";
  if (input.role === "LEADERSHIP") return `Head of ${department}`;
  const options = DEPARTMENT_JOB_TITLES[department] ?? ["Associate"];
  const index = hashString(`${input.employeeId}:title`) % options.length;
  return options[index]!;
}

export function enrichEmployeeProfile(input: {
  employeeId: string;
  name: string;
  companyEmail: string;
  jobTitle: string | null;
  createdAt: Date;
  role: string;
  departmentName?: string | null | undefined;
}) {
  const gender = inferGender(input.name, input.employeeId);
  const lastName = input.name.split(" ").slice(1).join(" ") || "Family";
  const emergency =
    NAMED_EMERGENCY[input.employeeId] ??
    {
      name: gender === "Female" ? `Nimali ${lastName}` : `Kasun ${lastName}`,
      relationship:
        hashString(input.employeeId) % 3 === 0
          ? "Spouse"
          : hashString(input.employeeId) % 3 === 1
            ? "Parent"
            : "Sibling",
    };

  const lastLogin = new Date(
    Date.now() - (hashString(`${input.employeeId}:login`) % 48) * 60 * 60 * 1000
  );

  const locations = ["Colombo, Sri Lanka", "Colombo 03, Sri Lanka", "Rajagiriya, Sri Lanka"];
  const workLocation =
    locations[hashString(`${input.employeeId}:loc`) % locations.length]!;

  return {
    dateOfBirth: dateFromId(input.employeeId, "dob", 1986, 16).toISOString(),
    gender,
    nationality: "Sri Lankan",
    contactNumber: phoneFromId(input.employeeId, "mobile"),
    employmentType: "Permanent",
    workLocation,
    dateJoined: input.createdAt.toISOString(),
    emergencyContactName: emergency.name,
    emergencyContactRelationship: emergency.relationship,
    emergencyContactNumber: phoneFromId(input.employeeId, "emergency"),
    lastLoginAt: lastLogin.toISOString(),
    avatarUrl: getPortraitUrl(input.employeeId),
    jobTitle: resolveJobTitle(input),
  };
}

export function mergeProfileDetails<T extends Record<string, unknown>>(
  demo: T,
  profileDetails: unknown
): T {
  if (!profileDetails || typeof profileDetails !== "object" || Array.isArray(profileDetails)) {
    return demo;
  }
  return { ...demo, ...(profileDetails as Record<string, unknown>) };
}

export function metricFromId(employeeId: string, salt: string, min: number, max: number) {
  return min + (hashString(`${employeeId}:${salt}`) % (max - min + 1));
}

export function demoPdpForEmployee(employeeId: string) {
  const bucket = hashString(`${employeeId}:pdp`) % 5;
  if (bucket === 0) {
    return { status: "DRAFT" as const, label: "DRAFT", progressPercent: 0, active: false };
  }
  if (bucket === 1) {
    return { status: "APPROVED" as const, label: "APPROVED", progressPercent: 100, active: true };
  }
  const progressPercent = [25, 33, 45, 60, 75][hashString(`${employeeId}:pdp%`) % 5]!;
  return {
    status: "IN_PROGRESS" as const,
    label: `${progressPercent}%`,
    progressPercent,
    active: true,
  };
}
