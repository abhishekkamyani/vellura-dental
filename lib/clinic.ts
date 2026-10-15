/**
 * Clinic operating rules and timezone helpers.
 * All patient-facing dates and times are expressed in the clinic's timezone;
 * the database stores UTC instants.
 */
export const CLINIC = {
  name: "Vellura Dental",
  // Fixed rather than taken from the server: hosts such as Vercel run in UTC, which shifts every time shown.
  timeZone: process.env.CLINIC_TIMEZONE || "Asia/Karachi",
  openHour: 9,
  closeHour: 18,
  slotMinutes: 30,
  /** 0 = Sunday. */
  closedWeekdays: [0] as number[],
  hoursLabel: "Monday to Saturday, 9:00 AM – 6:00 PM",
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateString(date: string) {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

export function isValidTimeString(time: string) {
  return TIME_RE.test(time);
}

function offsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Converts a clinic-local wall-clock date ("YYYY-MM-DD") and time ("HH:mm") to a UTC instant. */
export function clinicTimeToUtc(date: string, time: string, timeZone = CLINIC.timeZone) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wallClock = Date.UTC(y, mo - 1, d, h, mi);
  const firstGuess = wallClock - offsetMs(new Date(wallClock), timeZone);
  // Re-check the offset at the guessed instant so DST transitions resolve correctly.
  return new Date(wallClock - offsetMs(new Date(firstGuess), timeZone));
}

/** Weekday (0 = Sunday) of a clinic-local calendar date. */
export function weekdayOf(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** Clinic-local "YYYY-MM-DD" for an instant. */
export function clinicDateString(instant: Date, timeZone = CLINIC.timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** Clinic-local "HH:mm" for an instant. */
export function clinicTimeString(instant: Date, timeZone = CLINIC.timeZone) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).format(instant);
}

export function formatClinicDate(instant: Date, timeZone = CLINIC.timeZone) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(instant);
}

export function formatClinicTime(instant: Date, timeZone = CLINIC.timeZone) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(instant);
}

export function minutesToLabel(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
