import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword, verifyPassword } from "../src/utils/password.js";
import {
  createForgotPasswordRequest,
  loginUser,
  setPermanentPassword,
} from "../src/services/auth.service.js";
import { getDashboardForUser } from "../src/services/dashboard.service.js";

const accounts: Array<{ employeeId: string; role: string }> = [
  { employeeId: "EMP000001", role: "EMPLOYEE" },
  { employeeId: "EMP000901", role: "EMPLOYEE" },
  { employeeId: "EMP000902", role: "EMPLOYEE" },
  { employeeId: "EMP000903", role: "EMPLOYEE" },
  { employeeId: "EMP000904", role: "EMPLOYEE" },
  { employeeId: "SUP000001", role: "SUPERVISOR" },
  { employeeId: "HR000001", role: "HR" },
  { employeeId: "HR000002", role: "HR" },
  { employeeId: "HRM000001", role: "HR_MANAGER" },
  { employeeId: "LED000001", role: "LEADERSHIP" },
];

try {
  for (const account of accounts) {
    const employee = await prisma.employee.findUnique({
      where: { employeeId: account.employeeId },
    });
    if (!employee) throw new Error(`Missing employee ${account.employeeId}`);
    if (employee.role !== account.role) {
      throw new Error(
        `Unexpected role for ${account.employeeId}: ${employee.role}`
      );
    }
    const good = await verifyPassword("DevTest@2026", employee.passwordHash);
    const bad = await verifyPassword("WrongPassword!", employee.passwordHash);
    if (!good || bad) {
      throw new Error(`Password hash check failed for ${account.employeeId}`);
    }
    const login = await loginUser(account.employeeId, "DevTest@2026");
    console.log("LOGIN_OK", login.user.employeeId, login.user.role, login.user.name);
    try {
      const dashboard = await getDashboardForUser(employee.id);
      console.log("DASH_OK", dashboard.role);
    } catch (error) {
      console.log(
        "DASH_SKIP",
        account.employeeId,
        error instanceof Error ? error.message.split("\n")[0] : error
      );
    }
  }

  await loginUser("EMP000001", "WrongPassword!").then(
    () => {
      throw new Error("Incorrect password was accepted");
    },
    (error: { code?: string; statusCode?: number }) => {
      console.log("REJECT_BAD_PASSWORD", error.code, error.statusCode);
    }
  );

  await loginUser("NOPE999", "DevTest@2026").then(
    () => {
      throw new Error("Unknown employee was accepted");
    },
    (error: { code?: string; statusCode?: number }) => {
      console.log("REJECT_UNKNOWN", error.code, error.statusCode);
    }
  );

  await createForgotPasswordRequest("NOPE999").then(
    () => {
      throw new Error("Unknown employee received a one-time password");
    },
    (error: { code?: string; statusCode?: number }) => {
      console.log("REJECT_FORGOT_UNKNOWN", error.code, error.statusCode);
    }
  );

  const otpAccount = "EMP000904";
  const forgot = await createForgotPasswordRequest(otpAccount);
  if (!forgot.oneTimePassword) {
    throw new Error("Forgot-password did not return a one-time password");
  }
  console.log("OTP_ISSUED", otpAccount);

  const otpLogin = await loginUser(otpAccount, forgot.oneTimePassword);
  if (!otpLogin.user.mustChangePassword) {
    throw new Error("OTP login did not require a permanent password change");
  }
  console.log("OTP_LOGIN_OK", otpAccount);

  const changed = await setPermanentPassword(
    otpLogin.user.id,
    "PermTest@2026"
  );
  if (changed.user.mustChangePassword) {
    throw new Error("mustChangePassword remained true after password change");
  }
  console.log("PERM_PASSWORD_SET", otpAccount);

  await loginUser(otpAccount, forgot.oneTimePassword).then(
    () => {
      throw new Error("One-time password remained valid after permanent change");
    },
    (error: { code?: string; statusCode?: number }) => {
      console.log("REJECT_REUSED_OTP", error.code, error.statusCode);
    }
  );

  await loginUser(otpAccount, "PermTest@2026");
  console.log("NEW_PERM_LOGIN_OK", otpAccount);

  await prisma.employee.update({
    where: { employeeId: otpAccount },
    data: {
      passwordHash: await hashPassword("DevTest@2026"),
      mustChangePassword: false,
      oneTimePasswordHash: null,
      oneTimePasswordExpiresAt: null,
    },
  });
  console.log("OTP_ACCOUNT_RESTORED", otpAccount);

  console.log("ALL_CHECKS_PASSED");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
