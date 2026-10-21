import type { ReactNode } from "react";
import { Info, FlaskConical, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function Section({ id, className, children, tone = "default" }: { id?: string; className?: string; children: ReactNode; tone?: "default" | "cream" | "dark" }) {
  return (
    <section
      id={id}
      className={cn(
        "py-14 md:py-20",
        tone === "cream" && "bg-cream/60",
        tone === "dark" && "bg-burgundy-gradient text-ivory",
        className,
      )}
    >
      <div className="container-q">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, intro, align = "left", light }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; align?: "left" | "center"; light?: boolean }) {
  return (
    <div className={cn("mb-8 max-w-2xl md:mb-10", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className={cn("eyebrow mb-3", light && "text-rose")}>{eyebrow}</p>}
      <h2 className={cn("text-2xl font-extrabold leading-tight tracking-tight md:text-4xl", light ? "text-ivory" : "text-burgundy-dark")}>{title}</h2>
      {intro && <p className={cn("mt-3 text-base leading-relaxed md:text-lg", light ? "text-cream/85" : "text-muted-foreground")}>{intro}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="relative overflow-hidden bg-burgundy-gradient text-ivory">
      <div className="pattern-dots absolute inset-0 opacity-40" aria-hidden />
      <div className="container-q relative py-12 md:py-16">
        <p className="eyebrow mb-3 text-rose">{eyebrow}</p>
        <h1 className="animate-rise max-w-3xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-base leading-relaxed text-cream/85 md:text-lg">{intro}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </header>
  );
}

type NoteKind = "sample" | "pending" | "info";
const NOTE = {
  sample: { icon: FlaskConical, label: "Data contoh", cls: "border-beige bg-beige/30 text-burgundy-dark" },
  pending: { icon: Clock, label: "Menunggu persetujuan", cls: "border-burgundy-soft/30 bg-burgundy/5 text-burgundy-dark" },
  info: { icon: Info, label: "Informasi", cls: "border-border bg-card text-foreground" },
} as const;

export function Notice({ kind, children, className }: { kind: NoteKind; children: ReactNode; className?: string }) {
  const n = NOTE[kind];
  const Icon = n.icon;
  return (
    <div role="note" className={cn("flex gap-3 rounded-xl border p-4 text-sm leading-relaxed", n.cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div><span className="font-bold">{n.label}. </span>{children}</div>
    </div>
  );
}

export function StatusPill({ kind }: { kind: "sample" | "pending" | "demo" | "soon" }) {
  const map = {
    sample: ["Contoh", "bg-gold/20 text-burgundy-dark"],
    pending: ["Draf", "bg-burgundy/10 text-burgundy"],
    demo: ["Demo", "bg-gold/20 text-burgundy-dark"],
    soon: ["Segera", "bg-muted text-muted-foreground"],
  } as const;
  const [label, cls] = map[kind];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", cls)}>{label}</span>;
}

export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-burgundy/25 bg-card p-5">
      <div className="mb-2 flex items-center gap-2">
        <StatusPill kind="pending" />
        <p className="font-bold text-burgundy-dark">{title}</p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {children ?? "Teks resmi sedang ditinjau oleh tim hukum dan dewan syariah. Konten ini belum berlaku dan akan diperbarui setelah disetujui."}
      </p>
    </div>
  );
}
