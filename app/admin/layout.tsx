import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/admin/actions";
import { requireAdmin } from "@/auth";
import { Wordmark } from "@/components/site/site-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Defence in depth: the proxy already redirects, but never render admin pages without a session.
  const session = await requireAdmin();
  if (!session) redirect("/login");

  const email = session.user.email ?? "";

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-vellura-mist">
      <header className="sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden rounded-full bg-sky-50 px-2.5 py-1 text-[0.6rem] font-semibold tracking-[0.18em] text-vellura-deep uppercase ring-1 ring-sky-100 sm:inline">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-vellura-cyan md:flex"
            >
              View site
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <div className="flex items-center gap-2.5 border-border md:border-l md:pl-4">
              <Avatar size="default" className="after:hidden">
                <AvatarFallback className="bg-linear-to-br from-vellura-sky to-vellura-cyan text-xs font-semibold text-white">
                  {email.slice(0, 1).toUpperCase() || "A"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 sm:block">
                <p className="text-[0.6rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Signed in as</p>
                <p className="max-w-52 truncate text-sm tracking-wide text-vellura-ink" data-testid="admin-email">{email}</p>
              </div>
            </div>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="h-9 rounded-full border-border px-3.5 text-xs tracking-[0.12em] text-vellura-cyan uppercase hover:bg-sky-50 hover:text-vellura-deep"
              >
                <LogOut aria-hidden />
                <span className="max-[400px]:sr-only">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
