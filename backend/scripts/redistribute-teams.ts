import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { redistributeOrgTeams } from "../prisma/org-teams.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const result = await redistributeOrgTeams(prisma);
console.log(
  `Redistributed teams: ${result.teamCount} teams across ${result.hrCount} HR staff (~10 employees per team).`
);
await prisma.$disconnect();
