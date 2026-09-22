import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { seedPdps } from "../prisma/seed-pdps.js";
import { seedPlanningMeetings } from "../prisma/seed-planning-meetings.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  await seedPlanningMeetings(prisma);
  await seedPdps(prisma);
  console.log("Re-seeded planning meetings + PDPs");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
