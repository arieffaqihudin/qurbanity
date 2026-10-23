import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { cn } from "@/lib/utils";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  SANDBOX_NOTICE,
  displayStatus,
  type PaymentRow,
  type PaymentStatus,
} from "@/lib/payments";

const TONE_CLS = {
  success: "bg-success/15 text-success",
  warning: "bg-beige/70 text-burgundy-dark",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const;

export function PaymentStatusBadge({
  payment,
}: {
  payment: Pick<PaymentRow, "status" | "expires_at">;
}) {
  const s: PaymentStatus = displayStatus(payment);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
        TONE_CLS[PAYMENT_STATUS_TONE[s]],
      )}
    >
      {PAYMENT_STATUS_LABEL[s]}
    </span>
  );
}

export function SandboxBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-center gap-2 rounded-xl border border-beige bg-beige/30 px-4 py-2.5 text-sm font-semibold text-burgundy-dark",
        className,
      )}
    >
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      {SANDBOX_NOTICE}
    </div>
  );
}

/** Standalone page chrome for payment screens (outside the portal sidebar shell). */
export function PaymentLayout({
  title,
  back,
  children,
}: {
  title: string;
  back?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-ivory/90">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Logo />
          <Link
            to={(back?.to ?? "/portal") as "/portal"}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            <ArrowLeft className="size-4" /> {back?.label ?? "Dashboard"}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:py-10">
        <h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">{title}</h1>
        <SandboxBanner />
        {children}
      </main>
    </div>
  );
}
