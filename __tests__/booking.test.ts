import { BookingError, bookAppointment, checkAvailability } from "@/lib/booking";
import { clinicDateString, weekdayOf } from "@/lib/clinic";

type Row = {
  id: string;
  patientName: string;
  phone: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  status: string;
};

type OverlapWhere = { status: { not: string }; startTime: { lt: Date }; endTime: { gt: Date } };

// In-memory stand-in for the database that honours the overlap filter booking.ts queries with.
jest.mock("@/lib/prisma", () => {
  const services = [
    { id: "svc-cleaning", name: "Vellura Signature Cleaning", durationMin: 60, imageQuery: "" },
    { id: "svc-veneer", name: "Veneer Consultation", durationMin: 45, imageQuery: "" },
  ];
  const rows: Row[] = [];
  const matches = (where: OverlapWhere) => (row: Row) =>
    row.status !== where.status.not && row.startTime < where.startTime.lt && row.endTime > where.endTime.gt;

  const prisma = {
    __rows: rows,
    service: {
      findUnique: async ({ where }: { where: { id: string } }) => services.find((s) => s.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { name: { equals: string } } }) =>
        services.find((s) => s.name.toLowerCase() === where.name.equals.toLowerCase()) ?? null,
    },
    appointment: {
      findFirst: async ({ where }: { where: OverlapWhere }) => rows.find(matches(where)) ?? null,
      findMany: async ({ where }: { where: OverlapWhere }) => rows.filter(matches(where)),
      create: async ({ data }: { data: Omit<Row, "id"> }) => {
        const row = { id: `apt-${rows.length + 1}`, ...data };
        rows.push(row);
        return { ...row, service: services.find((s) => s.id === data.serviceId) };
      },
    },
    $queryRaw: async () => [],
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(prisma),
  };
  return { prisma };
});

const { prisma } = jest.requireMock("@/lib/prisma") as { prisma: { __rows: Row[] } };

/** A clinic-local date safely in the future that is not a Sunday. */
function futureOpenDate() {
  const cursor = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  let date = clinicDateString(cursor);
  if (weekdayOf(date) === 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    date = clinicDateString(cursor);
  }
  return date;
}

const patient = { patientName: "Isabella Laurent", phone: "+1 555 010 0101" };
const date = futureOpenDate();

beforeEach(() => {
  prisma.__rows.length = 0;
});

describe("bookAppointment", () => {
  it("books a free slot", async () => {
    const appointment = await bookAppointment({ ...patient, serviceId: "svc-cleaning", date, time: "10:00" });

    expect(appointment.status).toBe("CONFIRMED");
    expect(appointment.endTime.getTime() - appointment.startTime.getTime()).toBe(60 * 60_000);
    expect(prisma.__rows).toHaveLength(1);
  });

  it("rejects an appointment at the same time as an existing one", async () => {
    await bookAppointment({ ...patient, serviceId: "svc-cleaning", date, time: "10:00" });

    await expect(
      bookAppointment({ patientName: "Sebastian Whitmore", phone: "+1 555 010 0102", serviceId: "svc-cleaning", date, time: "10:00" }),
    ).rejects.toMatchObject({ name: "BookingError", code: "SLOT_TAKEN" });
    expect(prisma.__rows).toHaveLength(1);
  });

  it.each([
    ["starts during an existing appointment", "10:30"],
    ["ends during an existing appointment", "09:30"],
  ])("rejects an appointment that %s", async (_label, time) => {
    await bookAppointment({ ...patient, serviceId: "svc-cleaning", date, time: "10:00" });

    await expect(
      bookAppointment({ patientName: "Sebastian Whitmore", phone: "+1 555 010 0102", serviceId: "svc-veneer", date, time }),
    ).rejects.toBeInstanceOf(BookingError);
    expect(prisma.__rows).toHaveLength(1);
  });

  it("allows back-to-back appointments that only touch at the boundary", async () => {
    await bookAppointment({ ...patient, serviceId: "svc-cleaning", date, time: "10:00" });
    await bookAppointment({ patientName: "Sebastian Whitmore", phone: "+1 555 010 0102", serviceId: "svc-cleaning", date, time: "11:00" });
    await bookAppointment({ patientName: "Amelia Fontaine", phone: "+1 555 010 0103", serviceId: "svc-cleaning", date, time: "09:00" });

    expect(prisma.__rows).toHaveLength(3);
  });

  it("ignores cancelled appointments when checking for overlap", async () => {
    await bookAppointment({ ...patient, serviceId: "svc-cleaning", date, time: "10:00" });
    prisma.__rows[0].status = "CANCELLED";

    await expect(
      bookAppointment({ patientName: "Sebastian Whitmore", phone: "+1 555 010 0102", serviceId: "svc-cleaning", date, time: "10:00" }),
    ).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  it("rejects times outside clinic hours", async () => {
    await expect(
      bookAppointment({ ...patient, serviceId: "svc-cleaning", date, time: "17:30" }),
    ).rejects.toMatchObject({ code: "OUTSIDE_HOURS" });
  });
});

describe("checkAvailability", () => {
  it("omits start times that would overlap a booked appointment", async () => {
    await bookAppointment({ ...patient, serviceId: "svc-cleaning", date, time: "10:00" });

    const { slots } = await checkAvailability(date, 60);

    expect(slots).toContain("09:00");
    expect(slots).toContain("11:00");
    expect(slots).not.toContain("09:30");
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30");
  });
});
