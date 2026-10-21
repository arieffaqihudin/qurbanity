import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ExecutionBadge, LoadingState, PaymentBadge, ProgressBar } from "@/components/portal/StatusUI";
import { commitmentsQuery, progressPct } from "@/lib/portal-data";
import { formatDate, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/kurban-saya/")({
  head: () => ({ meta: [{ title: "Kurban Saya | Portal Peserta qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const q = useQuery(commitmentsQuery);
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">Kurban Saya</h1><p className="text-muted-foreground">Semua komitmen kurbanmu, dengan harga yang terkunci saat akad.</p></div>
        <Button asChild><Link to="/portal/kurban-baru"><Plus /> Komitmen baru</Link></Button>
      </div>
      {q.isPending ? <LoadingState /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : q.data.length === 0 ? (
        <EmptyState title="Belum ada komitmen" text="Komitmen yang kamu buat akan muncul di sini." action={<Button asChild><Link to="/portal/kurban-baru">Buat komitmen</Link></Button>} />
      ) : (
        <ul className="space-y-3">
          {q.data.map((c) => (
            <li key={c.id}>
              <Link to="/portal/kurban-saya/$id" params={{ id: c.id }} className="group block rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">{c.code} · dibuat {formatDate(new Date(c.created_at), { dateStyle: "medium" })}</p>
                    <p className="text-lg font-extrabold text-burgundy-dark">{c.category_name_snapshot}{c.animal_kind_snapshot === "sapi" && ` · ${c.shares === 7 ? "1 ekor penuh" : `${c.shares}/7 bagian`}`}</p>
                  </div>
                  <ChevronRight className="mt-1 size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2"><PaymentBadge status={c.payment_status} /><ExecutionBadge status={c.execution_status} /></div>
                <div className="mt-4 flex items-center justify-between text-sm"><span className="tabular-nums">{formatRupiah(c.verified_paid_amount)} / {formatRupiah(c.total_amount)}</span><span className="font-bold">{progressPct(c)}%</span></div>
                <div className="mt-2"><ProgressBar pct={progressPct(c)} label={`Progres ${c.code}`} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
