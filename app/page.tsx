import { CalendarCheck, ChevronDown, Clock, Gem, MessageCircle, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Hero } from "@/components/site/hero";
import { OpenChatButton } from "@/components/site/open-chat-button";
import { Reveal } from "@/components/site/reveal";
import { SiteHeader, Wordmark } from "@/components/site/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { CLINIC } from "@/lib/clinic";
import { prisma } from "@/lib/prisma";
import { getUnsplashImage } from "@/lib/unsplash";

const DESCRIPTIONS: Record<string, string> = {
  "Vellura Signature Cleaning":
    "A meticulous, unhurried hygiene ritual that leaves your smile polished, fresh and luminous.",
  "Laser Whitening":
    "Advanced laser brightening for a naturally radiant shade, completed in a single serene visit.",
  "Veneer Consultation":
    "A private design session to explore bespoke porcelain veneers shaped to your features.",
};

const EXPERIENCE = [
  { icon: Gem, title: "Bespoke care", text: "Every treatment plan is composed around you, never a template." },
  { icon: Clock, title: "Your time, respected", text: "Private suites and punctual appointments, with no waiting room." },
  { icon: ShieldCheck, title: "Clinical excellence", text: "Leading technology in the hands of meticulous specialists." },
];

const STEPS = [
  { icon: MessageCircle, title: "Tell us what you need", text: "Open the concierge and say which treatment you would like, in your own words." },
  { icon: CalendarCheck, title: "Choose a time", text: "See the clinic's live availability and tap the time that suits you." },
  { icon: UserRound, title: "Consider it arranged", text: "Share your name and number, confirm, and your appointment is reserved instantly." },
];

const FAQ = [
  { q: "How do I book an appointment?", a: "Open the concierge chat, choose your treatment and a time, then confirm your name and phone number. Your appointment is reserved the moment you confirm." },
  { q: "When is the clinic open?", a: `We welcome patients ${CLINIC.hoursLabel}. The concierge can take your booking at any hour.` },
  { q: "Can I change or cancel my appointment?", a: "Of course. Call the clinic with your booking reference and our team will rearrange or cancel it for you." },
  { q: "Will the concierge give medical advice?", a: "No. The concierge arranges visits and answers general questions. Clinical questions are discussed with your dentist during your appointment." },
];

async function getServices() {
  try {
    return await prisma.service.findMany({ orderBy: { durationMin: "asc" } });
  } catch (error) {
    console.error("Could not load services", error);
    return [];
  }
}

