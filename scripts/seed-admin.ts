import "dotenv/config";
import dns from "node:dns";
import net from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";

// No working IPv6 route here; avoid hanging on Neon's IPv6 addresses (see lib/prisma.ts).
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@velluradental.com").trim().toLowerCase();
  const plainPassword = process.env.ADMIN_PASSWORD || "password123";
  const password = await hash(plainPassword, 12);

  await prisma.user.upsert({
    where: { email },
    update: { password, role: "ADMIN" },
    create: { email, name: "Vellura Admin", password, role: "ADMIN" },
  });

  console.log(`Admin account ready: ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("Using the default password. Set ADMIN_PASSWORD and re-run this script before going live.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
