import Link from "next/link";
import { MobileMenu } from "@/components/site/mobile-menu";
import { OpenChatButton } from "@/components/site/open-chat-button";

const LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#experience", label: "Experience" },
  { href: "/#faq", label: "FAQ" },
];

export function Wordmark() {
  return (
    <Link href="/" className="flex items-baseline gap-2 text-vellura-ink">
      <span className="text-lg font-semibold uppercase tracking-luxe">Vellura</span>
      <span className="text-[0.65rem] font-medium uppercase tracking-luxe text-vellura-cyan">Dental</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-vellura-cyan">
              {link.label}
            </Link>
          ))}
        </nav>
        <OpenChatButton className="hidden h-9 rounded-full px-5 text-xs uppercase tracking-[0.16em] shadow-soft hover:bg-vellura-deep md:inline-flex">
          Book a visit
        </OpenChatButton>
        <MobileMenu links={LINKS} />
      </div>
    </header>
  );
}
