import type { FunctionDeclaration } from "@google/genai";
import { BookingError, bookAppointment, checkAvailability } from "@/lib/booking";
import { CLINIC, clinicDateString, clinicTimeString, clinicTimeToUtc, formatClinicDate, formatClinicTime } from "@/lib/clinic";
import { prisma } from "@/lib/prisma";

export type ServiceSummary = { id: string; name: string; durationMin: number };

export type BookingConfirmation = {
  id: string;
  patientName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  durationMin: number;
  /** ISO instants, used for the "add to calendar" file. */
  startISO: string;
  endISO: string;
};

/** Open start times surfaced to the patient as tappable quick replies. */
export type SlotSuggestions = {
  date: string;
  dateLabel: string;
  serviceName: string;
  times: { value: string; label: string }[];
};

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "check_availability",
    description:
      "Looks up the open appointment start times on a given date for a given Vellura Dental service. Always call this before offering or confirming any time.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Requested date in YYYY-MM-DD format, in the clinic's local timezone." },
        serviceName: { type: "string", description: "Exact name of the service, as listed in the service menu." },
      },
      required: ["date", "serviceName"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Creates a confirmed appointment in the clinic's booking system. Only call once the patient has given their full name, phone number, chosen service, date and time, and has explicitly confirmed the details.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        patientName: { type: "string", description: "Patient's full name." },
        phone: { type: "string", description: "Patient's contact phone number." },
        serviceName: { type: "string", description: "Exact name of the service, as listed in the service menu." },
        date: { type: "string", description: "Appointment date in YYYY-MM-DD format, in the clinic's local timezone." },
        time: { type: "string", description: "Appointment start time in 24-hour HH:mm format, in the clinic's local timezone." },
      },
      required: ["patientName", "phone", "serviceName", "date", "time"],
    },
  },
];

export function buildSystemPrompt(services: ServiceSummary[], now = new Date()) {
  const menu = services.map((s) => `- ${s.name} (${s.durationMin} minutes)`).join("\n");
  return `You are the personal concierge for ${CLINIC.name}, a luxury dental clinic. Your role is to welcome patients and arrange their appointments.

Tone: warm, gracious, highly accommodating and quietly luxurious, like the concierge of a five-star hotel. Be polished and concise: two or three short sentences per reply, no bullet-point walls, no emojis. You may use **bold** sparingly for dates and times; avoid other formatting.

Service menu:
${menu}

Clinic hours: ${CLINIC.hoursLabel} (${CLINIC.timeZone} time).
Current date and time at the clinic: ${formatClinicDate(now)}, ${clinicTimeString(now)} (${clinicDateString(now)}).

How to arrange a booking:
1. Learn which service the patient would like and their preferred date. Resolve relative dates such as "tomorrow" or "next Friday" yourself from the current clinic date.
2. Call check_availability before proposing or confirming any time. Never guess or invent availability. Mention two or three suitable times in a friendly 12-hour format; the patient is also shown the open times as buttons, so do not recite the whole list.
3. Collect the patient's full name and phone number.
4. Read the details back and ask the patient to confirm.
5. Once they confirm, call book_appointment. An appointment exists only if book_appointment returns success: never tell a patient they are booked unless it has.
6. Notes in square brackets beginning "[Booking system:" record appointments already confirmed in this conversation. Never book those again or repeat the bracketed note; if the patient confirms or thanks you afterwards, simply acknowledge warmly.
7. If a tool returns an error or the time is no longer free, apologise gracefully and offer alternatives.

Stay within your role: you arrange appointments and answer general questions about the clinic and its services. Do not give medical diagnoses or quote prices; offer to have the clinical team discuss those at the visit. If asked for something outside the service menu, kindly explain what is offered.`;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function findService(name: string) {
  return prisma.service.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
}

export type ToolOutcome = {
  response: Record<string, unknown>;
  booking?: BookingConfirmation;
  slots?: SlotSuggestions;
};

/** Short, patient-facing description of what a tool call is doing. */
export function toolStatusLabel(name: string | undefined) {
  if (name === "check_availability") return "Checking the diary…";
  if (name === "book_appointment") return "Reserving your appointment…";
  return "One moment…";
}

/** Executes a function call requested by Gemini against the real database. */
export async function executeTool(name: string | undefined, args: Record<string, unknown> = {}): Promise<ToolOutcome> {
  try {
    if (name === "check_availability") {
      const serviceName = asString(args.serviceName);
      const service = await findService(serviceName);
      if (!service) {
        return { response: { error: `No service named "${serviceName}" is offered.` } };
      }
      const availability = await checkAvailability(asString(args.date), service.durationMin);
      const slots: SlotSuggestions | undefined = availability.slots.length
        ? {
            date: availability.date,
            dateLabel: formatClinicDate(clinicTimeToUtc(availability.date, "12:00")),
            serviceName: service.name,
            times: availability.slots.map((value) => ({
              value,
              label: formatClinicTime(clinicTimeToUtc(availability.date, value)),
            })),
          }
        : undefined;
      return {
        slots,
        response: {
          output: {
            date: availability.date,
            service: service.name,
            durationMin: service.durationMin,
            open: availability.open,
            note: availability.reason,
            availableStartTimes: availability.slots,
          },
        },
      };
    }

    if (name === "book_appointment") {
      const appointment = await bookAppointment({
        patientName: asString(args.patientName),
        phone: asString(args.phone),
        serviceName: asString(args.serviceName),
        date: asString(args.date),
        time: asString(args.time),
      });
      const booking: BookingConfirmation = {
        id: appointment.id,
        patientName: appointment.patientName,
        serviceName: appointment.service.name,
        dateLabel: formatClinicDate(appointment.startTime),
        timeLabel: formatClinicTime(appointment.startTime),
        durationMin: appointment.service.durationMin,
        startISO: appointment.startTime.toISOString(),
        endISO: appointment.endTime.toISOString(),
      };
      return {
        response: { output: { success: true, confirmationId: appointment.id, ...booking } },
        booking,
      };
    }

    return { response: { error: `Unknown function "${name}".` } };
  } catch (error) {
    if (error instanceof BookingError) {
      return { response: { error: error.message, code: error.code } };
    }
    console.error(`Tool ${name} failed`, error);
    return { response: { error: "The booking system is temporarily unavailable." } };
  }
}
