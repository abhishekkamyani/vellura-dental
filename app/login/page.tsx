import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { requireAdmin } from "@/auth";
import { Wordmark } from "@/components/site/site-header";
import { getUnsplashImage } from "@/lib/unsplash";

export const metadata: Metadata = { title: "Staff sign in — Vellura Dental" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === "string" ? callbackUrl : "/admin";

  if (await requireAdmin()) redirect("/admin");

  const image = await getUnsplashImage("modern clean interior architecture", 1600);

  return (
    <main className="grid min-h-dvh flex-1 bg-white lg:grid-cols-2">
      <section className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-vellura-cyan"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to site
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <p className="eyebrow">Staff access</p>
          <h1 className="mt-3 text-4xl font-light text-vellura-ink">Welcome back</h1>
          <p className="mt-3 mb-9 text-sm leading-7 tracking-wide text-muted-foreground">
            Sign in to view and manage the clinic&apos;s bookings.
          </p>
          <LoginForm callbackUrl={target} />
          <p className="mt-8 flex items-center gap-2 text-xs tracking-wide text-muted-foreground">
            <ShieldCheck className="size-4 text-vellura-cyan" aria-hidden />
            Protected area. Access is restricted to clinic staff.
          </p>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-vellura-mist lg:block">
        <Image src={image} alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-cyan-900/60 via-cyan-900/10 to-white/10" />
        <blockquote className="absolute inset-x-12 bottom-12 text-white">
          <p className="text-2xl leading-snug font-light text-balance">
            Every appointment, arranged with quiet precision.
          </p>
          <footer className="mt-4 text-[0.7rem] font-semibold tracking-luxe uppercase text-white/80">Vellura Dental</footer>
        </blockquote>
      </section>
    </main>
  );
}
