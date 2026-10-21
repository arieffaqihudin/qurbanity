import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/site/Countdown";
import { PadangKurban } from "@/components/portal/PadangKurban";
import { Card, EmptyState, ErrorState, ExecutionBadge, ExecutionTimeline, LoadingState, PaymentBadge, ProgressBar } from "@/components/portal/StatusUI";
import { commitmentsQuery, FREQ_LABEL, FREQ_UNIT, profileQuery, programQuery, progressPct } from "@/lib/portal-data";
import { formatDate, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Dashboard | Portal Peserta qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()));
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

function Dashboard() {
  const profile = useQuery(profileQuery);
  const program = useQuery(programQuery);
  const list = useQuery(commitmentsQuery);
  const [sel, setSel] = useState<string | null>(null);

  if (list.isPending || program.isPending) return <LoadingState />;
  if (list.isError) return <ErrorState message={list.error.message} onRetry={() => list.refetch()} />;

  const items = list.data;
  const c = items.find((x) => x.id === sel) ?? items[0];
  const first = profile.data?.full_name.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{greeting()},</p>
          <h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">{first ? `${first} 👋` : "Peserta"}</h1>
        </div>
        <Button asChild><Link to="/portal/kurban-baru"><Plus /> Komitmen baru</Link></Button>
      </div>

      {program.data && (
        <section className="relative overflow-hidden rounded-2xl bg-burgundy-gradient p-5 text-ivory md:p-6">
          <div className="pattern-dots absolute inset-0 opacity-40" aria-hidden />
          <div className="relative grid gap-5 md:grid-cols-[1fr_1.4fr] md:items-center">
            <div>
              <p className="text-sm font-semibold text-cream/80">Program aktif</p>
              <p className="text-xl font-extrabold">{program.data.name}</p>
              <p className="mt-1 text-sm text-cream/80">Batas pelunasan: {formatDate(new Date(program.data.payment_deadline))}</p>
            </div>
            <Countdown compact target={new Date(`${program.data.iduladha_date}T07:00:00+07:00`)} />
          </div>
        </section>
      )}

      {!c ? (
        <EmptyState title="Belum ada komitmen kurban" text="Pilih hewan, kunci harganya, lalu cicil sesuai kemampuanmu." action={<Button asChild><Link to="/portal/kurban-baru">Mulai komitmen pertama</Link></Button>} />
      ) : (
        <>
          {items.length > 1 && (
            <div role="tablist" aria-label="Pilih komitmen" className="flex gap-2 overflow-x-auto pb-1">
              {items.map((x) => (
                <button key={x.id} role="tab" aria-selected={x.id === c.id} onClick={() => setSel(x.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${x.id === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}>
                  {x.code} · {x.category_name_snapshot}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap items-center gap-2"><PaymentBadge status={c.payment_status} /><ExecutionBadge status={c.execution_status} /></div>
                <p className="mt-4 text-sm text-muted-foreground">Terbayar & terverifikasi</p>
                <p className="text-3xl font-extrabold tabular-nums text-primary md:text-4xl">{formatRupiah(c.verified_paid_amount)}</p>
                <p className="text-sm text-muted-foreground">dari {formatRupiah(c.total_amount)}</p>
                <div className="mt-4"><ProgressBar pct={progressPct(c)} label="Progres pembayaran terverifikasi" /></div>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-muted-foreground">Sisa</dt><dd className="font-bold tabular-nums">{formatRupiah(Math.max(0, c.total_amount - c.verified_paid_amount))}</dd></div>
                  <div><dt className="text-muted-foreground">Saran setoran</dt><dd className="font-bold tabular-nums">{c.payment_plans ? `${formatRupiah(c.payment_plans.suggested_amount)} / ${FREQ_UNIT[c.payment_plans.frequency]}` : "-"}</dd></div>
                  <div><dt className="text-muted-foreground">Rencana</dt><dd className="font-bold">{c.payment_plans ? FREQ_LABEL[c.payment_plans.frequency] : "-"}</dd></div>
                </dl>
                <p className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">Progres hanya dihitung dari pembayaran yang sudah diverifikasi. Fitur pembayaran akan tersedia pada tahap berikutnya.</p>
              </Card>
              <PadangKurban kind={c.animal_kind_snapshot} pct={progressPct(c)} name={c.animal_label ?? `${c.category_name_snapshot}${c.animal_kind_snapshot === "sapi" ? ` · ${c.shares}/7 bagian` : ""}`} code={c.code} />
            </div>
            <div className="space-y-6">
              <Card title="Shahibul kurban">
                <ul className="space-y-1.5">
                  {[...c.qurban_shares].sort((a, b) => a.position - b.position).map((s) => <li key={s.position} className="flex gap-2 text-sm"><span className="w-5 text-muted-foreground">{s.position}.</span><span className="font-semibold">{s.shahibul_name}</span></li>)}
                </ul>
              </Card>
              <Card title="Perjalanan kurban"><ExecutionTimeline status={c.execution_status} /></Card>
              <Button variant="outline" className="w-full" asChild><Link to="/portal/kurban-saya/$id" params={{ id: c.id }}>Lihat detail komitmen <ArrowRight /></Link></Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
