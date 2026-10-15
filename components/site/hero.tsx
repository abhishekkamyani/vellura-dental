"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { OpenChatButton } from "@/components/site/open-chat-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.2 } },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease } },
};

export function Hero({ imageUrl }: { imageUrl: string }) {
  return (
    <section className="relative isolate flex min-h-[min(92svh,60rem)] items-center overflow-hidden bg-vellura-mist pt-16">
      <motion.div
        className="absolute inset-0 -z-10"
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease }}
      >
        <Image src={imageUrl} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-linear-to-r from-white via-white/90 to-white/30 max-md:via-white/95 max-md:to-white/75" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-white to-transparent" />
      </motion.div>

      <motion.div
        className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 sm:py-24"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.p variants={item} className="eyebrow flex items-center gap-2">
          <Sparkles className="size-3.5 text-vellura-sky" aria-hidden />
          Luxury dentistry, reimagined
        </motion.p>

        <motion.h1
          variants={item}
          className="mt-6 max-w-2xl text-[2.6rem] leading-[1.08] font-light text-balance text-vellura-ink sm:text-6xl lg:text-7xl"
        >
          A smile, crafted with <span className="font-medium text-vellura-cyan">quiet precision</span>.
        </motion.h1>

        <motion.p variants={item} className="mt-7 max-w-lg text-base leading-8 tracking-wide text-muted-foreground">
          Unhurried appointments, serene surroundings and exacting clinical care. Tell our
          concierge when you would like to visit, and consider it arranged.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <OpenChatButton className="group h-12 rounded-full px-5 text-xs tracking-[0.1em] uppercase shadow-float hover:bg-vellura-deep min-[400px]:px-7 min-[400px]:text-sm min-[400px]:tracking-[0.12em]">
            Book with our concierge
            <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </OpenChatButton>
          <a
            href="#services"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-12 rounded-full border-vellura-cyan/25 bg-white/70 px-7 text-sm tracking-[0.12em] text-vellura-cyan uppercase backdrop-blur hover:bg-white hover:text-vellura-deep",
            )}
          >
            Explore services
          </a>
        </motion.div>

        <motion.dl variants={item} className="mt-12 grid grid-cols-1 gap-x-12 gap-y-5 min-[420px]:grid-cols-2 sm:mt-16 sm:flex sm:flex-wrap">
          {[
            ["Mon – Sat", "9:00 AM – 6:00 PM"],
            ["Private suites", "One patient at a time"],
            ["Concierge", "Booked in moments"],
          ].map(([term, detail]) => (
            <div key={term} className="border-l border-vellura-sky/60 pl-4">
              <dt className="text-[0.65rem] font-semibold tracking-luxe text-vellura-cyan uppercase">{term}</dt>
              <dd className="mt-1 text-sm tracking-wide text-vellura-ink">{detail}</dd>
            </div>
          ))}
        </motion.dl>
      </motion.div>
    </section>
  );
}
