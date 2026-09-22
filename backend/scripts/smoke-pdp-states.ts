import "dotenv/config";

const base = "http://localhost:5001/api";

async function login(employeeId: string) {
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, password: "DevTest@2026" }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!res.ok) throw new Error(`login failed ${employeeId}`);
  return cookie;
}

async function get(path: string, cookie: string) {
  const res = await fetch(`${base}${path}`, { headers: { Cookie: cookie } });
  return { status: res.status, data: await res.json() };
}

async function main() {
  const emp901 = await login("EMP000901");
  const m901 = await get("/meetings/planning/mine", emp901);
  const p901 = await get("/pdps/mine", emp901);
  console.log("EMP901 meeting", m901.data?.meetings?.meeting?.status);
  console.log("EMP901 pdp", p901.data?.pdp?.status, "goals", p901.data?.pdp?.currentVersion?.goals?.length, "subs", p901.data?.pdp?.currentVersion?.goals?.[0]?.subGoals?.length);

  const emp902 = await login("EMP000902");
  const p902 = await get("/pdps/mine", emp902);
  console.log("EMP902 pdp", p902.data?.pdp?.status, "canActivate", p902.data?.pdp?.permissions?.canActivate);

  const emp903 = await login("EMP000903");
  const p903 = await get("/pdps/mine", emp903);
  console.log("EMP903 pdp", p903.data?.pdp?.status);

  const emp904 = await login("EMP000904");
  const p904 = await get("/pdps/mine", emp904);
  console.log("EMP904 pdp", p904.data?.pdp?.status);

  const hr = await login("HR000001");
  for (const cat of ["DRAFT", "WAITING_EMPLOYEE", "WAITING_HR", "APPROVED", "COMPLETED", "CHANGES_REQUESTED"]) {
    const board = await get(`/pdps?category=${cat}&pageSize=20`, hr);
    console.log("HR", cat, "count", board.data?.board?.pagination?.total, "kpis", board.data?.board?.kpis?.totalPdps);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
