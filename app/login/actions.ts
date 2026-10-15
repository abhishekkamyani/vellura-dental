"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string };

/**
 * Reduces the requested destination to a path inside /admin, whatever was supplied,
 * so the login form cannot be used as an open redirect.
 */
function safeRedirect(target: FormDataEntryValue | null) {
  try {
    const url = new URL(typeof target === "string" ? target : "", "http://internal");
    const path = url.pathname + url.search;
    return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin?") ? path : "/admin";
  } catch {
    return "/admin";
  }
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password." };

  const ip = clientIp(await headers());
  const limit = rateLimit(`login:${ip}:${email}`, 8, 10 * 60_000);
  if (!limit.allowed) {
    return { error: `Too many attempts. Please try again in ${Math.ceil(limit.retryAfterSec / 60)} minute(s).` };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: safeRedirect(formData.get("callbackUrl")) });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: "The email or password is incorrect." };
    throw error; // Successful sign-in redirects by throwing; let Next.js handle it.
  }
}
