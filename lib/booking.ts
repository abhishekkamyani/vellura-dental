import { addMinutes } from "date-fns";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CLINIC,
  clinicTimeToUtc,
  isValidDateString,
  isValidTimeString,
  minutesToLabel,
  weekdayOf,
} from "@/lib/clinic";

export type BookingErrorCode =
  | "INVALID_INPUT"
  | "SERVICE_NOT_FOUND"
  | "OUTSIDE_HOURS"
  | "IN_PAST"
  | "SLOT_TAKEN";

export class BookingError extends Error {
  constructor(
    public code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type BookingDetails = {
  patientName: string;
  phone: string;
  /** Either the service id or its exact name must be supplied. */
  serviceId?: string;
  serviceName?: string;
  /** Clinic-local calendar date, "YYYY-MM-DD". */
  date: string;
  /** Clinic-local start time, "HH:mm" (24-hour). */
  time: string;
};

export type Availability = {
  date: string;
  durationMin: number;
  open: boolean;
  reason?: string;
  /** Clinic-local start times ("HH:mm") that can fit the requested duration. */
  slots: string[];
};

const ACTIVE = { not: "CANCELLED" } as const;
// Arbitrary constant key: serialises all booking writes so the overlap check cannot race.
const BOOKING_LOCK_KEY = 8355711;

/** Prisma filter matching active appointments that intersect the half-open range [start, end). */
function overlapWhere(start: Date, end: Date): Prisma.AppointmentWhereInput {
  return { status: ACTIVE, startTime: { lt: end }, endTime: { gt: start } };
}

function isExclusionViolation(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : String(error);
  return text.includes("Appointment_no_overlap") || text.includes("23P01");
}

/**
 * Lists the start times on `date` that are free for an appointment of `durationMin` minutes.
 */
export async function checkAvailability(date: string, durationMin: number): Promise<Availability> {
  if (!isValidDateString(date)) {
    throw new BookingError("INVALID_INPUT", "Date must be a real calendar date in YYYY-MM-DD format.");
  }
  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    throw new BookingError("INVALID_INPUT", "Duration must be a positive whole number of minutes.");
  }

  const base = { date, durationMin };
  if (CLINIC.closedWeekdays.includes(weekdayOf(date))) {
    return { ...base, open: false, reason: "The clinic is closed on Sundays.", slots: [] };
  }

  const dayStart = clinicTimeToUtc(date, minutesToLabel(CLINIC.openHour * 60));
  const dayEnd = clinicTimeToUtc(date, minutesToLabel(CLINIC.closeHour * 60));
  const now = new Date();
  if (dayEnd <= now) {
    return { ...base, open: false, reason: "That date has already passed.", slots: [] };
  }

  const booked = await prisma.appointment.findMany({
    where: overlapWhere(dayStart, dayEnd),
    select: { startTime: true, endTime: true },
    orderBy: { startTime: "asc" },
  });

  const slots: string[] = [];
  const lastStart = CLINIC.closeHour * 60 - durationMin;
  for (let minute = CLINIC.openHour * 60; minute <= lastStart; minute += CLINIC.slotMinutes) {
    const label = minutesToLabel(minute);
    const start = clinicTimeToUtc(date, label);
    const end = addMinutes(start, durationMin);
    if (start <= now) continue;
    const clash = booked.some((b) => b.startTime < end && b.endTime > start);
    if (!clash) slots.push(label);
  }

  return {
    ...base,
    open: true,
    reason: slots.length ? undefined : "That day is fully booked.",
    slots,
  };
}

/** Accepts 10-15 digits with only spaces, dashes, dots, brackets and an optional leading "+"; rejects repeated-digit filler. */
export function isValidPhone(phone: string) {
  if (!/^\+?[\d\s().-]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 && !/^(\d)\1+$/.test(digits);
}

/**
 * Books an appointment, rejecting any time that overlaps an existing active appointment.
 * Overlap is enforced twice: by a locked check inside the transaction, and by a
 * PostgreSQL exclusion constraint as the final authority.
 */
export async function bookAppointment(details: BookingDetails) {
  const patientName = details.patientName?.trim();
  const phone = details.phone?.trim();
  if (!patientName || patientName.length < 2) {
    throw new BookingError("INVALID_INPUT", "A patient name is required.");
  }
  if (!isValidPhone(phone ?? "")) {
    throw new BookingError(
      "INVALID_INPUT",
      "That phone number does not look valid. Ask the patient for a valid contact number, including the country code if abroad.",
    );
  }
  if (!isValidDateString(details.date) || !isValidTimeString(details.time)) {
    throw new BookingError("INVALID_INPUT", "Date must be YYYY-MM-DD and time must be HH:mm (24-hour).");
  }

  const service = details.serviceId
    ? await prisma.service.findUnique({ where: { id: details.serviceId } })
    : await prisma.service.findFirst({
        where: { name: { equals: details.serviceName?.trim() ?? "", mode: "insensitive" } },
      });
  if (!service) {
    throw new BookingError("SERVICE_NOT_FOUND", "That service is not offered at Vellura Dental.");
  }

  const startTime = clinicTimeToUtc(details.date, details.time);
  const endTime = addMinutes(startTime, service.durationMin);

  const [hour, minute] = details.time.split(":").map(Number);
  const startMinute = hour * 60 + minute;
  if (
    CLINIC.closedWeekdays.includes(weekdayOf(details.date)) ||
    startMinute < CLINIC.openHour * 60 ||
    startMinute + service.durationMin > CLINIC.closeHour * 60
  ) {
    throw new BookingError("OUTSIDE_HOURS", `Appointments must fall within clinic hours (${CLINIC.hoursLabel}).`);
  }
  if (startTime <= new Date()) {
    throw new BookingError("IN_PAST", "Appointments must be booked for a future time.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${BOOKING_LOCK_KEY})::text AS locked`;

      const conflict = await tx.appointment.findFirst({
        where: overlapWhere(startTime, endTime),
        select: { id: true },
      });
      if (conflict) {
        throw new BookingError("SLOT_TAKEN", "That time overlaps an existing appointment.");
      }

      return tx.appointment.create({
        data: { patientName, phone, serviceId: service.id, startTime, endTime, status: "CONFIRMED" },
        include: { service: true },
      });
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new BookingError("SLOT_TAKEN", "That time overlaps an existing appointment.");
    }
    throw error;
  }
}
