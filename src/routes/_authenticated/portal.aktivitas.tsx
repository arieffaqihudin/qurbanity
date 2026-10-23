import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/portal/StatusUI";
import { PaymentStatusBadge } from "@/components/portal/PaymentUI";
import { methodLabel, myNotificationsQuery, myPaymentsQuery } from "@/lib/payments";
import { formatDate, formatRelativeTime, formatRupiah } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/portal/aktivitas")({
  head: () => ({
    meta: [
      { title: "Aktivitas & Riwayat | Portal Peserta qurbanity" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const pay = useQuery(myPaymentsQuery);
  const notif = useQuery(myNotificationsQuery);
  if (pay.isPending || notif.isPending) return <LoadingState />;
  if (pay.isError || notif.isError)
    return (
      <ErrorState
        message={(pay.error ?? notif.error)!.message}
        onRetry={() => {
          void pay.refetch();
          void notif.refetch();
        }}
      />
    );
  const read = async (id: string) => {
    await supabase
      .from("participant_notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("id", id);
    void qc.invalidateQueries({ queryKey: ["participant-notifications"] });
  };
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">
          Aktivitas & Riwayat
        </h1>
        <p className="mt-1 text-muted-foreground">
          Riwayat transaksi dan pemberitahuan pembayaran.
        </p>
      </div>
      <Card title="Riwayat transaksi">
        {pay.data.length === 0 ? (
          <EmptyState
            title="Belum ada transaksi"
            text="Transaksi pembayaranmu akan tampil di sini."
          />
        ) : (
          <ul className="divide-y divide-border">
            {pay.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <Link
                  to="/pembayaran/status/$orderId"
                  params={{ orderId: p.order_id }}
                  className="min-w-0"
                >
                  <b className="tabular-nums">{formatRupiah(p.amount)}</b>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.order_id} ·{" "}
                    {formatDate(new Date(p.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {methodLabel(p.payment_method)}
                  </span>
                </Link>
                <PaymentStatusBadge payment={p} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Pemberitahuan">
        {notif.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pemberitahuan.</p>
        ) : (
          <ul className="divide-y divide-border">
            {notif.data.map((n) => (
              <li key={n.id} className="py-3 text-sm">
                <button type="button" onClick={() => void read(n.id)} className="w-full text-left">
                  <span
                    className={n.read_at ? "font-semibold" : "font-extrabold text-burgundy-dark"}
                  >
                    {n.title}
                  </span>
                  <span className="block text-muted-foreground">{n.body}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(n.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Pemberitahuan email belum diaktifkan; semua pemberitahuan tampil di sini.
        </p>
      </Card>
    </div>
  );
}
