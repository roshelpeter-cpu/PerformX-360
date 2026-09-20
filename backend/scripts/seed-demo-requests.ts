import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import {
  seedDemoProfileChangeRequests,
  seedNamedHrManager,
} from "../prisma/seed-profile-requests.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

await seedNamedHrManager(prisma);
const result = await seedDemoProfileChangeRequests(prisma);
console.log(
  `Updated HR Manager identity. Profile change requests created: ${result.created} (skipped existing: ${result.skipped}).`
);
await prisma.$disconnect();
