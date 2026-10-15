"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OPEN_CHAT_EVENT } from "@/components/site/open-chat-button";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-10 items-center justify-center rounded-full text-vellura-ink outline-none hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-16 border-b border-border bg-white px-6 pt-2 pb-6 shadow-float"
          >
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href} className="border-b border-border/70">
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block py-4 text-sm font-medium tracking-[0.18em] text-vellura-ink uppercase"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
              }}
              className="mt-5 h-12 w-full rounded-full bg-vellura-cyan text-sm font-medium tracking-[0.14em] text-white uppercase shadow-soft"
            >
              Book a visit
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
