import { prisma } from "../lib/prisma.js";
import type { NotificationType, Prisma } from "../../generated/prisma/client.js";

export async function createNotification(params: {
  type: NotificationType;
  title: string;
  message: string;
  recipientId?: string;
  subjectEmployeeId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      type: params.type,
      title: params.title,
      message: params.message,
      ...(params.recipientId ? { recipientId: params.recipientId } : {}),
      ...(params.subjectEmployeeId
        ? { subjectEmployeeId: params.subjectEmployeeId }
        : {}),
      ...(params.metadata
        ? { metadata: params.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });
}

export async function notifyAllHrUsers(params: {
  type: NotificationType;
  title: string;
  message: string;
  subjectEmployeeId?: string;
  metadata?: Record<string, unknown>;
}) {
  const hrUsers = await prisma.employee.findMany({
    where: { role: { in: ["HR", "HR_MANAGER"] } },
    select: { id: true },
  });

  if (hrUsers.length === 0) {
    // Store a general notification without a specific recipient if no HR users exist yet.
    return createNotification({
      type: params.type,
      title: params.title,
      message: params.message,
      ...(params.subjectEmployeeId
        ? { subjectEmployeeId: params.subjectEmployeeId }
        : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
  }

  return prisma.$transaction(
    hrUsers.map((hr) =>
      prisma.notification.create({
        data: {
          type: params.type,
          title: params.title,
          message: params.message,
          recipientId: hr.id,
          ...(params.subjectEmployeeId
            ? { subjectEmployeeId: params.subjectEmployeeId }
            : {}),
          ...(params.metadata
            ? { metadata: params.metadata as Prisma.InputJsonValue }
            : {}),
        },
      })
    )
  );
}

export async function getHrNotifications(limit = 20) {
  return prisma.notification.findMany({
    where: {
      OR: [
        { recipient: { role: { in: ["HR", "HR_MANAGER"] } } },
        { recipientId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      subjectEmployee: {
        select: {
          employeeId: true,
          name: true,
        },
      },
    },
  });
}
export async function getNotificationsForUser(
  userId: string,
  limit = 50
) {
  return prisma.notification.findMany({
    where: {
      OR: [
        { recipientId: userId },
        { recipientId: null },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    include: {
      subjectEmployee: {
        select: {
          employeeId: true,
          name: true,
        },
      },
    },
  });
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: {
      OR: [
        { recipientId: userId },
        { recipientId: null },
      ],
      status: "UNREAD",
    },
  });
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      OR: [
        { recipientId: userId },
        { recipientId: null },
      ],
    },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  return prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      status: "READ",
    },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      OR: [
        { recipientId: userId },
        { recipientId: null },
      ],
      status: "UNREAD",
    },
    data: {
      status: "READ",
    },
  });
}