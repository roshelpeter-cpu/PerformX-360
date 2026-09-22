import "dotenv/config";

const base = "http://localhost:5001/api";

async function login(employeeId: string) {
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, password: "DevTest@2026" }),
  });
  const setCookie =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`login failed ${employeeId}: ${JSON.stringify(data)}`);
  }
  return cookie;
}

async function get(path: string, cookie: string) {
  const res = await fetch(`${base}${path}`, { headers: { Cookie: cookie } });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  try {
    const health = await fetch(`${base.replace("/api", "")}/api/auth/me`);
    console.log("server reachable?", health.status);
  } catch (error) {
    console.error("Server not reachable on :5001 — start backend with npm run dev");
    process.exit(1);
  }

  const sup = await login("SUP000001");
  const board = await get("/pdps?page=1&pageSize=5", sup);
  console.log("SUP board", board.status, board.data?.board?.kpis);

  const emp = await login("EMP000901");
  const mineMeeting = await get("/meetings/planning/mine", emp);
  console.log(
    "EMP901 meeting",
    mineMeeting.status,
    mineMeeting.data?.meetings?.meeting?.status ??
      mineMeeting.data?.meetings?.upcoming?.[0]?.status ??
      mineMeeting.data
  );

  const myPdp = await get("/pdps/mine", emp);
  console.log("EMP901 pdp", myPdp.status, myPdp.data?.pdp?.status, myPdp.data?.pdp?.title);

  const emp2 = await login("EMP000902");
  const myPdp2 = await get("/pdps/mine", emp2);
  console.log("EMP902 pdp", myPdp2.status, myPdp2.data?.pdp?.status);

  const hr = await login("HR000001");
  const hrBoard = await get("/pdps?page=1&pageSize=5", hr);
  console.log("HR board", hrBoard.status, hrBoard.data?.board?.kpis);

  // Scheduled notes save test — find a scheduled meeting for supervisor
  const planning = await get("/meetings/planning?page=1&pageSize=20", sup);
  const scheduled = planning.data?.board?.items?.find(
    (row: { meeting?: { status?: string; id?: string } }) => row.meeting?.status === "SCHEDULED"
  );
  console.log("Scheduled sample", scheduled?.meeting?.id, scheduled?.employee?.employeeId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
