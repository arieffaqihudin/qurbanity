import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import { PageHead, Panel, Guard, Loading, Failure, ProgramFilter, Empty } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { rpc, useAdmin, toCsv, toExcelHtml, download } from "@/lib/admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/laporan")({
  head: () => ({ meta: [{ title: "Laporan | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="reports.view"><Page /></Guard>,
});

const REPORTS: { key: string; label: string; perm?: string; group: string }[] = [
  { key: "transaksi", label: "Transaksi", group: "Keuangan", perm: "finance.view" }, { key: "keuangan", label: "Keuangan per Akun", group: "Keuangan", perm: "finance.view" },
  { key: "peserta", label: "Peserta", group: "Peserta & Akad", perm: "participants.view" }, { key: "kategori", label: "Kategori Hewan", group: "Operasional" }, { key: "akad", label: "Akad & Persetujuan", group: "Peserta & Akad" },
  { key: "alokasi", label: "Alokasi", group: "Operasional" }, { key: "sedekah", label: "Sedekah", group: "Keuangan", perm: "finance.view" }, { key: "pengembalian", label: "Pengembalian", group: "Keuangan", perm: "finance.view" },
  { key: "penggunaan", label: "Penggunaan Dana", group: "Keuangan", perm: "finance.view" }, { key: "penyaluran", label: "Penyaluran", group: "Operasional" }, { key: "penerima", label: "Penerima Manfaat", group: "Operasional" },
  { key: "audit", label: "Audit", group: "Ringkasan & Audit", perm: "audit.view" }, { key: "eksekutif", label: "Eksekutif", group: "Ringkasan & Audit" },
];

const PREVIEW = 100;
const human = (c: string) => c.replace(/_/g, " ").replace(/^./, (m) => m.toUpperCase());

function Page() {
  const { can } = useAdmin();
  const [kind, setKind] = useState("kategori");
  const [program, setProgram] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const q = useQuery({ queryKey: ["admin", "report", kind, program], queryFn: () => rpc<Record<string, unknown>[]>("admin_report", { p_kind: kind, p_program_id: program || null, p_export: false }) });
  const label = REPORTS.find((r) => r.key === kind)!.label;
  const exportAs = async (fmt: "csv" | "xls") => {
    try {
      // Server re-checks reports.export and logs the export in the audit trail.
      const rows = await rpc<Record<string, unknown>[]>("admin_report", { p_kind: kind, p_program_id: program || null, p_export: true });
      const name = `laporan-${kind}-${new Date().toISOString().slice(0, 10)}`;
      if (fmt === "csv") download(`${name}.csv`, toCsv(rows), "text/csv;charset=utf-8");
      else download(`${name}.xls`, toExcelHtml(rows, label), "application/vnd.ms-excel");
    } catch (e) { toast.error((e as Error).message); }
  };
  const rows = q.data ?? [];
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const sorted = sort ? [...rows].sort((a, b) => { const x = a[sort.col] as never, y = b[sort.col] as never; return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; }) : rows;
  const preview = sorted.slice(0, PREVIEW);
  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <PageHead to="/admin/laporan" actions={<ProgramFilter value={program} onChange={setProgram} />} />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 print:hidden" aria-label="Jenis laporan">
        {["Keuangan", "Peserta & Akad", "Operasional", "Ringkasan & Audit"].map((g) => (
          <fieldset key={g} className="rounded-xl border border-border bg-card p-2">
            <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-primary">{g}</legend>
            <div className="flex flex-wrap gap-1">
              {REPORTS.filter((r) => r.group === g).map((r) => {
                const ok = !r.perm || can(r.perm);
                return (
                  <button key={r.key} type="button" aria-pressed={kind === r.key} disabled={!ok} title={ok ? undefined : "Peranmu tidak memiliki akses ke laporan ini"} onClick={() => { setKind(r.key); setSort(null); }}
                    className={cn("rounded-md border px-2.5 py-1.5 text-xs font-semibold", kind === r.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40", !ok && "cursor-not-allowed opacity-40")}>
                    {r.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <Panel title={label} action={can("reports.export") && rows.length > 0 && (
        <div className="flex gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={() => exportAs("csv")}><Download className="size-4" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportAs("xls")}><Download className="size-4" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-4" /> PDF</Button>
        </div>
      )}>
        {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <Empty title="Belum ada data untuk laporan ini" text="Laporan disusun dari data yang benar-benar tersimpan." /> : kind === "eksekutif" ? (
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(rows[0] ?? {}).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border p-3"><dt className="text-xs font-semibold text-muted-foreground">{human(k)}</dt><dd className="mt-0.5 break-words font-bold tabular-nums text-burgundy-dark">{fmt(v)}</dd></div>
          ))}</dl>
        ) : (
          <>
          <p className="mb-2 text-xs text-muted-foreground" role="status">Pratinjau {preview.length} dari {rows.length} baris · {cols.length} kolom.{rows.length > PREVIEW && " Unduh untuk melihat seluruh baris."} Klik judul kolom untuk mengurutkan.</p>
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/40"><tr className="border-b border-border text-left">{cols.map((c) => <th key={c} scope="col" aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : undefined} className={cn("whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground", typeof rows[0]?.[c] === "number" && "text-right")}><button type="button" className="uppercase tracking-wide hover:text-primary" onClick={() => setSort((s) => (s?.col === c ? (s.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 }))}>{human(c)}{sort?.col === c ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</button></th>)}</tr></thead>
              <tbody>{preview.map((r, i) => <tr key={i} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">{cols.map((c) => <td key={c} className={cn("px-4 py-3 align-middle", typeof r[c] === "number" && "text-right tabular-nums")}>{fmt(r[c])}</td>)}</tr>)}</tbody>
            </table>
          </div>
          </>
        )}
      </Panel>
      {!can("reports.export") && <p className="text-xs text-muted-foreground">Peranmu dapat melihat laporan tetapi tidak dapat mengekspornya.</p>}
    </div>
  );
}

function fmt(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return new Intl.NumberFormat("id-ID").format(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
