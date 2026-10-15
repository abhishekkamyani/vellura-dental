import dns from "node:dns";
import net from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

// This runtime has no working IPv6 route. Node's family auto-selection can
// hang while racing Neon IPv6 addresses, so use IPv4 for outbound connections.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development.
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
