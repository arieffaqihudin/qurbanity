import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHead, Guard, ProgramFilter, PendingIntegration } from "@/components/admin/ui";
import { LedgerTable, Balances } from "@/components/admin/finance";

export const Route = createFileRoute("/_authenticated/admin/sedekah")({
  head: () => ({ meta: [{ title: "Sedekah & Kelebihan Dana | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="finance.view"><Page /></Guard>,
});

function Page() {
  const [program, setProgram] = useState("");
  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <PageHead to="/admin/sedekah" actions={<ProgramFilter value={program} onChange={setProgram} />} />
      <PendingIntegration title="Alur kelebihan dana, pengembalian, dan sedekah disiapkan">
        <ul className="list-disc space-y-0.5 pl-5">
          <li>Kelebihan dana dan pengembalian hanya muncul setelah ada pembayaran terverifikasi.</li>
          <li>Konversi ke sedekah hanya boleh dilakukan bila peserta menyetujui Akad 2B (SEDEKAH_TRANSFER) untuk komitmennya.</li>
          <li>Transfer pengembalian dana tetap dilakukan di luar sistem sampai integrasi pembayaran aktif; ledger mencatat keputusannya.</li>
        </ul>
      </PendingIntegration>
      <Balances program={program} only={["EXCESS", "SEDEKAH", "REFUND", "CANCEL_COST", "KUASA"]} />
      <LedgerTable program={program} account="EXCESS" title="Kelebihan dana" />
      <LedgerTable program={program} account="SEDEKAH" title="Sedekah" />
      <LedgerTable program={program} account="REFUND" title="Pengembalian dana" />
    </div>
  );
}
