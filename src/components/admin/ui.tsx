import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldAlert, AlertTriangle, Search, Plug, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminItem, adminHubOf } from "@/lib/navigation";
import { programsQuery, PROGRAM_STATUS_LABEL, useAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";

export function PageHead({ to, actions, children }: { to: string; actions?: ReactNode; children?: ReactNode }) {
  const it = adminItem(to);
  const found = adminHubOf(to);
  const { can } = useAdmin();
  const tabs = found ? found.hub.tabs.filter((t) => can(t.perms)) : [];
  const isHub = tabs.length > 1;
  const title = isHub ? found!.hub.label : it.label;
  return (
    <div className="mb-4">
      {found && found.group !== "Dashboard" && (
        <nav aria-label="Breadcrumb" className="mb-1 text-xs font-semibold text-muted-foreground">
          <Link to="/admin" className="hover:text-primary">Admin</Link> <span aria-hidden>›</span> {found.group}
          {isHub && <> <span aria-hidden>›</span> {title}</>}
        </nav>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 sm:flex sm:flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-burgundy-dark md:text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{it.description}</p>
          {children}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {isHub && (
        <nav aria-label={`Bagian ${title}`} className="-mx-1 mt-3 flex gap-1 overflow-x-auto border-b border-border px-1">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} aria-current={t.to === to ? "page" : undefined}
              className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                t.to === to ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.icon className="size-4" />{t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Renders children only when the role has one of the permissions; the database enforces it again. */
export function Guard({ perms, children }: { perms: string | string[]; children: ReactNode }) {
  const { can } = useAdmin();
  if (!can(perms)) return <Unauthorized />;
  return <>{children}</>;
}

export function Unauthorized() {
  return (
    <div role="alert" className="mx-auto mt-8 max-w-md rounded-xl border border-border bg-card p-6 text-center">
      <ShieldAlert className="mx-auto size-8 text-primary" />
      <h2 className="mt-2 font-extrabold text-burgundy-dark">Akses tidak diizinkan</h2>
      <p className="mt-1 text-sm text-muted-foreground">Peranmu tidak memiliki izin untuk modul ini. Hubungi SUPERADMIN bila kamu memerlukan akses.</p>
      <Button asChild variant="outline" className="mt-4"><Link to="/admin">Kembali</Link></Button>
    </div>
  );
}

export function Panel({ title, action, children, className, dense }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; dense?: boolean }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", dense ? "p-3" : "p-4", className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title && <h2 className="text-sm font-extrabold text-burgundy-dark md:text-base">{title}</h2>}
          {action && <div className="ml-auto flex flex-wrap gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, to, tone }: { label: string; value: ReactNode; hint?: string; to?: string; tone?: "attention" }) {
  const body = (
    <>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold tabular-nums text-burgundy-dark md:text-xl">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = cn("block rounded-xl border bg-card p-3", tone === "attention" ? "border-warning/50 bg-warning/5" : "border-border");
  if (to) return <Link to={to} className={cn(cls, "transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring")}>{body}<span className="mt-1 block text-xs font-semibold text-primary">Lihat detail ›</span></Link>;
  return <div className={cls}>{body}</div>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Memuat data" className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />)}
    </div>
  );
}

export function Loading({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div role="status" className="space-y-2 p-1">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{label}</span>
      <div className="h-9 animate-pulse rounded-md bg-muted motion-reduce:animate-none" /><div className="h-9 w-4/5 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
    </div>
  );
}
export function Failure({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="size-4" />{error instanceof Error ? error.message : "Terjadi kesalahan."}
      {onRetry && <Button size="sm" variant="outline" className="ml-auto" onClick={onRetry}>Coba lagi</Button>}
    </div>
  );
}
export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-6 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="text-sm font-bold text-burgundy-dark">{title}</p>
      {text && <p className="max-w-md text-xs text-muted-foreground">{text}</p>}
    </div>
  );
}

export function PendingIntegration({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-burgundy/25 bg-card p-4">
      <div className="flex items-center gap-2">
        <Plug className="size-4 text-primary" />
        <p className="font-bold text-burgundy-dark">{title}</p>
        <span className="rounded-full bg-beige/60 px-2 py-0.5 text-[11px] font-bold text-burgundy-dark">Menunggu integrasi pembayaran</span>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Cari…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9 pl-8" />
    </div>
  );
}

export function NativeSelect({ value, onChange, children, label, className }: { value: string; onChange: (v: string) => void; children: ReactNode; label: string; className?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className={cn("h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {children}
    </select>
  );
}

export function ProgramFilter({ value, onChange, allowAll = true }: { value: string; onChange: (v: string) => void; allowAll?: boolean }) {
  const q = useQuery(programsQuery);
  return (
    <NativeSelect label="Periode program" value={value} onChange={onChange}>
      {allowAll && <option value="">Semua periode</option>}
      {(q.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · {PROGRAM_STATUS_LABEL[p.status]}</option>)}
    </NativeSelect>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{total} data · halaman {page + 1} dari {pages}</span>
      <div className="flex gap-1">
        <Button size="icon" variant="outline" className="size-8" aria-label="Halaman sebelumnya" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft className="size-4" /></Button>
        <Button size="icon" variant="outline" className="size-8" aria-label="Halaman berikutnya" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}

/** Responsive table: real table on md+, stacked cards on phones (no sideways scrolling). */
export function DataTable<T>({ rows, cols, rowKey, empty }: {
  rows: T[]; rowKey: (r: T) => string; empty?: ReactNode;
  cols: { label: string; cell: (r: T) => ReactNode; className?: string; primary?: boolean }[];
}) {
  if (!rows.length) return <>{empty ?? <Empty title="Belum ada data" />}</>;
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{cols.map((c) => <th key={c.label} scope="col" className={cn("px-2 py-2 font-semibold", c.className)}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={rowKey(r)} className="border-b border-border/60 last:border-0 hover:bg-muted/40">{cols.map((c) => <td key={c.label} className={cn("px-2 py-2 align-top", c.className)}>{c.cell(r)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-lg border border-border p-3 text-sm">
            {cols.map((c) => c.primary
              ? <div key={c.label} className="mb-1 font-bold text-burgundy-dark">{c.cell(r)}</div>
              : <div key={c.label} className="flex justify-between gap-3 py-0.5"><span className="text-xs text-muted-foreground">{c.label}</span><span className="text-right">{c.cell(r)}</span></div>)}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" | "success" | "warning" | "danger" }) {
  const t = { muted: "bg-muted text-muted-foreground", primary: "bg-primary/10 text-primary", success: "bg-success/15 text-success", warning: "bg-warning/20 text-burgundy-dark", danger: "bg-destructive/10 text-destructive" }[tone];
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", t)}>{children}</span>;
}

/** Confirmation dialog for sensitive actions. When minReason > 0 a reason is required. */
export function ConfirmAction({ trigger, title, description, confirmLabel = "Konfirmasi", minReason = 0, destructive, onConfirm, disabled }: {
  trigger: (open: () => void) => ReactNode; title: string; description?: ReactNode; confirmLabel?: string; minReason?: number; destructive?: boolean; disabled?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tooShort = minReason > 0 && reason.trim().length < minReason;
  const run = async () => {
    if (tooShort) { setErr(`Alasan minimal ${minReason} karakter`); return; }
    setBusy(true); setErr(null);
    try { await onConfirm(reason.trim()); setOpen(false); setReason(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Gagal"); }
    finally { setBusy(false); }
  };
  return (
    <>
      {trigger(() => { if (!disabled) { setErr(null); setOpen(true); } })}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription asChild><div>{description}</div></DialogDescription>}</DialogHeader>
          {minReason > 0 && (
            <div className="space-y-1">
              <Label htmlFor="confirm-reason">Alasan (wajib, min. {minReason} karakter)</Label>
              <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} aria-invalid={!!err} />
            </div>
          )}
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
            <Button variant={destructive ? "destructive" : "default"} onClick={run} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Field({ label, htmlFor, children, error, hint }: { label: string; htmlFor: string; children: ReactNode; error?: string | undefined; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">{label}</Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