export default async function Home() {
  await connection();

  const [services, heroImage] = await Promise.all([
    getServices(),
    getUnsplashImage("modern clean interior architecture", 2000),
  ]);
  const images = await Promise.all(services.map((service) => getUnsplashImage(service.imageQuery, 900)));

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero imageUrl={heroImage} />

        <section id="services" className="scroll-mt-16 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Reveal className="max-w-xl">
              <p className="eyebrow">Signature services</p>
              <h2 className="mt-4 text-3xl sm:text-4xl leading-tight font-light text-vellura-ink">
                Considered treatments, <span className="font-medium text-vellura-cyan">exquisitely delivered</span>
              </h2>
            </Reveal>

            {services.length === 0 ? (
              <p className="mt-14 rounded-2xl border border-border bg-vellura-mist p-8 text-sm tracking-wide text-muted-foreground">
                Our service menu is being prepared. Please check back shortly.
              </p>
            ) : (
              <div className="mt-10 grid gap-6 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
                {services.map((service, index) => (
                  <Reveal key={service.id} delay={index * 0.12}>
                    <Card className="group h-full gap-0 rounded-3xl py-0 shadow-soft ring-border transition-all duration-500 hover:-translate-y-1.5 hover:shadow-float">
                      <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[4/3]">
                        <Image
                          src={images[index]}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-white/50 to-transparent" />
                      </div>
                      <CardContent className="flex flex-1 flex-col p-6 sm:p-7">
                        <p className="eyebrow">{service.durationMin} minutes</p>
                        <h3 className="mt-3 text-xl font-medium tracking-wide text-vellura-ink">{service.name}</h3>
                        <p className="mt-3 flex-1 text-sm leading-7 tracking-wide text-muted-foreground">
                          {DESCRIPTIONS[service.name] ?? "A signature Vellura treatment, delivered with exacting care."}
                        </p>
                        <OpenChatButton
                          variant="link"
                          className="mt-6 h-auto justify-start p-0 text-xs tracking-[0.18em] text-vellura-cyan uppercase hover:text-vellura-deep"
                        >
                          Reserve this treatment
                        </OpenChatButton>
                      </CardContent>
                    </Card>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16 border-t border-border bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Reveal className="mx-auto max-w-xl text-center">
              <p className="eyebrow">How it works</p>
              <h2 className="mt-4 text-3xl leading-tight font-light text-vellura-ink sm:text-4xl">
                Booked in <span className="font-medium text-vellura-cyan">three graceful steps</span>
              </h2>
            </Reveal>
            <ol className="mt-12 grid gap-6 md:grid-cols-3 md:gap-7">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <Reveal key={title} delay={index * 0.12}>
                  <li className="relative h-full rounded-3xl border border-border bg-vellura-mist p-7">
                    <span className="absolute top-6 right-7 text-5xl font-light text-vellura-sky/40 tabular-nums" aria-hidden>
                      0{index + 1}
                    </span>
                    <span className="flex size-12 items-center justify-center rounded-full bg-white text-vellura-cyan shadow-soft ring-1 ring-sky-100">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-6 text-base font-semibold tracking-wide text-vellura-ink">{title}</h3>
                    <p className="mt-2 text-sm leading-7 tracking-wide text-muted-foreground">{text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="experience" className="scroll-mt-16 border-y border-border bg-vellura-mist py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-14">
            <Reveal className="min-w-0">
              <p className="eyebrow">The Vellura experience</p>
              <h2 className="mt-4 text-3xl leading-tight font-light text-vellura-ink sm:text-4xl">
                Calm, from the first <span className="font-medium text-vellura-cyan">hello</span>
              </h2>
              <p className="mt-6 max-w-md text-sm leading-8 tracking-wide text-muted-foreground">
                Our concierge is on hand at any hour to find a time that suits you. We are open {CLINIC.hoursLabel}.
              </p>
              <OpenChatButton className="mt-9 h-12 w-full rounded-full px-5 text-xs tracking-[0.1em] uppercase shadow-soft hover:bg-vellura-deep min-[400px]:w-auto min-[400px]:px-7 min-[400px]:text-sm min-[400px]:tracking-[0.12em]">
                <Sparkles aria-hidden />
                Speak with the concierge
              </OpenChatButton>
            </Reveal>

            <div className="grid gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-1">
              {EXPERIENCE.map(({ icon: Icon, title, text }, index) => (
                <Reveal key={title} delay={index * 0.1}>
                  <div className="flex h-full gap-5 rounded-2xl border border-border bg-white p-6 shadow-soft md:flex-col lg:flex-row">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-vellura-cyan ring-1 ring-sky-100">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold tracking-[0.14em] text-vellura-ink uppercase">{title}</h3>
                      <p className="mt-2 text-sm leading-7 tracking-wide text-muted-foreground">{text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-16 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-5 sm:px-6">
            <Reveal className="text-center">
              <p className="eyebrow">Questions</p>
              <h2 className="mt-4 text-3xl leading-tight font-light text-vellura-ink sm:text-4xl">Good to know</h2>
            </Reveal>
            <Reveal delay={0.1} className="mt-10 divide-y divide-border rounded-3xl border border-border bg-white shadow-soft">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-6 py-1 sm:px-7">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-5 text-sm font-medium tracking-wide text-vellura-ink outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-base [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-4 shrink-0 text-vellura-cyan transition-transform duration-300 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="pb-6 text-sm leading-7 tracking-wide text-muted-foreground">{a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="bg-white px-5 pb-20 sm:px-6 sm:pb-28">
          <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-linear-to-br from-vellura-cyan to-vellura-deep px-6 py-14 text-center text-white shadow-float sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-vellura-sky/40 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full bg-white/15 blur-3xl" aria-hidden />
            <p className="relative text-[0.7rem] font-semibold tracking-luxe text-white/80 uppercase">Your visit awaits</p>
            <h2 className="relative mx-auto mt-4 max-w-xl text-3xl leading-tight font-light text-balance sm:text-4xl">
              Reserve your appointment in under a minute
            </h2>
            <OpenChatButton className="relative mt-9 h-12 rounded-full bg-white px-8 text-sm tracking-[0.12em] text-vellura-cyan uppercase shadow-soft hover:bg-sky-50 hover:text-vellura-deep">
              <Sparkles aria-hidden />
              Start booking
            </OpenChatButton>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border bg-vellura-mist">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-7 tracking-wide text-muted-foreground">
              Luxury dentistry delivered with quiet precision, in serene private suites.
            </p>
          </div>
          <div>
            <h3 className="text-[0.7rem] font-semibold tracking-luxe text-vellura-ink uppercase">Hours</h3>
            <p className="mt-4 text-sm leading-7 tracking-wide text-muted-foreground">
              Monday to Saturday
              <br />
              9:00 AM – 6:00 PM
              <br />
              Closed Sunday
            </p>
          </div>
          <div>
            <h3 className="text-[0.7rem] font-semibold tracking-luxe text-vellura-ink uppercase">Explore</h3>
            <ul className="mt-4 space-y-2 text-sm tracking-wide text-muted-foreground">
              <li><Link href="/#services" className="transition-colors hover:text-vellura-cyan">Services</Link></li>
              <li><Link href="/#how-it-works" className="transition-colors hover:text-vellura-cyan">How it works</Link></li>
              <li><Link href="/#faq" className="transition-colors hover:text-vellura-cyan">FAQ</Link></li>
              <li><Link href="/login" className="transition-colors hover:text-vellura-cyan">Staff sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-5 py-6 pr-20 text-xs tracking-[0.14em] text-muted-foreground uppercase sm:px-6">
            © {new Date().getFullYear()} Vellura Dental. All rights reserved.
          </p>
        </div>
      </footer>

      <ChatWidget />
    </>
  );
}
