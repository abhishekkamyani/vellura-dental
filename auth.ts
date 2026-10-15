import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

// Compared against when no account matches, so response time does not reveal which emails exist.
const DUMMY_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8.yHdbJ6mF0Wn1nZxQ1wqXv5m6yq8K";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password || password.length > 200) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await compare(password, user?.password ?? DUMMY_HASH);
        if (!user || !user.password || !valid || user.role !== "ADMIN") return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});

/** For server actions and pages: returns the session only if it belongs to an admin. */
export async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN" ? session : null;
}
