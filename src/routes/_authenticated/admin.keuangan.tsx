import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import {
  PageHead,
  Panel,
  Guard,
  Loading,
  Failure,
  ProgramFilter,
  Tag,
  NativeSelect,
  Kpi,
  DataTable,
  Empty,
} from "@/components/admin/ui";
import { LedgerTable } from "@/components/admin/finance";
import { Button } from "@/components/ui/button";
import { rpc, useAdmin, LEDGER_LABEL } from "@/lib/admin";
import { runReconciliation, SANDBOX_NOTICE } from "@/lib/payments";
import { formatDate, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/keuangan")({
  head: () => ({
    meta: [
      { title: "Rekonsiliasi Pembayaran | Admin qurbanity" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <Guard perms="finance.view">
      <Page />
    </Guard>
  ),
});

interface Summary {
  verified_amount: number;
  verified_count: number;
  pending_amount: number;
  pending_count: number;
  stale_pending_count: number;
  missing_ledger_count: number;
  sandbox_ledger_amount: number;
  commitment_mismatch_count: number;
  last_run: {
    started_at: string;
    trigger_source: string;
    mismatch_count: number;
    error_count: number;
  } | null;
}
interface Issue {
  payment_id: string | null;
  order_id: string | null;
  commitment_code: string;
  amount: number;
  created_at: string;
  kind: string;
  detail: string;
}
interface Run {
  id: string;
  trigger_source: string;
  started_at: string;
  checked_count: number;
  updated_count: number;
  expired_count: number;
  mismatch_count: number;
  error_count: number;
  actor_name: string | null;
}
interface Balance {
  account: string;
  balance: number;
  entries: number;
}

const fmt = (iso: string) => formatDate(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

function Page() {
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [program, setProgram] = useState("");
  const [account, setAccount] = useState("");
  const [running, setRunning] = useState(false);
  const arg = { p_program_id: program || null };
  const summary = useQuery({
    queryKey: ["admin", "recon-summary", program],
    queryFn: () => rpc<Summary>("admin_reconciliation_summary", arg),
  });
  const issues = useQuery({
    queryKey: ["admin", "recon-issues", program],
    queryFn: () => rpc<Issue[]>("admin_reconciliation_issues", arg),
  });
  const runs = useQuery({
    queryKey: ["admin", "recon-runs"],
    queryFn: () => rpc<Run[]>("admin_reconciliation_runs", { p_limit: 20 }),
  });
  const sandbox = useQuery({
    queryKey: ["admin", "sandbox-balances", program],
    queryFn: () => rpc<Balance[]>("admin_sandbox_ledger_balances", arg),
  });

  const run = async () => {
    setRunning(true);
    try {
      const r = await runReconciliation();
      toast.success(
        `Rekonsiliasi selesai: ${r.checked} diperiksa, ${r.updated} diperbarui, ${r.mismatch} ketidakcocokan.`,
      );
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rekonsiliasi gagal dijalankan.");
    } finally {
      setRunning(false);
    }
  };

  const s = summary.data;
  const mismatches = s
    ? s.commitment_mismatch_count +
      (issues.data?.filter((i) => i.kind === "ledger_without_success").length ?? 0)
    : 0;
  const unreconciled = s ? s.missing_ledger_count + s.stale_pending_count : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <PageHead
        to="/admin/keuangan"
        actions={
          <>
            <ProgramFilter value={program} onChange={setProgram} />
            {can("finance.manage") && (
              <Button size="sm" onClick={() => void run()} disabled={running}>
                {running ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}{" "}
                Jalankan rekonsiliasi
              </Button>
            )}
          </>
        }
      >
        <p className="mt-1 text-xs font-semibold text-burgundy-dark">
          {SANDBOX_NOTICE} Dana di halaman ini adalah dana uji coba dan tidak masuk laporan dana
          nyata.
        </p>
      </PageHead>

      {summary.isPending ? (
        <Panel>
          <Loading />
        </Panel>
      ) : summary.isError ? (
        <Panel>
          <Failure error={summary.error} onRetry={() => void summary.refetch()} />
        </Panel>
      ) : (
        s && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi
              label="Total Dana Terverifikasi"
              value={formatRupiah(s.verified_amount)}
              hint={`${s.verified_count} transaksi`}
            />
            <Kpi
              label="Pembayaran Menunggu"
              value={s.pending_count}
              hint={formatRupiah(s.pending_amount)}
            />
            <Kpi
              label="Ketidakcocokan Gateway"
              value={mismatches}
              {...(mismatches > 0 ? { tone: "attention" as const } : {})}
            />
            <Kpi
              label="Transaksi Belum Terekonsiliasi"
              value={unreconciled}
              {...(unreconciled > 0 ? { tone: "attention" as const } : {})}
            />
            <Kpi
              label="Rekonsiliasi Terakhir"
              value={s.last_run ? fmt(s.last_run.started_at) : "Belum pernah"}
              hint={
                s.last_run
                  ? s.last_run.trigger_source === "scheduled"
                    ? "Terjadwal"
                    : "Manual"
                  : (undefined as never)
              }
            />
          </div>
        )
      )}
      {s && s.verified_amount !== s.sandbox_ledger_amount && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          Dana terverifikasi ({formatRupiah(s.verified_amount)}) tidak sama dengan posting ledger
          uji coba ({formatRupiah(s.sandbox_ledger_amount)}). Tinjau daftar temuan di bawah.
        </p>
      )}

      <Panel title="Temuan yang perlu ditinjau" dense>
        {issues.isPending ? (
          <Loading />
        ) : issues.isError ? (
          <Failure error={issues.error} />
        ) : (
          <DataTable
            rows={issues.data}
            rowKey={(r) => `${r.kind}-${r.payment_id ?? r.commitment_code}`}
            empty={<Empty title="Tidak ada temuan" text="Semua catatan pembayaran cocok." />}
            cols={[
              {
                label: "Jenis",
                primary: true,
                cell: (r) => (
                  <Tag
                    tone={
                      r.kind === "stale_pending" || r.kind === "refund_review"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {r.detail}
                  </Tag>
                ),
              },
              {
                label: "Order",
                cell: (r) => <span className="break-all text-xs">{r.order_id ?? "—"}</span>,
              },
              { label: "Kode Kurban", cell: (r) => r.commitment_code },
              {
                label: "Nominal",
                className: "text-right tabular-nums",
                cell: (r) => formatRupiah(r.amount),
              },
              { label: "Tanggal", cell: (r) => fmt(r.created_at) },
            ]}
          />
        )}
      </Panel>

      <Panel title="Riwayat rekonsiliasi" dense>
        {runs.isPending ? (
          <Loading />
        ) : runs.isError ? (
          <Failure error={runs.error} />
        ) : (
          <DataTable
            rows={runs.data}
            rowKey={(r) => r.id}
            empty={
              <Empty
                title="Belum ada rekonsiliasi"
                text="Jalankan rekonsiliasi manual atau aktifkan jadwal otomatis."
              />
            }
            cols={[
              { label: "Waktu", primary: true, cell: (r) => fmt(r.started_at) },
              {
                label: "Pemicu",
                cell: (r) =>
                  r.trigger_source === "scheduled"
                    ? "Terjadwal"
                    : `Manual${r.actor_name ? ` · ${r.actor_name}` : ""}`,
              },
              { label: "Diperiksa", className: "tabular-nums", cell: (r) => r.checked_count },
              { label: "Diperbarui", className: "tabular-nums", cell: (r) => r.updated_count },
              { label: "Kedaluwarsa", className: "tabular-nums", cell: (r) => r.expired_count },
              {
                label: "Tidak cocok",
                className: "tabular-nums",
                cell: (r) =>
                  r.mismatch_count > 0 ? <Tag tone="danger">{r.mismatch_count}</Tag> : 0,
              },
              {
                label: "Kendala",
                className: "tabular-nums",
                cell: (r) => (r.error_count > 0 ? <Tag tone="danger">{r.error_count}</Tag> : 0),
              },
            ]}
          />
        )}
      </Panel>

      <Panel title="Saldo ledger uji coba (Midtrans Sandbox)" dense>
        {sandbox.isPending ? (
          <Loading />
        ) : sandbox.isError ? (
          <Failure error={sandbox.error} />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {sandbox.data
              .filter((b) => b.entries > 0)
              .map((b) => (
                <div key={b.account} className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-xs font-bold text-muted-foreground">
                    {LEDGER_LABEL[b.account] ?? "Akun dana lainnya"}
                  </p>
                  <p className="mt-1 font-extrabold tabular-nums text-burgundy-dark">
                    {formatRupiah(b.balance)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{b.entries} catatan</p>
                </div>
              ))}
            {sandbox.data.every((b) => b.entries === 0) && (
              <p className="text-sm text-muted-foreground">Belum ada posting uji coba.</p>
            )}
          </div>
        )}
      </Panel>

      <div className="flex justify-end">
        <NativeSelect label="Filter akun" value={account} onChange={setAccount}>
          <option value="">Semua akun</option>
          {Object.entries(LEDGER_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <LedgerTable program={program} account={account} title="Entri ledger (dana nyata)" />
    </div>
  );
}
