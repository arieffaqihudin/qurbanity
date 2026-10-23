import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PaymentBadge,
  ProgressBar,
} from "@/components/portal/StatusUI";
import { commitmentsQuery, progressPct } from "@/lib/portal-data";
import { formatRupiah } from "@/lib/format";
import { SandboxBanner } from "@/components/portal/PaymentUI";

export const Route = createFileRoute("/_authenticated/portal/bayar")({
  head: () => ({
    meta: [{ title: "Bayar | Portal Peserta qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

function Page() {
  const q = useQuery(commitmentsQuery);
  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">Bayar</h1>
        <p className="mt-1 text-muted-foreground">
          Pilih komitmen yang ingin kamu bayar. Nominal fleksibel.
        </p>
      </div>
      <SandboxBanner />
      {q.data.length === 0 ? (
        <EmptyState
          title="Belum ada komitmen kurban"
          text="Buat komitmen terlebih dahulu untuk mulai membayar."
          action={
            <Button asChild>
              <Link to="/portal/kurban-baru">Mulai komitmen</Link>
            </Button>
          }
        />
      ) : (
        q.data.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{c.code}</p>
                <p className="font-extrabold text-burgundy-dark">{c.category_name_snapshot}</p>
              </div>
              <PaymentBadge status={c.payment_status} />
            </div>
            <div className="mt-3">
              <ProgressBar pct={progressPct(c)} label="Progres" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatRupiah(c.verified_paid_amount)} dari {formatRupiah(c.total_amount)}
            </p>
            <Button
              className="mt-4"
              disabled={progressPct(c) >= 100}
              asChild={progressPct(c) < 100}
            >
              {progressPct(c) < 100 ? (
                <Link to="/bayar/$id" params={{ id: c.id }}>
                  Bayar Sekarang
                </Link>
              ) : (
                <span>Sudah lunas</span>
              )}
            </Button>
          </Card>
        ))
      )}
    </div>
  );
}
