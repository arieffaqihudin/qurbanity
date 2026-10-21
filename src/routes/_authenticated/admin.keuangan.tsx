import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, ProgramFilter, Tag, NativeSelect, PendingIntegration } from "@/components/admin/ui";
import { LedgerTable, Balances } from "@/components/admin/finance";
import { rpc, LEDGER_LABEL } from "@/lib/admin";
import { formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/keuangan")({
  head: () => ({ meta: [{ title: "Rekonsiliasi Keuangan | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="finance.view"><Page /></Guard>,
});

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
