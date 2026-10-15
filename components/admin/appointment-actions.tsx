"use client";

import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { updateAppointmentStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = { id: string; status: string; patientName: string; summary: string };

export function AppointmentActions({ id, status, patientName, summary }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(next: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateAppointmentStatus(id, next);
      if (result.error) setError(result.error);
      else setConfirmingCancel(false);
    });
  }

  const subtle = "h-8 rounded-full px-3 text-xs tracking-wide";

  return (
    <div className="flex flex-col items-start gap-1 xl:items-end">
      <div className="flex items-center gap-1.5">
        {pending && !confirmingCancel && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
        {status === "CONFIRMED" && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => change("COMPLETED")}
              className={`${subtle} border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800`}
              aria-label={`Mark ${patientName}'s appointment as completed`}
            >
              <Check aria-hidden />
              Complete
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                setConfirmingCancel(true);
              }}
              className={`${subtle} border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800`}
              aria-label={`Cancel ${patientName}'s appointment`}
            >
              <X aria-hidden />
              Cancel
            </Button>
          </>
        )}
        {status !== "CONFIRMED" && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => change("CONFIRMED")}
            className={`${subtle} border-sky-200 text-vellura-cyan hover:bg-sky-50 hover:text-vellura-deep`}
            aria-label={`Restore ${patientName}'s appointment to confirmed`}
          >
            <RotateCcw aria-hidden />
            Restore
          </Button>
        )}
      </div>
      {error && !confirmingCancel && (
        <p role="alert" className="max-w-56 text-xs tracking-wide whitespace-normal text-rose-700 xl:text-right">
          {error}
        </p>
      )}

      <Dialog open={confirmingCancel} onOpenChange={setConfirmingCancel}>
        <DialogContent className="rounded-2xl p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-vellura-ink">Cancel this appointment?</DialogTitle>
            <DialogDescription className="leading-6 tracking-wide">
              {patientName} · {summary}. The time will be released for other patients. You can restore it later if it
              is still free.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="h-10 rounded-full px-5" disabled={pending} />}>
              Keep appointment
            </DialogClose>
            <Button
              disabled={pending}
              onClick={() => change("CANCELLED")}
              className="h-10 rounded-full bg-rose-600 px-5 text-white hover:bg-rose-700"
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Cancel appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
