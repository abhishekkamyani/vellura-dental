"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, signOut } from "@/auth";
import { BookingError, bookAppointment, checkAvailability } from "@/lib/booking";
import { clinicTimeToUtc, formatClinicTime, isValidDateString } from "@/lib/clinic";
import { prisma } from "@/lib/prisma";

const STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

export type ActionResult = { error?: string };
export type SlotOption = { value: string; label: string };
export type SlotsResult = { slots?: SlotOption[]; reason?: string; error?: string };

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Changes an appointment's status. Server actions are public endpoints, so the session is checked here too. */
export async function updateAppointmentStatus(id: string, status: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: "Your session has expired. Please sign in again." };
  if (typeof id !== "string" || !id || !STATUSES.includes(status as Status)) {
    return { error: "That change is not valid." };
  }

  try {
    await prisma.appointment.update({ where: { id }, data: { status: status as Status } });
  } catch (error) {
    const text = error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : String(error);
    if (text.includes("Appointment_no_overlap") || text.includes("23P01")) {
      return { error: "This time has since been booked by another patient, so it cannot be restored." };
    }
    if (text.includes("P2025")) return { error: "That appointment no longer exists." };
    console.error("Could not update appointment", error);
    return { error: "The change could not be saved. Please try again." };
  }

  revalidatePath("/admin");
  return {};
}

/** Lists the open start times for a service on a date, for the "new appointment" form. */
export async function getAvailableSlots(date: string, serviceId: string): Promise<SlotsResult> {
  if (!(await requireAdmin())) return { error: "Your session has expired. Please sign in again." };
  if (!isValidDateString(date)) return { error: "Choose a valid date." };

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return { error: "Choose a service." };

  try {
    const availability = await checkAvailability(date, service.durationMin);
    return {
      reason: availability.open ? availability.reason : availability.reason ?? "The clinic is closed that day.",
      slots: availability.slots.map((value) => ({
        value,
        label: formatClinicTime(clinicTimeToUtc(date, value)),
      })),
    };
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    console.error("Could not load availability", error);
    return { error: "Availability could not be loaded. Please try again." };
  }
}

/**
 * Creates an appointment on behalf of a patient who booked by phone or in person.
 * Goes through the same validation and overlap rules as the concierge.
 */
export async function createAppointment(formData: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: "Your session has expired. Please sign in again." };

  try {
    await bookAppointment({
      patientName: String(formData.get("patientName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      serviceId: String(formData.get("serviceId") ?? ""),
      date: String(formData.get("date") ?? ""),
      time: String(formData.get("time") ?? ""),
    });
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    console.error("Could not create appointment", error);
    return { error: "The appointment could not be saved. Please try again." };
  }

  revalidatePath("/admin");
  return {};
}
