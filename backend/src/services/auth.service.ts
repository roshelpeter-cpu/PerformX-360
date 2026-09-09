import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { AppError } from "../utils/errors.js";
import {
  generateOneTimePassword,
  generateSecurePassword,
  hashPassword,
  verifyPassword,
} from "../utils/password.js";
import type { AuthenticatedUser, LoginResult } from "../types/auth.js";
import {
  assertNotAuthLocked,
  clearUnauthorizedAttempts,
  recordUnauthorizedAccessAttempt,
} from "./security.service.js";
import { createNotification } from "./notification.service.js";
import { sendPasswordResetEmail } from "./email.service.js";

const ONE_TIME_PASSWORD_TTL_MS = 15 * 60 * 1000;

function mapEmployee(employee: {
  id: string;
  employeeId: string;
  name: string;
  role: AuthenticatedUser["role"];
  companyEmail: string;
  department: { name: string } | null;
  mustChangePassword: boolean;
}): AuthenticatedUser {
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    role: employee.role,
    companyEmail: employee.companyEmail,
    department: employee.department?.name ?? null,
    mustChangePassword: employee.mustChangePassword,
  };
}

function signUserToken(employee: {
  id: string;
  employeeId: string;
  role: AuthenticatedUser["role"];
}) {
  return signToken({
    sub: employee.id,
    employeeId: employee.employeeId,
    role: employee.role,
  });
}

export async function loginUser(
  employeeId: string,
  password: string
): Promise<LoginResult> {
  const employee = await prisma.employee.findUnique({
    where: { employeeId },
    include: { department: true },
  });

  if (!employee) {
    throw new AppError("Employee ID not found.", 404, "EMPLOYEE_NOT_FOUND");
  }

  await assertNotAuthLocked(employee.id);

  const passwordValid = await verifyPassword(password, employee.passwordHash);
  let usedOneTimePassword = false;

  if (!passwordValid) {
    usedOneTimePassword = await isValidOneTimePassword(employee, password);
    if (!usedOneTimePassword) {
      await prisma.securityEvent.create({
        data: {
          employeeId: employee.id,
          type: "LOGIN_FAILED",
          description: "Incorrect password during login attempt",
        },
      });
      throw new AppError("Incorrect password.", 401, "INCORRECT_PASSWORD");
    }
  }

  // Successful login clears prior unauthorized-route attempt counters.
  await clearUnauthorizedAttempts(employee.id);

  let mustChangePassword =
    employee.mustChangePassword || usedOneTimePassword;

  // One-time passwords are single-use at login. Permanent password creation
  // remains required until setPermanentPassword clears the flag.
  if (usedOneTimePassword) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        mustChangePassword: true,
        oneTimePasswordHash: null,
        oneTimePasswordExpiresAt: null,
      },
    });
    mustChangePassword = true;
  }

  const user = mapEmployee({
    ...employee,
    mustChangePassword,
  });
  const token = signUserToken(employee);

  return { user, token };
}

async function isValidOneTimePassword(
  employee: {
    id: string;
    oneTimePasswordHash: string | null;
    oneTimePasswordExpiresAt: Date | null;
  },
  password: string
): Promise<boolean> {
  if (!employee.oneTimePasswordHash) {
    return false;
  }

  if (
    !employee.oneTimePasswordExpiresAt ||
    employee.oneTimePasswordExpiresAt.getTime() <= Date.now()
  ) {
    return false;
  }

  return verifyPassword(password, employee.oneTimePasswordHash);
}

export async function getCurrentUser(userId: string): Promise<AuthenticatedUser> {
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    include: { department: true },
  });

  if (!employee) {
    throw new AppError("Authentication required", 401);
  }

  return mapEmployee(employee);
}

