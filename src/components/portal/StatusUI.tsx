import type { ReactNode } from "react";
import { Check, Loader2, AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EXECUTION_LABEL, EXECUTION_STEPS, PAYMENT_STATUS, type ExecutionStatus } from "@/lib/portal-data";

export function PaymentBadge({ status }: { status: string | null }) {
  const s = PAYMENT_STATUS[status ?? "belum_lunas"] ?? PAYMENT_STATUS["belum_lunas"]!;
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", s.cls)}>Pembayaran: {s.label}</span>;
}

export function ExecutionBadge({ status }: { status: ExecutionStatus }) {
  return <span className="inline-flex items-center rounded-full border border-primary/25 px-2.5 py-0.5 text-xs font-bold text-primary">Pelaksanaan: {EXECUTION_LABEL[status]}</span>;
}

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div>
      <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-burgundy-gradient transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ExecutionTimeline({ status }: { status: ExecutionStatus }) {
  const idx = EXECUTION_STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="space-y-3">
      {EXECUTION_STEPS.map((s, i) => {
        const done = i < idx || status === "selesai";
        const current = i === idx && status !== "selesai";
        return (
          <li key={s.key} className="flex items-center gap-3">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold", done ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary text-primary" : "border-border text-muted-foreground")}>
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn("text-sm", current ? "font-bold text-burgundy-dark" : done ? "font-semibold" : "text-muted-foreground")}>{s.label}{current && " · saat ini"}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Card({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 md:p-6", className)}>
      {title && <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-extrabold text-burgundy-dark">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /> {label}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="mx-auto size-8 text-destructive" />
      <p className="mt-2 font-semibold">Terjadi kendala saat memuat data.</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Coba lagi</Button>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center">
      <Inbox className="mx-auto size-10 text-rose" />
      <p className="mt-3 text-lg font-bold text-burgundy-dark">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
