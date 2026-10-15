import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { CLINIC, clinicDateString, clinicTimeToUtc, weekdayOf } from "../lib/clinic";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const services = [
  { name: "Vellura Signature Cleaning", durationMin: 60, imageQuery: "modern dental clinic interior" },
  { name: "Laser Whitening", durationMin: 90, imageQuery: "abstract soft blue waves" },
  { name: "Veneer Consultation", durationMin: 45, imageQuery: "dentist consultation minimal" },
];

// Sample bookings so the admin dashboard has something to show. Identified by these phone numbers.
const demoAppointments = [
  { patientName: "Isabella Laurent", phone: "+1 555 010 0101", service: "Vellura Signature Cleaning", dayOffset: 1, time: "10:00", status: "CONFIRMED" },
  { patientName: "Sebastian Whitmore", phone: "+1 555 010 0102", service: "Laser Whitening", dayOffset: 1, time: "13:00", status: "CONFIRMED" },
  { patientName: "Amelia Fontaine", phone: "+1 555 010 0103", service: "Veneer Consultation", dayOffset: 2, time: "11:30", status: "CANCELLED" },
] as const;

/** Clinic-local date string for the nth open day after today. */
function openDayFromToday(offset: number) {
  const cursor = new Date();
  let remaining = offset;
  let date = clinicDateString(cursor);
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    date = clinicDateString(cursor);
    if (!CLINIC.closedWeekdays.includes(weekdayOf(date))) remaining--;
  }
  return date;
}

async function main() {
  for (const service of services) {
    await prisma.service.upsert({ where: { name: service.name }, update: service, create: service });
  }

  await prisma.appointment.deleteMany({ where: { phone: { in: demoAppointments.map((a) => a.phone) } } });

  for (const demo of demoAppointments) {
    const service = await prisma.service.findUniqueOrThrow({ where: { name: demo.service } });
    const startTime = clinicTimeToUtc(openDayFromToday(demo.dayOffset), demo.time);
    const endTime = new Date(startTime.getTime() + service.durationMin * 60_000);
    try {
      await prisma.appointment.create({
        data: { patientName: demo.patientName, phone: demo.phone, serviceId: service.id, startTime, endTime, status: demo.status },
      });
    } catch {
      console.warn(`Skipped sample appointment for ${demo.patientName}: that time is already taken.`);
    }
  }

  console.log(`Seeded ${services.length} services and sample appointments.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
