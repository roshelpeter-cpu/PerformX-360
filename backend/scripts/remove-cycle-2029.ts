import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const cycles = await prisma.appraisalCycle.findMany({
  where: {
    OR: [
      { name: { contains: "2029" } },
      {
        startDate: {
          gte: new Date("2029-01-01T00:00:00.000Z"),
          lt: new Date("2030-01-01T00:00:00.000Z"),
        },
      },
    ],
  },
  select: { id: true, name: true, status: true },
});

if (cycles.length === 0) {
  console.log("No Annual Appraisal 2029 cycle found.");
} else {
  for (const cycle of cycles) {
    await prisma.$transaction(async (tx) => {
      await tx.meeting.deleteMany({ where: { cycleId: cycle.id } });
      await tx.appraisalCycle.delete({ where: { id: cycle.id } });
    });
    console.log(`Removed appraisal cycle ${cycle.name} (${cycle.status}).`);
  }
}

await prisma.$disconnect();
