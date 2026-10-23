import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  ShieldAlert,
  AlertTriangle,
  Search,
  Plug,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminItem, adminHubOf } from "@/lib/navigation";
import {
  displayAdminLabel,
  friendlyDbError,
  programsQuery,
  PROGRAM_STATUS_LABEL,
  useAdmin,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

const num = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export function PageHead({
  to,
  actions,
  count,
  children,
}: {
  to: string;
  actions?: ReactNode;
  count?: number | undefined;
  children?: ReactNode;
}) {
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
          <Link to="/admin" className="hover:text-primary">
            Admin
          </Link>{" "}
          <span aria-hidden>›</span> {found.group}
          {isHub && (
            <>
              {" "}
              <span aria-hidden>›</span> {title}
            </>
          )}
        </nav>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 sm:flex sm:flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-burgundy-dark md:text-2xl">
            {title}
            {count !== undefined && (
              <span className="ml-2 align-middle text-sm font-semibold text-muted-foreground">
                (Total {num(count)})
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{it.description}</p>
          {children}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {isHub && (
        <nav
          aria-label={`Bagian ${title}`}
          className="-mx-1 mt-3 flex gap-1 overflow-x-auto border-b border-border px-1"
        >
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              aria-current={t.to === to ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                t.to === to
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
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
    <div
      role="alert"
      className="mx-auto mt-8 max-w-md rounded-xl border border-border bg-card p-6 text-center"
    >
      <ShieldAlert className="mx-auto size-8 text-primary" />
      <h2 className="mt-2 font-extrabold text-burgundy-dark">Akses tidak diizinkan</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Anda tidak memiliki akses ke bagian ini. Hubungi pengelola bila perlu.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/admin">Kembali</Link>
      </Button>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  dense,
  id,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  dense?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("rounded-2xl border border-border bg-card", dense ? "p-3" : "p-4", className)}
    >
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title && (
            <h2 className="text-sm font-extrabold text-burgundy-dark md:text-base">{title}</h2>
          )}
          {action && <div className="ml-auto flex flex-wrap gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  to,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  to?: string;
  tone?: "attention";
}) {
  const body = (
    <>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold tabular-nums text-burgundy-dark md:text-xl">
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = cn(
    "block rounded-2xl border bg-card p-3",
    tone === "attention" ? "border-warning/50 bg-warning/5" : "border-border",
  );
  if (to)
    return (
      <Link
        to={to}
        className={cn(
          cls,
          "transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring",
        )}
      >
        {body}
        <span className="mt-1 block text-xs font-semibold text-primary">Lihat detail ›</span>
      </Link>
    );
  return <div className={cls}>{body}</div>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Memuat data" className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function Loading({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div role="status" className="space-y-2 p-1">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </span>
      <div className="h-9 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="h-9 w-4/5 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
    </div>
  );
}
export function Failure({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof Error ? friendlyDbError(error.message) : "Terjadi kendala. Silakan coba lagi.";
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <AlertTriangle className="size-4" />
      {message}
      {onRetry && (
        <Button size="sm" variant="outline" className="ml-auto" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
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
    <div className="rounded-2xl border-2 border-dashed border-burgundy/25 bg-card p-4">
      <div className="flex items-center gap-2">
        <Plug className="size-4 text-primary" />
        <p className="font-bold text-burgundy-dark">{title}</p>
        <span className="rounded-full bg-beige/60 px-2 py-0.5 text-[11px] font-bold text-burgundy-dark">
          Belum tersedia
        </span>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/** Debounced search field: onChange fires after the user stops typing. */
export function SearchBox({
  value,
  onChange,
  placeholder = "Cari…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (v === value) return;
    const t = setTimeout(() => onChange(v), 350);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 pl-8"
      />
    </div>
  );
}

export function NativeSelect({
  value,
  onChange,
  children,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function ProgramFilter({
  value,
  onChange,
  allowAll = true,
}: {
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
}) {
  const q = useQuery(programsQuery);
  return (
    <NativeSelect label="Periode program" value={value} onChange={onChange}>
      {allowAll && <option value="">Semua periode</option>}
      {(q.data ?? []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · {PROGRAM_STATUS_LABEL[p.status] ?? displayAdminLabel(p.status)}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Standard pagination: displayed range, optional rows-per-page selector, prev/next. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = [10, 25, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (s: number) => void;
  sizes?: number[];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span role="status">
        {num(from)}–{num(to)} dari {num(total)} data
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {onPageSize && (
          <label className="flex items-center gap-1.5">
            Tampilkan
            <select
              aria-label="Baris per halaman"
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <span>
          Halaman {num(page + 1)} dari {num(pages)}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Halaman sebelumnya"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Halaman berikutnya"
            disabled={page + 1 >= pages}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Standard data table: white rounded-2xl card, uppercase muted headers, thin row
 * separators, hover highlight, centered vertical alignment. `toolbar` renders above
 * the table (search/filters), `footer` below it (pagination). On phones rows become
 * stacked cards; `primary` marks the headline column, `hideOnMobile` drops a column.
 */
export function DataTable<T>({
  rows,
  cols,
  rowKey,
  empty,
  onRowClick,
  toolbar,
  footer,
}: {
  rows: T[];
  rowKey: (r: T) => string;
  empty?: ReactNode;
  onRowClick?: (r: T) => void;
  toolbar?: ReactNode;
  footer?: ReactNode;
  cols: {
    label: string;
    cell: (r: T) => ReactNode;
    className?: string;
    primary?: boolean;
    sort?: (r: T) => string | number;
    hideOnMobile?: boolean;
  }[];
}) {
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const sorter = sort ? cols[sort.i]?.sort : undefined;
  const view =
    sorter && sort
      ? [...rows].sort((a, b) => {
          const x = sorter(a),
            y = sorter(b);
          return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
        })
      : rows;
  const toggle = (i: number) =>
    setSort((s) => (s?.i === i ? (s.dir === 1 ? { i, dir: -1 } : null) : { i, dir: 1 }));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {toolbar}
        </div>
      )}
      {rows.length === 0 ? (
        (empty ?? <Empty title="Belum ada data" />)
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  {cols.map((c, i) => (
                    <th
                      key={i}
                      scope="col"
                      aria-sort={
                        sort?.i === i ? (sort.dir === 1 ? "ascending" : "descending") : undefined
                      }
                      className={cn(
                        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        c.className,
                      )}
                    >
                      {c.sort ? (
                        <button
                          type="button"
                          onClick={() => toggle(i)}
                          className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
                        >
                          {c.label}
                          {sort?.i === i ? (
                            sort.dir === 1 ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr
                    key={rowKey(r)}
                    onClick={
                      onRowClick
                        ? (e) => {
                            if (!(e.target as HTMLElement).closest("a,button,input,select"))
                              onRowClick(r);
                          }
                        : undefined
                    }
                    className={cn(
                      "border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40",
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {cols.map((c, i) => (
                      <td key={i} className={cn("px-4 py-3.5 align-middle", c.className)}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 md:hidden">
            {cols.some((c) => c.sort) && (
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                Urutkan
                <select
                  className="h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground"
                  value={sort ? `${sort.i}:${sort.dir}` : ""}
                  onChange={(e) => {
                    const [i, d] = e.target.value.split(":");
                    setSort(e.target.value ? { i: Number(i), dir: Number(d) as 1 | -1 } : null);
                  }}
                >
                  <option value="">Bawaan</option>
                  {cols.map(
                    (c, i) =>
                      c.sort && [
                        <option key={`${i}a`} value={`${i}:1`}>
                          {c.label} ↑
                        </option>,
                        <option key={`${i}d`} value={`${i}:-1`}>
                          {c.label} ↓
                        </option>,
                      ],
                  )}
                </select>
              </label>
            )}
            <ul className="space-y-2">
              {view.map((r) => (
                <li
                  key={rowKey(r)}
                  onClick={
                    onRowClick
                      ? (e) => {
                          if (!(e.target as HTMLElement).closest("a,button")) onRowClick(r);
                        }
                      : undefined
                  }
                  className={cn(
                    "rounded-xl border border-border bg-card p-3 text-sm",
                    onRowClick && "cursor-pointer active:bg-muted/40",
                  )}
                >
                  {cols
                    .filter((c) => !c.hideOnMobile)
                    .map((c, i) =>
                      c.primary ? (
                        <div key={i} className="mb-1 font-bold text-burgundy-dark">
                          {c.cell(r)}
                        </div>
                      ) : (
                        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                          <span className="text-xs text-muted-foreground">{c.label}</span>
                          <span className="min-w-0 text-right">{c.cell(r)}</span>
                        </div>
                      ),
                    )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </div>
  );
}

const TAG_STYLE = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-burgundy-dark",
  danger: "bg-destructive/10 text-destructive",
} as const;
const TAG_DOT = {
  muted: "bg-muted-foreground/60",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
} as const;

/** Compact status badge with a colored dot; the label carries the meaning, not the color alone. */
export function Tag({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: keyof typeof TAG_STYLE;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        TAG_STYLE[tone],
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TAG_DOT[tone])} />
      {children}
    </span>
  );
}

export interface RowActionField {
  key: string;
  label: string;
  type?: "text" | "datetime-local" | "select";
  placeholder?: string;
  value?: string;
  options?: { value: string; label: string }[];
}
export interface RowActionItem {
  label: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  confirm?: {
    title: string;
    description?: ReactNode;
    confirmLabel?: string;
    minReason?: number;
    fields?: RowActionField[];
  };
  onConfirm?: (reason: string, values: Record<string, string>) => Promise<void>;
}

/** Standard "AKSI" column: outlined ellipsis button opening a menu of permitted actions. */
export function RowActions({
  items,
  label = "Aksi baris",
}: {
  items: (RowActionItem | null | false | undefined)[];
  label?: string;
}) {
  const visible = items.filter((x): x is RowActionItem => !!x);
  const [active, setActive] = useState<RowActionItem | null>(null);
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!visible.length) return null;
  const open = (it: RowActionItem) => {
    setActive(it);
    setErr(null);
    setReason("");
    setValues(Object.fromEntries((it.confirm?.fields ?? []).map((f) => [f.key, f.value ?? ""])));
  };
  const tooShort = !!active?.confirm?.minReason && reason.trim().length < active.confirm.minReason;
  const run = async () => {
    if (!active?.onConfirm) return;
    if (tooShort) {
      setErr(`Alasan minimal ${active.confirm!.minReason} karakter`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await active.onConfirm(reason.trim(), values);
      setActive(null);
    } catch (e) {
      setErr(friendlyDbError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="outline" className="size-8" aria-label={label}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {visible.map((it, i) => (
            <Fragment key={it.label}>
              {it.separatorBefore && i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={!!it.disabled}
                className={cn(it.destructive && "text-destructive focus:text-destructive")}
                onSelect={() => (it.confirm ? open(it) : it.onSelect?.())}
              >
                {it.label}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={!!active} onOpenChange={(o) => !busy && !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active?.confirm?.title}</DialogTitle>
            {active?.confirm?.description && (
              <DialogDescription asChild>
                <div>{active.confirm.description}</div>
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            {(active?.confirm?.fields ?? []).map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`ra-${f.key}`} className="text-xs font-semibold">
                  {f.label}
                </Label>
                {f.type === "select" ? (
                  <select
                    id={`ra-${f.key}`}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {!f.value && <option value="">Pilih…</option>}
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`ra-${f.key}`}
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
            {!!active?.confirm?.minReason && (
              <div className="space-y-1">
                <Label htmlFor="ra-reason" className="text-xs font-semibold">
                  Alasan tindakan (minimal {active.confirm.minReason} karakter)
                </Label>
                <Textarea
                  id="ra-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  aria-invalid={!!err}
                />
              </div>
            )}
            {err && (
              <p role="alert" className="text-sm text-destructive">
                {err}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)} disabled={busy}>
              Batal
            </Button>
            <Button
              variant={active?.destructive ? "destructive" : "default"}
              onClick={run}
              disabled={busy}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {active?.confirm?.confirmLabel ?? "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Confirmation dialog for sensitive actions. When minReason > 0 a reason is required. */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Konfirmasi",
  minReason = 0,
  destructive,
  onConfirm,
  disabled,
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  minReason?: number;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tooShort = minReason > 0 && reason.trim().length < minReason;
  const run = async () => {
    if (tooShort) {
      setErr(`Alasan minimal ${minReason} karakter`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(reason.trim());
      setOpen(false);
      setReason("");
    } catch (e) {
      setErr(friendlyDbError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {trigger(() => {
        if (!disabled) {
          setErr(null);
          setOpen(true);
        }
      })}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription asChild>
                <div>{description}</div>
              </DialogDescription>
            )}
          </DialogHeader>
          {minReason > 0 && (
            <div className="space-y-1">
              <Label htmlFor="confirm-reason">Alasan tindakan (minimal {minReason} karakter)</Label>
              <Textarea
                id="confirm-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                aria-invalid={!!err}
              />
            </div>
          )}
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button variant={destructive ? "destructive" : "default"} onClick={run} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Field({
  label,
  htmlFor,
  children,
  error,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  error?: string | undefined;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Spec-named aliases of the shared admin table system.
export {
  PageHead as AdminPageHeader,
  DataTable as AdminDataTable,
  Pager as AdminTablePagination,
  Empty as AdminTableEmptyState,
  Loading as AdminTableSkeleton,
  Tag as AdminStatusBadge,
};
