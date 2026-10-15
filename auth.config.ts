import type { NextAuthConfig } from "next-auth";

/**
 * Settings shared by the full auth setup (auth.ts) and the route proxy (proxy.ts).
 * Kept free of database imports so the proxy only has to verify the session token.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  providers: [],
  callbacks: {
    /** Used by the proxy: only signed-in admins may pass. Others are sent to /login. */
    authorized({ auth }) {
      return auth?.user?.role === "ADMIN";
    },
    jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = typeof token.role === "string" ? token.role : "";
      return session;
    },
  },
} satisfies NextAuthConfig;
