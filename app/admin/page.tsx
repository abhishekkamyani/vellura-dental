import { CalendarCheck, CalendarDays, CircleCheck, Search, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/auth";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { NewAppointmentDialog } from "@/components/admin/new-appointment-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLINIC, clinicDateString, formatClinicDate, formatClinicTime } from "@/lib/clinic";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings — Vellura Dental" };

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["key"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function dayLabel(start: Date, today: string, tomorrow: string) {
  const day = clinicDateString(start);
  if (day === today) return "Today";
  if (day === tomorrow) return "Tomorrow";
  return formatClinicDate(start);
}

async function loadDashboard(view: View, query: string, now: Date) {
  const where: Prisma.AppointmentWhereInput = {
    ...(view === "upcoming" ? { endTime: { gte: now } } : view === "past" ? { endTime: { lt: now } } : {}),
    ...(query
      ? {
          OR: [
            { patientName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { service: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  try {
    const [appointments, upcoming, completed] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: { service: true },
        orderBy: { startTime: view === "upcoming" ? "asc" : "desc" },
        take: 200,
      }),
      prisma.appointment.findMany({
        where: { endTime: { gte: now }, status: "CONFIRMED" },
        select: { startTime: true, service: { select: { durationMin: true } } },
      }),
      prisma.appointment.count({ where: { status: "COMPLETED" } }),
    ]);
    return { appointments, upcoming, completed };
  } catch (error) {
    console.error("Could not load appointments", error);
    return null;
  }
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  if (!(await requireAdmin())) redirect("/login");

  const params = await searchParams;
  const view: View = VIEWS.some((v) => v.key === params.view) ? (params.view as View) : "upcoming";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";

  const now = new Date();
  const today = clinicDateString(now);
  const tomorrow = clinicDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const data = await loadDashboard(view, query, now);
  const services = await prisma.service
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, durationMin: true } })
    .catch(() => []);

  const todayCount = data?.upcoming.filter((a) => clinicDateString(a.startTime) === today).length ?? 0;
  const bookedMinutes = data?.upcoming.reduce((sum, a) => sum + a.service.durationMin, 0) ?? 0;
  const stats = [
    { label: "Upcoming", value: data?.upcoming.length ?? "–", icon: CalendarDays },
    { label: "Today", value: data ? todayCount : "–", icon: CalendarCheck },
    { label: "Hours", value: data ? (bookedMinutes / 60).toFixed(bookedMinutes % 60 ? 1 : 0) : "–", icon: Sparkles },
    { label: "Completed", value: data?.completed ?? "–", icon: CircleCheck },
  ];

  const viewHref = (key: View) => {
    const search = new URLSearchParams();
    if (key !== "upcoming") search.set("view", key);
    if (query) search.set("q", query);
    const text = search.toString();
    return text ? `/admin?${text}` : "/admin";
  };

  const appointments = data?.appointments ?? [];
  const rows = appointments.map((appointment) => ({
    appointment,
    day: dayLabel(appointment.startTime, today, tomorrow),
    time: `${formatClinicTime(appointment.startTime)} – ${formatClinicTime(appointment.endTime)}`,
  }));

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <p className="eyebrow">Dashboard</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-light text-vellura-ink">
            {view === "past" ? "Past bookings" : view === "all" ? "All bookings" : "Upcoming bookings"}
          </h1>
          <p className="mt-2 text-sm tracking-wide text-muted-foreground">Times shown in clinic time ({CLINIC.timeZone}).</p>
        </div>
        <NewAppointmentDialog
          services={services}
          today={today}
          defaultDate={tomorrow}
        />
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="rounded-2xl shadow-soft ring-border">
            <CardContent className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
                <p className="mt-1 text-3xl font-light text-vellura-ink tabular-nums">{value}</p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-vellura-cyan ring-1 ring-sky-100">
                <Icon className="size-4.5" aria-hidden />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-5 gap-0 rounded-2xl py-0 shadow-soft ring-border">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <nav aria-label="Booking views" className="flex w-full rounded-full bg-vellura-mist p-1 ring-1 ring-border sm:w-auto">
            {VIEWS.map(({ key, label }) => (
              <Link
                key={key}
                href={viewHref(key)}
                aria-current={view === key ? "page" : undefined}
                className={cn(
                  "flex-1 rounded-full px-4 py-1.5 text-center text-xs font-semibold tracking-[0.12em] uppercase transition-colors sm:flex-none",
                  view === key ? "bg-white text-vellura-cyan shadow-soft" : "text-muted-foreground hover:text-vellura-ink",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <Form action="/admin" className="relative w-full sm:w-72">
            {view !== "upcoming" && <input type="hidden" name="view" value={view} />}
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search patient, phone or service"
              aria-label="Search bookings"
              className="h-10 rounded-full bg-white pr-4 pl-10 text-base tracking-wide md:text-sm"
            />
          </Form>
        </div>

        {data === null ? (
          <p role="alert" className="p-8 text-sm tracking-wide text-rose-700">
            The booking database could not be reached. Check that PostgreSQL is running and DATABASE_URL is correct.
          </p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-sky-50 text-vellura-cyan ring-1 ring-sky-100">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium tracking-wide text-vellura-ink">
              {query ? `No bookings match “${query}”` : "No bookings here yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm tracking-wide text-muted-foreground">
              {query ? "Try a different name, phone number or service." : "Appointments made through the concierge will appear here."}
            </p>
          </div>
        ) : (
          <>
            {/* Wide screens: dense table */}
            <div className="hidden xl:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-vellura-mist hover:bg-vellura-mist">
                    {["Patient", "Service", "Date", "Time", "Status"].map((heading) => (
                      <TableHead
                        key={heading}
                        className="h-9 px-3 text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase first:pl-4"
                      >
                        {heading}
                      </TableHead>
                    ))}
                    <TableHead className="h-9 pr-4 pl-3 text-right text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ appointment, day, time }) => (
                    <TableRow key={appointment.id} className="hover:bg-sky-50/50">
                      <TableCell className="py-2 pr-3 pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar size="default" className="after:hidden">
                            <AvatarFallback className="bg-sky-100 text-[0.65rem] font-semibold text-vellura-deep">
                              {initials(appointment.patientName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-vellura-ink">{appointment.patientName}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">{appointment.phone}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 text-vellura-ink">
                        {appointment.service.name}
                        <span className="ml-1.5 text-xs text-muted-foreground">{appointment.service.durationMin} min</span>
                      </TableCell>
                      <TableCell className="px-3 text-vellura-ink tabular-nums">{day}</TableCell>
                      <TableCell className="px-3 text-vellura-ink tabular-nums">{time}</TableCell>
                      <TableCell className="px-3">
                        <StatusBadge status={appointment.status} />
                      </TableCell>
                      <TableCell className="py-2 pr-4 pl-3">
                        <AppointmentActions
                          id={appointment.id}
                          status={appointment.status}
                          patientName={appointment.patientName}
                          summary={`${appointment.service.name}, ${day} at ${formatClinicTime(appointment.startTime)}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phones and tablets: one card per booking */}
            <ul className="grid md:grid-cols-2 xl:hidden">
              {rows.map(({ appointment, day, time }) => (
                <li key={appointment.id} className="flex flex-col gap-3 border-b border-border p-4 last:border-b-0 md:border-b md:odd:border-r md:last:border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar size="default" className="after:hidden">
                        <AvatarFallback className="bg-sky-100 text-xs font-semibold text-vellura-deep">
                          {initials(appointment.patientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium tracking-wide text-vellura-ink">{appointment.patientName}</p>
                        <a href={`tel:${appointment.phone.replace(/[^\d+]/g, "")}`} className="text-xs tracking-wide text-muted-foreground tabular-nums">
                          {appointment.phone}
                        </a>
                      </div>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                  <div className="rounded-xl bg-vellura-mist px-3.5 py-3 ring-1 ring-border">
                    <p className="text-sm font-medium tracking-wide text-vellura-ink">{appointment.service.name}</p>
                    <p className="mt-0.5 text-xs tracking-wide text-muted-foreground tabular-nums">
                      {day} · {time}
                    </p>
                  </div>
                  <AppointmentActions
                    id={appointment.id}
                    status={appointment.status}
                    patientName={appointment.patientName}
                    summary={`${appointment.service.name}, ${day} at ${formatClinicTime(appointment.startTime)}`}
                  />
                </li>
              ))}
            </ul>

            <p className="border-border px-4 py-3 text-xs xl:border-t tracking-wide text-muted-foreground">
              {rows.length} booking{rows.length === 1 ? "" : "s"}
              {query ? ` matching “${query}”` : ""}
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
