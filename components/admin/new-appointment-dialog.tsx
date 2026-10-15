"use client";

import { CalendarPlus, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { createAppointment, getAvailableSlots, type SlotOption } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ServiceOption = { id: string; name: string; durationMin: number };

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-base tracking-wide text-vellura-ink outline-none transition-shadow focus-visible:border-vellura-sky focus-visible:ring-3 focus-visible:ring-vellura-sky/25 disabled:opacity-50 md:text-sm";

const fieldLabel = "text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase";

export function NewAppointmentDialog({
  services,
  today,
  defaultDate,
}: {
  services: ServiceOption[];
  today: string;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotReason, setSlotReason] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSlots, startLoadingSlots] = useTransition();
  const [saving, startSaving] = useTransition();

  // Refresh open times whenever the service or date changes.
  useEffect(() => {
    if (!open || !serviceId || !date) return;
    startLoadingSlots(async () => {
      const result = await getAvailableSlots(date, serviceId);
      setTime("");
      if (result.error) {
        setSlots([]);
        setSlotReason(null);
        setError(result.error);
        return;
      }
      setError(null);
      setSlots(result.slots ?? []);
      setSlotReason(result.slots?.length ? null : (result.reason ?? "No free times on this day."));
    });
  }, [open, serviceId, date]);

  function reset() {
    setServiceId(services[0]?.id ?? "");
    setDate(defaultDate);
    setSlots([]);
    setSlotReason(null);
    setTime("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function submit(formData: FormData) {
    setError(null);
    formData.set("time", time);
    startSaving(async () => {
      const result = await createAppointment(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      handleOpenChange(false);
    });
  }

  const service = services.find((s) => s.id === serviceId);
  const busy = saving || loadingSlots;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="h-10 rounded-full px-5 text-xs tracking-[0.12em] uppercase shadow-soft hover:bg-vellura-deep"
      >
        <CalendarPlus aria-hidden />
        New appointment
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-vellura-ink">New appointment</DialogTitle>
            <DialogDescription className="leading-6 tracking-wide">
              Book a patient who called or visited in person. The same rules apply as for online bookings.
            </DialogDescription>
          </DialogHeader>

          <form action={submit} className="flex flex-col gap-4 sm:gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="new-patient" className={fieldLabel}>Patient name</Label>
                <Input id="new-patient" name="patientName" required minLength={2} maxLength={80} autoComplete="off" className="h-10 rounded-lg bg-white px-3 text-base md:text-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-phone" className={fieldLabel}>Phone</Label>
                <Input id="new-phone" name="phone" type="tel" required autoComplete="off" placeholder="+1 555 000 0000" className="h-10 rounded-lg bg-white px-3 text-base md:text-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-service" className={fieldLabel}>Service</Label>
                <select
                  id="new-service"
                  name="serviceId"
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  className={selectClass}
                >
                  {services.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.durationMin} min)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-date" className={fieldLabel}>Date</Label>
                <Input
                  id="new-date"
                  name="date"
                  type="date"
                  min={today}
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-10 rounded-lg bg-white px-3 text-base md:text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-time" className={fieldLabel}>
                  Start time {loadingSlots && <Loader2 className="ml-1 inline size-3 animate-spin" aria-label="Loading times" />}
                </Label>
                <select
                  id="new-time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  disabled={busy || slots.length === 0}
                  required
                  className={selectClass}
                >
                  <option value="">{slots.length ? "Choose a time" : "No times available"}</option>
                  {slots.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {slotReason && !loadingSlots && (
              <p className="text-xs tracking-wide text-muted-foreground">{slotReason}</p>
            )}
            {service && (
              <p className="text-xs tracking-wide text-muted-foreground">
                {slots.length} open start {slots.length === 1 ? "time" : "times"} for a {service.durationMin}-minute visit.
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 bg-white/95 px-6 pt-3 pb-6 backdrop-blur">
              <Button type="button" variant="outline" className="h-10 rounded-full px-5" onClick={() => handleOpenChange(false)} disabled={saving}>
                Discard
              </Button>
              <Button type="submit" disabled={busy || !time} className="h-10 rounded-full px-5 hover:bg-vellura-deep">
                {saving && <Loader2 className="animate-spin" aria-hidden />}
                {saving ? "Saving…" : "Book appointment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
