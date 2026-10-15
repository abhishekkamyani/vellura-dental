import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 names this file `proxy.ts` (formerly `middleware.ts`).
// Unauthenticated requests to /admin are redirected to /login by the `authorized` callback.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin/:path*"],
};
