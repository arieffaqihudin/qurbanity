import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, LoadingState, ProgressBar } from "@/components/portal/StatusUI";
import { PaymentLayout, PaymentStatusBadge } from "@/components/portal/PaymentUI";
import {
  displayStatus,
  methodLabel,
  paymentByOrderQuery,
  paymentEventsQuery,
  verifyPaymentStatus,
} from "@/lib/payments";
import { progressPct } from "@/lib/portal-data";
import { formatDate, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pembayaran/status/$orderId")({
  head: () => ({
    meta: [{ title: "Status Pembayaran | qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

const fmt = (iso: string) => formatDate(new Date(iso), { dateStyle: "long", timeStyle: "short" });

function Page() {
  const { orderId } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery(paymentByOrderQuery(orderId));
  const events = useQuery({ ...paymentEventsQuery(q.data?.id ?? ""), enabled: !!q.data?.id });
  const [checking, setChecking] = useState(false);
  const auto = useRef(false);

  const refresh = async (silent = false) => {
    setChecking(true);
    try {
      await verifyPaymentStatus(orderId);
      await qc.invalidateQueries({ queryKey: ["payments"] });
      await qc.invalidateQueries({ queryKey: ["commitments"] });
      await qc.invalidateQueries({ queryKey: ["commitment"] });
      if (!silent) toast.success("Status diperbarui dari Midtrans.");
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Status belum dapat diperiksa.");
    } finally {
      setChecking(false);
    }
  };

  // The Snap callback only brings the user here; the backend asks Midtrans for the real state.
  useEffect(() => {
    if (q.data && !auto.current && q.data.status === "pending") {
      auto.current = true;
      void refresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.id]);

  // Poll while waiting for gateway confirmation.
  const waiting = q.data ? displayStatus(q.data) === "pending" : false;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(
      () => void qc.invalidateQueries({ queryKey: ["payments", "order", orderId] }),
      8000,
    );
    return () => clearInterval(t);
  }, [waiting, qc, orderId]);

  if (q.isPending)
    return (
      <PaymentLayout title="Status Pembayaran">
        <LoadingState />
      </PaymentLayout>
    );
  if (q.error)
    return (
      <PaymentLayout title="Status Pembayaran">
        <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />
      </PaymentLayout>
    );
  const p = q.data;
  if (!p) {
    return (
      <PaymentLayout title="Status Pembayaran">
        <Card title="Pembayaran tidak ditemukan">
          <p className="text-sm">Nomor order tidak ada atau bukan milik akunmu.</p>
          <Link to="/portal" className="mt-3 inline-block font-semibold text-primary">
            Kembali ke dashboard
          </Link>
        </Card>
      </PaymentLayout>
    );
  }
  const status = displayStatus(p);
  const c = p.qurban_commitments;
  const remaining = c ? Math.max(0, c.total_amount - c.verified_paid_amount) : 0;
  const Icon = status === "success" ? CheckCircle2 : status === "pending" ? Clock : XCircle;
  const headline = {
    success: [
      "Pembayaran berhasil",
      "Midtrans telah mengonfirmasi pembayaranmu dan progres kurban sudah diperbarui.",
    ],
    pending: [
      "Menunggu Pembayaran",
      "Selesaikan pembayaran di Midtrans. Verifikasi dapat memerlukan waktu; halaman ini diperbarui otomatis.",
    ],
    failed: [
      "Pembayaran gagal",
      "Pembayaran tidak berhasil dan tidak menambah progres kurban. Kamu dapat mencoba lagi.",
    ],
    expired: [
      "Pembayaran kedaluwarsa",
      "Batas waktu pembayaran telah lewat. Buat pembayaran baru untuk melanjutkan.",
    ],
    cancelled: [
      "Pembayaran dibatalkan",
      "Pembayaran dibatalkan dan tidak menambah progres kurban. Kamu dapat mencoba lagi.",
    ],
  } as Record<string, [string, string]>;
  const [title, text] = headline[status] ?? [status, ""];
  const retry = ["failed", "expired", "cancelled"].includes(status);

  return (
    <PaymentLayout title="Status Pembayaran">
      <Card title="">
        <div className="flex items-start gap-3" aria-live="polite">
          <Icon
            className={`size-8 shrink-0 ${status === "success" ? "text-success" : status === "pending" ? "text-primary" : "text-destructive"}`}
          />
          <div>
            <p className="text-lg font-extrabold text-burgundy-dark">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        </div>
        {status === "pending" && (
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void refresh()}
            disabled={checking}
          >
            {checking && <Loader2 className="animate-spin" />}Periksa Status
          </Button>
        )}
        {p.status === "refund_required" && (
          <p className="mt-3 rounded-xl bg-beige/40 p-3 text-sm">
            Pembayaran melebihi sisa komitmen. Kelebihan dicatat terpisah dan akan diproses tim
            kami.
          </p>
        )}
      </Card>

      <Card title="Rincian pembayaran">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Nomor order</dt>
            <dd className="break-all font-bold">{p.order_id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nominal</dt>
            <dd className="font-bold tabular-nums">{formatRupiah(p.amount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Metode</dt>
            <dd className="font-bold">{methodLabel(p.payment_method)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status verifikasi</dt>
            <dd>
              <PaymentStatusBadge payment={p} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dibuat</dt>
            <dd className="font-bold">{fmt(p.created_at)}</dd>
          </div>
          {p.verified_at ? (
            <div>
              <dt className="text-muted-foreground">Terverifikasi</dt>
              <dd className="font-bold">{fmt(p.verified_at)}</dd>
            </div>
          ) : (
            <div>
              <dt className="text-muted-foreground">Berlaku hingga</dt>
              <dd className="font-bold">{fmt(p.expires_at)}</dd>
            </div>
          )}
        </dl>
        {status === "pending" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Petunjuk pembayaran (nomor virtual account, kode QRIS, dll.) tampil di jendela Midtrans.
            Gunakan "Lanjutkan" di halaman pembayaran bila jendelanya tertutup.
          </p>
        )}
      </Card>

      {c && (
        <Card title="Progres komitmen">
          <p className="text-sm font-semibold">
            {c.code} · {c.category_name_snapshot}
          </p>
          <div className="mt-3">
            <ProgressBar pct={progressPct(c)} label="Progres pembayaran terverifikasi" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatRupiah(c.verified_paid_amount)} dari {formatRupiah(c.total_amount)} · sisa{" "}
            <b>{formatRupiah(remaining)}</b>
          </p>
        </Card>
      )}

      {events.data && events.data.length > 0 && (
        <Card title="Riwayat verifikasi">
          <ul className="space-y-1.5 text-sm">
            {events.data.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>
                  {e.new_status}
                  {e.gateway_status ? ` (${e.gateway_status})` : ""}
                </span>
                <span className="text-muted-foreground">{fmt(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {status === "success" && (
          <Button asChild>
            <Link to="/pembayaran/kuitansi/$orderId" params={{ orderId: p.order_id }}>
              Lihat kuitansi
            </Link>
          </Button>
        )}
        {retry && c && (
          <Button asChild>
            <Link to="/bayar/$id" params={{ id: c.id }}>
              Coba lagi dengan pembayaran baru
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/portal/aktivitas">Riwayat transaksi</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/portal">Kembali ke dashboard</Link>
        </Button>
      </div>
    </PaymentLayout>
  );
}
