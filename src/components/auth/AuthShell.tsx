import type { ReactNode } from "react";
import { Logo } from "@/components/site/Logo";

export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className="relative min-h-dvh bg-background">
      <div className="pattern-dots absolute inset-x-0 top-0 h-64 opacity-60" aria-hidden />
      <div className={`relative mx-auto px-4 py-8 md:py-14 ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function FieldError({ id, msg }: { id: string; msg?: string | undefined }) {
  if (!msg) return null;
  return <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-destructive">{msg}</p>;
}

export function FormAlert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={kind === "error" ? "rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive" : "rounded-xl border border-success/30 bg-success/10 p-3 text-sm font-medium text-success"}>
      {children}
    </div>
  );
}
