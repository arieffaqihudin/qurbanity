import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, ProgramFilter, Tag, ConfirmAction, Empty, NativeSelect, Pager, DataTable, PendingIntegration } from "@/components/admin/ui";
import { rpc, useAdmin, LEDGER_LABEL } from "@/lib/admin";
import { formatRupiah, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/keuangan")({
  head: () => ({ meta: [{ title: "Rekonsiliasi Keuangan | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="finance.view"><Page /></Guard>,
});

const PAGE = 25;

export function LedgerTable({ program, account, title }: { program: string; account: string; title: string }) {
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["admin", "ledger", program, account, page], placeholderData: keepPreviousData,
    queryFn: async () => {
      let r = supabase.from("ledger_entries").select("*, qurban_commitments(code)", { count: "exact" }).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (program) r = r.eq("program_id", program);
      if (account) r = r.or(`source_account.eq.${account},dest_account.eq.${account}`);
      const res = await r;
      if (res.error) throw new Error(res.error.message);
      return { rows: res.data ?? [], total: res.count ?? 0 };
    },
  });
  return (
    <Panel title={title}>
      {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <DataTable rows={q.data.rows} rowKey={(r) => r.id} empty={<Empty title="Belum ada entri ledger" text="Entri hanya dibuat oleh proses terverifikasi (pembayaran, penguncian alokasi, pembalikan)." />} cols={[
            { label: "Waktu", primary: true, cell: (r) => formatDate(new Date(r.created_at), { dateStyle: "medium", timeStyle: "short" }) },
            { label: "Dari → Ke", cell: (r) => <span className="text-xs">{LEDGER_LABEL[r.source_account]} → {LEDGER_LABEL[r.dest_account]}</span> },
            { label: "Nominal", className: "text-right tabular-nums", cell: (r) => formatRupiah(r.amount) },
            { label: "Referensi", cell: (r) => <span className="text-xs">{r.reference}{r.qurban_commitments?.code ? ` · ${r.qurban_commitments.code}` : ""}{r.is_fixture && <Tag tone="warning">Fixture</Tag>}</span> },
            { label: "Dasar", cell: (r) => <span className="text-xs">{r.basis}</span> },
            { label: "Sumber", cell: (r) => <span className="text-xs">{r.actor_id ? "Admin" : r.system_source}</span> },
            { label: "Aksi", cell: (r) => can("finance.manage") && !r.reverses_id ? (
              <ConfirmAction title="Buat entri pembalik?" description="Entri asli tidak dihapus. Sistem membuat entri berlawanan dan menolak bila saldo akun tujuan tidak mencukupi." minReason={5} confirmLabel="Balikkan"
                onConfirm={async (reason) => { await rpc("admin_reverse_entry", { p_entry_id: r.id, p_reason: reason }); toast.success("Entri pembalik dibuat"); qc.invalidateQueries({ queryKey: ["admin", "ledger"] }); qc.invalidateQueries({ queryKey: ["admin", "balances"] }); }}
                trigger={(o) => <button type="button" className="text-xs font-semibold text-primary underline" onClick={o}>Balikkan</button>} />
            ) : r.reverses_id ? <Tag>Pembalik</Tag> : null },
          ]} />
          <Pager page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}

export function Balances({ program, only }: { program: string; only?: string[] }) {
  const q = useQuery({ queryKey: ["admin", "balances", program], queryFn: () => rpc<{ account: string; balance: number; entries: number }[]>("admin_ledger_balances", { p_program_id: program || null }) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failure error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data.filter((r) => !only || only.includes(r.account));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((r) => (
        <div key={r.account} className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] font-bold text-muted-foreground">{r.account}</p>
          <p className="text-xs text-muted-foreground">{LEDGER_LABEL[r.account]}</p>
          <p className={`mt-1 font-extrabold tabular-nums ${r.account !== "EXTERNAL" && r.balance < 0 ? "text-destructive" : "text-burgundy-dark"}`}>{formatRupiah(r.balance)}</p>
          <p className="text-[11px] text-muted-foreground">{r.entries} entri</p>
        </div>
      ))}
    </div>
  );
}

function Page() {
  const [program, setProgram] = useState("");
  const [account, setAccount] = useState("");
  const recon = useQuery({
    queryKey: ["admin", "recon", program],
    queryFn: async () => {
      let r = supabase.from("qurban_commitments").select("id, verified_paid_amount");
      if (program) r = r.eq("program_id", program);
      const c = await r; if (c.error) throw new Error(c.error.message);
      const bal = await rpc<{ account: string; balance: number }[]>("admin_ledger_balances", { p_program_id: program || null });
      const received = -(bal.find((b) => b.account === "EXTERNAL")?.balance ?? 0);
      const paid = (c.data ?? []).reduce((s, x) => s + x.verified_paid_amount, 0);
      return { received, paid, matched: received === paid };
    },
  });
  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <PageHead to="/admin/keuangan" actions={<ProgramFilter value={program} onChange={setProgram} />}>
        <p className="mt-1 text-xs text-muted-foreground">Ledger bersifat append-only: tidak ada penghapusan, koreksi melalui entri pembalik, saldo akun sumber tidak boleh negatif, dan setiap posting memiliki referensi, dasar, kunci idempoten, dan pelaku.</p>
      </PageHead>
      <PendingIntegration title="Pembayaran belum terhubung">Belum ada pembayaran terverifikasi yang masuk. Saldo dan entri di bawah adalah data asli dari ledger (saat ini kosong). Tidak ada transaksi contoh yang dibuat.</PendingIntegration>
      <Balances program={program} />
      <Panel title="Status rekonsiliasi" dense>
        {recon.isPending ? <Loading /> : recon.isError ? <Failure error={recon.error} /> : (
          <p className="text-sm">Dana masuk di ledger (EXTERNAL → keluar): <b className="tabular-nums">{formatRupiah(recon.data.received)}</b> · Total terverifikasi di komitmen: <b className="tabular-nums">{formatRupiah(recon.data.paid)}</b> · {recon.data.matched ? <Tag tone="success">Cocok</Tag> : <Tag tone="danger">Selisih — perlu ditelusuri</Tag>}</p>
        )}
      </Panel>
      <div className="flex justify-end"><NativeSelect label="Filter akun" value={account} onChange={setAccount}><option value="">Semua akun</option>{Object.keys(LEDGER_LABEL).map((k) => <option key={k} value={k}>{k} · {LEDGER_LABEL[k]}</option>)}</NativeSelect></div>
      <LedgerTable program={program} account={account} title="Entri ledger" />
    </div>
  );
}
