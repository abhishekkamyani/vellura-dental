import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; className: string; dot: string }> = {
  CONFIRMED: { label: "Confirmed", className: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  COMPLETED: { label: "Completed", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  CANCELLED: { label: "Cancelled", className: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? { label: status, className: "border-border bg-muted text-muted-foreground", dot: "bg-slate-400" };
  return (
    <Badge variant="outline" className={cn("h-6 gap-1.5 px-2.5 font-medium tracking-wide", style.className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {style.label}
    </Badge>
  );
}
