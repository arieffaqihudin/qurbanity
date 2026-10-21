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

const REPORTS: { key: string; label: string; perm?: string }[] = [
  { key: "transaksi", label: "Transaksi", perm: "finance.view" }, { key: "keuangan", label: "Keuangan per Akun", perm: "finance.view" },
  { key: "peserta", label: "Peserta", perm: "participants.view" }, { key: "kategori", label: "Kategori Hewan" }, { key: "akad", label: "Akad & Persetujuan" },
  { key: "alokasi", label: "Alokasi" }, { key: "sedekah", label: "Sedekah", perm: "finance.view" }, { key: "pengembalian", label: "Pengembalian", perm: "finance.view" },
  { key: "penggunaan", label: "Penggunaan Dana", perm: "finance.view" }, { key: "penyaluran", label: "Penyaluran" }, { key: "penerima", label: "Penerima Manfaat" },
  { key: "audit", label: "Audit", perm: "audit.view" }, { key: "eksekutif", label: "Eksekutif" },
];

function Page() {
  const { can } = useAdmin();
  const [kind, setKind] = useState("kategori");
  const [program, setProgram] = useState("");
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
  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <PageHead to="/admin/laporan" actions={<ProgramFilter value={program} onChange={setProgram} />} />
      <div className="flex flex-wrap gap-1.5 print:hidden" role="tablist" aria-label="Kategori laporan">
        {REPORTS.map((r, i) => {
          const ok = !r.perm || can(r.perm);
          return (
            <button key={r.key} type="button" role="tab" aria-selected={kind === r.key} disabled={!ok} onClick={() => setKind(r.key)}
              className={cn("rounded-full border px-3 py-1 text-xs font-semibold", kind === r.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40", !ok && "cursor-not-allowed opacity-40")}>
              {i + 1}. {r.label}
            </button>
          );
        })}
      </div>
      <Panel title={label} action={can("reports.export") && rows.length > 0 && (
        <div className="flex gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={() => exportAs("csv")}><Download className="size-4" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportAs("xls")}><Download className="size-4" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-4" /> PDF</Button>
        </div>
      )}>
        {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <Empty title="Belum ada data untuk laporan ini" text="Laporan disusun dari data yang benar-benar tersimpan." /> : kind === "eksekutif" ? (
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs">{JSON.stringify(rows[0], null, 2)}</pre>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card"><tr className="border-b border-border text-left">{cols.map((c) => <th key={c} scope="col" className="px-2 py-1.5 font-semibold">{c}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border/50">{cols.map((c) => <td key={c} className="px-2 py-1 align-top">{fmt(r[c])}</td>)}</tr>)}</tbody>
            </table>
          </div>
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
