import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";

// Reuse a single PrismaClient and pg pool across hot reloads in development.

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function createPrismaClient(): PrismaClient {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Set it in backend/.env before starting the server."
    );
  }

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: env.databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });

  globalForPrisma.pgPool = pool;

  return new PrismaClient({
    adapter: new PrismaPg(pool),
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}