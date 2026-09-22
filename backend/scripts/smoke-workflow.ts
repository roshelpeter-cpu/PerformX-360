import "dotenv/config";

const base = "http://localhost:5001/api";

async function login(employeeId: string) {
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, password: "DevTest@2026" }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!res.ok) throw new Error(`login ${employeeId} failed`);
  return cookie;
}

async function req(method: string, path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function main() {
  const cookie = await login("SUP000001");
  const board = await req("GET", "/meetings/planning?page=1&pageSize=30", cookie);
  const row = board.data.board.items.find(
    (item: { meeting?: { status?: string } }) => item.meeting?.status === "SCHEDULED"
  );
  if (!row?.meeting?.id) {
    console.log("No scheduled meeting found");
    return;
  }
  const id = row.meeting.id as string;
  const empty = {
    context: "",
    discussion: "",
    decisions: "",
    actions: "",
  };
  const notes = await req("PUT", `/meetings/planning/${id}/notes`, cookie, {
    previousAppraisal: empty,
    previousPdp: empty,
    strengthsWeaknesses: empty,
    departmentObjectives: empty,
    companyObjectives: empty,
    developmentNeeds: {
      context: "Skills / training needs test",
      discussion: "Key points",
      decisions: "Decision",
      actions: "Action",
    },
    decisionsActions: {
      context: "",
      discussion: "",
      decisions: "Final decision",
      actions: "Agreed action",
    },
  });
  console.log("save notes", notes.status, {
    canEditNotes: notes.data.meeting?.canEditNotes,
    hasNotes: Boolean(notes.data.meeting?.notes),
    status: notes.data.meeting?.status,
  });

  const complete = await req("POST", `/meetings/planning/${id}/complete`, cookie);
  console.log("complete", complete.status, {
    status: complete.data.meeting?.status,
    hasNotes: Boolean(complete.data.meeting?.notes),
  });

  // Employee approve pending PDP
  const empCookie = await login("EMP000902");
  const mine = await req("GET", "/pdps/mine", empCookie);
  const pdpId = mine.data.pdp?.id as string | undefined;
  console.log("EMP902 pdp before", mine.data.pdp?.status, mine.data.pdp?.permissions);
  if (pdpId && mine.data.pdp?.permissions?.canApproveAsEmployee) {
    const approved = await req("POST", `/pdps/${pdpId}/employee/approve`, empCookie);
    console.log("EMP902 approve", approved.status, approved.data.pdp?.status, {
      emp: approved.data.pdp?.employeeApproval?.status,
      hr: approved.data.pdp?.hrApproval?.status,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