export async function createForgotPasswordRequest(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { employeeId },
  });

  if (!employee) {
    throw new AppError("Employee ID not found.", 404, "EMPLOYEE_NOT_FOUND");
  }

  const oneTimePassword = generateOneTimePassword();
  const oneTimePasswordHash = await hashPassword(oneTimePassword);
  const oneTimePasswordExpiresAt = new Date(
    Date.now() + ONE_TIME_PASSWORD_TTL_MS
  );

  await prisma.$transaction([
    prisma.employee.update({
      where: { id: employee.id },
      data: {
        oneTimePasswordHash,
        oneTimePasswordExpiresAt,
      },
    }),
    prisma.passwordResetRequest.create({
      data: {
        employeeId: employee.id,
        status: "PENDING",
      },
    }),
    prisma.securityEvent.create({
      data: {
        employeeId: employee.id,
        type: "PASSWORD_RESET",
        description: "One-time password generated for forgot-password flow",
      },
    }),
  ]);

  return {
    created: true,
    oneTimePassword,
    expiresAt: oneTimePasswordExpiresAt.toISOString(),
  };
}

export async function setPermanentPassword(
  userId: string,
  newPassword: string
) {
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
  });

  if (!employee) {
    throw new AppError("Authentication required", 401);
  }

  if (!employee.mustChangePassword) {
    throw new AppError(
      "A password change is not required for this account.",
      400,
      "PASSWORD_CHANGE_NOT_REQUIRED"
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.employee.update({
      where: { id: employee.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        oneTimePasswordHash: null,
        oneTimePasswordExpiresAt: null,
      },
    }),
    prisma.passwordResetRequest.updateMany({
      where: {
        employeeId: employee.id,
        status: "PENDING",
      },
      data: {
        status: "HANDLED",
        handledAt: new Date(),
      },
    }),
    prisma.securityEvent.create({
      data: {
        employeeId: employee.id,
        type: "PASSWORD_RESET",
        description: "Permanent password set after one-time password login",
      },
    }),
  ]);

  const updated = await prisma.employee.findUniqueOrThrow({
    where: { id: employee.id },
    include: { department: true },
  });

  return {
    user: mapEmployee(updated),
    token: signUserToken(updated),
  };
}

export async function hrResetEmployeePassword(targetEmployeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { employeeId: targetEmployeeId },
  });

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  const plainPassword = generateSecurePassword();
  const passwordHash = await hashPassword(plainPassword);

  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      oneTimePasswordHash: null,
      oneTimePasswordExpiresAt: null,
    },
  });

  await prisma.passwordResetRequest.updateMany({
    where: {
      employeeId: employee.id,
      status: "PENDING",
    },
    data: {
      status: "HANDLED",
      handledAt: new Date(),
    },
  });

  await prisma.securityEvent.create({
    data: {
      employeeId: employee.id,
      type: "PASSWORD_RESET",
      description: "Password reset performed by HR",
    },
  });

  const emailResult = await sendPasswordResetEmail({
    to: employee.companyEmail,
    employeeName: employee.name,
    employeeId: employee.employeeId,
    newPassword: plainPassword,
  });

  await createNotification({
    type: "PASSWORD_RESET_COMPLETE",
    title: "Password Reset Completed",
    message: `Password reset completed for ${employee.name} (${employee.employeeId}).`,
    subjectEmployeeId: employee.id,
    metadata: {
      employeeId: employee.employeeId,
      emailSent: emailResult.sent,
    },
  });

  // Plaintext password exists only in memory during this response cycle — never stored in PostgreSQL.
  return {
    employeeId: employee.employeeId,
    emailSent: emailResult.sent,
    emailReason: emailResult.reason,
  };
}

export async function reportUnauthorizedRouteAccess(params: {
  employeeDbId: string;
  employeePublicId: string;
  employeeName: string;
  attemptedRoute: string;
}) {
  return recordUnauthorizedAccessAttempt(params);
}

export async function extendUserSession(userId: string): Promise<LoginResult> {
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    include: { department: true },
  });

  if (!employee) {
    throw new AppError("Authentication required", 401);
  }

  const user = mapEmployee(employee);
  const token = signUserToken(employee);

  return { user, token };
}
