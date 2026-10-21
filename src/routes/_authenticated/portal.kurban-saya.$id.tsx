import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, FileText, Receipt } from "lucide-react";
import { Card, EmptyState, ErrorState, ExecutionBadge, ExecutionTimeline, LoadingState, PaymentBadge, ProgressBar } from "@/components/portal/StatusUI";
import { PadangKurban } from "@/components/portal/PadangKurban";
import { commitmentQuery, FREQ_LABEL, FREQ_UNIT, progressPct } from "@/lib/portal-data";
import { formatDate, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/kurban-saya/$id")({
  head: () => ({ meta: [{ title: "Detail Komitmen | Portal Peserta qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

const PUB: Record<string, string> = { full: "Nama lengkap", masked: "Nama disamarkan", private: "Tidak dipublikasikan" };

function Page() {
  const { id } = Route.useParams();
  const q = useQuery(commitmentQuery(id));
  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const c = q.data;
  if (!c) return <EmptyState title="Komitmen tidak ditemukan" text="Komitmen ini tidak ada atau bukan milik akunmu." action={<Link to="/portal/kurban-saya" className="font-semibold text-primary">Kembali ke Kurban Saya</Link>} />;
  const pct = progressPct(c);
  const pub = [...c.participant_publication_consents].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/portal/kurban-saya" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="size-4" /> Kurban Saya</Link>
      <div>
        <p className="text-sm font-semibold text-muted-foreground">{c.code}</p>
        <h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">{c.category_name_snapshot}{c.animal_kind_snapshot === "sapi" && ` · ${c.shares === 7 ? "1 ekor penuh" : `${c.shares}/7 bagian`}`}</h1>
        <div className="mt-2 flex flex-wrap gap-2"><PaymentBadge status={c.payment_status} /><ExecutionBadge status={c.execution_status} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Progres pembayaran">
          <p className="text-3xl font-extrabold tabular-nums text-primary">{formatRupiah(c.verified_paid_amount)}</p>
          <p className="text-sm text-muted-foreground">terverifikasi dari {formatRupiah(c.total_amount)} · {pct}%</p>
          <div className="mt-3"><ProgressBar pct={pct} label="Progres pembayaran" /></div>
          {c.payment_plans && <p className="mt-4 text-sm">Rencana {FREQ_LABEL[c.payment_plans.frequency].toLowerCase()}: saran <strong className="tabular-nums">{formatRupiah(c.payment_plans.suggested_amount)}</strong> per {FREQ_UNIT[c.payment_plans.frequency]} hingga {formatDate(new Date(c.payment_plans.deadline))}.</p>}
        </Card>
        <Card title="Status pelaksanaan">
          <ExecutionTimeline status={c.execution_status} />
          <p className="mt-4 text-xs text-muted-foreground">Status pelaksanaan terpisah dari status pembayaran. Lunas tidak berarti kurban sudah dilaksanakan.</p>
        </Card>
      </div>

      <Card title="Rincian harga (terkunci)" action={<span className="inline-flex items-center gap-1 text-xs font-bold text-primary"><Lock className="size-3.5" /> Snapshot akad</span>}>
        <dl className="space-y-2 text-sm">
          <Row k="Harga hewan" v={formatRupiah(c.animal_cost_snapshot)} />
          <Row k="Biaya operasional" v={formatRupiah(c.operational_cost_snapshot)} />
          {c.rounding_adjustment !== 0 && <Row k="Pembulatan" v={formatRupiah(c.rounding_adjustment)} />}
          <Row k={`Harga per ${c.animal_kind_snapshot === "sapi" ? "bagian" : "ekor"} × ${c.shares}`} v={`${formatRupiah(c.price_per_share_snapshot)} × ${c.shares}`} />
          <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold"><dt>Total komitmen</dt><dd className="tabular-nums text-primary">{formatRupiah(c.total_amount)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Dikunci pada {formatDate(new Date(c.created_at), { dateStyle: "long", timeStyle: "short" })} WIB. Perubahan harga setelahnya tidak memengaruhi komitmen ini.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Shahibul kurban">
          <ul className="space-y-1.5">{[...c.qurban_shares].sort((a, b) => a.position - b.position).map((s) => <li key={s.position} className="text-sm"><span className="text-muted-foreground">{s.position}. </span><strong>{s.shahibul_name}</strong></li>)}</ul>
          <p className="mt-3 text-sm text-muted-foreground">Publikasi nama: <strong className="text-foreground">{pub ? PUB[pub.preference] : "-"}</strong></p>
        </Card>
        <Card title="Ringkasan akad">
          <ul className="space-y-2 text-sm">
            {c.contract_consents.map((k) => (
              <li key={k.id} className="flex items-start justify-between gap-3">
                <span><strong>{k.contract_code.replace("akad_", "Akad ").toUpperCase().replace("AKAD", "Akad")}</strong> · versi {k.contract_version}{k.contract_status_at_consent === "draft" && <span className="ml-1 rounded bg-burgundy/10 px-1.5 text-xs font-bold text-burgundy">draf</span>}</span>
                <span className={k.decision === "accepted" ? "font-bold text-success" : "font-bold text-muted-foreground"}>{k.decision === "accepted" ? "Disetujui" : "Tidak disetujui"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Dicatat {c.contract_consents[0] && formatDate(new Date(c.contract_consents[0].consented_at), { dateStyle: "medium", timeStyle: "short" })} WIB. Catatan persetujuan tidak dapat diubah.</p>
        </Card>
      </div>

      <PadangKurban kind={c.animal_kind_snapshot} pct={pct} name={c.animal_label ?? c.category_name_snapshot} code={c.code} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Riwayat pembayaran"><div className="flex gap-3 text-sm text-muted-foreground"><Receipt className="size-5 shrink-0" />Belum ada pembayaran. Riwayat akan tampil setelah modul pembayaran aktif.</div></Card>
        <Card title="Dokumen"><div className="flex gap-3 text-sm text-muted-foreground"><FileText className="size-5 shrink-0" />Sertifikat dan laporan kurban akan tersedia di sini.</div></Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="tabular-nums font-semibold">{v}</dd></div>;
}
