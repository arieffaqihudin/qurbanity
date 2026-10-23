import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PaymentBadge,
  ProgressBar,
} from "@/components/portal/StatusUI";
import { PaymentLayout, PaymentStatusBadge } from "@/components/portal/PaymentUI";
import { supabase } from "@/integrations/supabase/client";
import { commitmentQuery, progressPct } from "@/lib/portal-data";
import {
  commitmentPaymentsQuery,
  createCheckout,
  displayStatus,
  openSnap,
  parsePresets,
  paymentConfigQuery,
  reservedAmount,
  verifyPaymentStatus,
  type PaymentRow,
} from "@/lib/payments";
import { formatDate, formatRupiah } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/bayar/$id")({
  head: () => ({ meta: [{ title: "Bayar | qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 10);

function Page() {
  const { id } = Route.useParams();
  const commitment = useQuery(commitmentQuery(id));
  const payments = useQuery(commitmentPaymentsQuery(id));
  const config = useQuery(paymentConfigQuery);
  const user = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const back = { to: "/portal/kurban-saya", label: "Kurban Saya" };
  if (commitment.isPending || payments.isPending || config.isPending || user.isPending) {
    return (
      <PaymentLayout title="Bayar Kurban" back={back}>
        <LoadingState />
      </PaymentLayout>
    );
  }
  const failure = commitment.error ?? payments.error ?? config.error;
  if (failure) {
    return (
      <PaymentLayout title="Bayar Kurban" back={back}>
        <ErrorState
          message={failure.message}
          onRetry={() => {
            void commitment.refetch();
            void payments.refetch();
            void config.refetch();
          }}
        />
      </PaymentLayout>
    );
  }
  const c = commitment.data;
  if (!c) {
    return (
      <PaymentLayout title="Bayar Kurban" back={back}>
        <EmptyState
          title="Komitmen tidak ditemukan"
          text="Komitmen ini tidak ada atau bukan milik akunmu."
          action={
            <Link to="/portal/kurban-saya" className="font-semibold text-primary">
              Kembali ke Kurban Saya
            </Link>
          }
        />
      </PaymentLayout>
    );
  }
  return (
    <PaymentLayout
      title="Bayar Kurban"
      back={{ to: `/portal/kurban-saya/${c.id}`, label: "Detail komitmen" }}
    >
      <Checkout
        commitment={c}
        payments={payments.data!}
        config={config.data!}
        emailVerified={!!user.data?.email_confirmed_at}
      />
    </PaymentLayout>
  );
}

type CommitmentData = NonNullable<
  ReturnType<
    typeof useQuery<Awaited<ReturnType<NonNullable<ReturnType<typeof commitmentQuery>["queryFn"]>>>>
  >["data"]
>;

function Checkout({
  commitment: c,
  payments,
  config,
  emailVerified,
}: {
  commitment: CommitmentData;
  payments: PaymentRow[];
  config: NonNullable<
    ReturnType<
      typeof useQuery<Awaited<ReturnType<NonNullable<typeof paymentConfigQuery.queryFn>>>>
    >["data"]
  >;
  emailVerified: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);
  const keyRef = useRef<{ amount: number; key: string } | null>(null);

  const pct = progressPct(c);
  const remaining = Math.max(0, c.total_amount - c.verified_paid_amount);
  const reserved = reservedAmount(payments);
  const available = Math.max(0, remaining - reserved);
  const minimum = Math.min(config.minimum_payment, available);
  const maximum = Math.min(config.maximum_payment, available);
  const deadline = c.programs?.payment_deadline ? new Date(c.programs.payment_deadline) : null;
  const closed =
    (deadline ? deadline.getTime() <= Date.now() : false) || c.execution_status === "dibatalkan";
  const amount = raw ? Number(raw) : 0;
  const pending = payments.filter((p) => displayStatus(p) === "pending");

  const quick = useMemo(() => {
    const set = new Map<number, string>();
    for (const n of parsePresets(config.presets))
      if (n >= minimum && n <= maximum) set.set(n, formatRupiah(n));
    const share =
      c.animal_kind_snapshot === "sapi" && c.shares > 0 ? Math.round(c.total_amount / c.shares) : 0;
    if (share >= minimum && share <= maximum && !set.has(share))
      set.set(share, `1 bagian · ${formatRupiah(share)}`);
    return [...set.entries()].sort((a, b) => a[0] - b[0]);
  }, [config.presets, minimum, maximum, c.animal_kind_snapshot, c.shares, c.total_amount]);

  let error: string | null = null;
  if (raw && amount < minimum) error = `Nominal minimal ${formatRupiah(minimum)}.`;
  else if (amount > available)
    error = `Nominal melebihi sisa yang dapat dibayar (${formatRupiah(available)}).`;
  else if (amount > maximum) error = `Nominal maksimal ${formatRupiah(maximum)} per transaksi.`;

  const canPay = emailVerified && !closed && available > 0 && amount > 0 && !error && !busy;

  useEffect(() => {
    if (keyRef.current && keyRef.current.amount !== amount) keyRef.current = null;
  }, [amount]);

  const toStatus = (orderId: string) =>
    navigate({ to: "/pembayaran/status/$orderId", params: { orderId } });

  const pay = async () => {
    if (!canPay) return;
    setBusy(true);
    try {
      // A double click or retry of the same amount reuses the key, so only one order exists.
      keyRef.current ??= { amount, key: crypto.randomUUID() };
      const order = await createCheckout({
        commitmentId: c.id,
        amount,
        idempotencyKey: keyRef.current.key,
      });
      void qc.invalidateQueries({ queryKey: ["payments"] });
      if (isMobile) {
        window.location.assign(order.snap_redirect_url);
        return;
      }
      await openSnap(order.snap_token, order.client_key, {
        onSuccess: () => void toStatus(order.order_id),
        onPending: () => void toStatus(order.order_id),
        onError: () => void toStatus(order.order_id),
        // Closing the popup proves nothing; the status page asks the backend to verify.
        onClose: () => void toStatus(order.order_id),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pembayaran belum dapat dibuka.");
    } finally {
      setBusy(false);
    }
  };

  const resume = async (p: PaymentRow) => {
    if (!p.snap_token) return void toStatus(p.order_id);
    setResuming(p.id);
    try {
      const check = await verifyPaymentStatus(p.order_id);
      const state = check.status?.status;
      if (state && state !== "pending") return void toStatus(p.order_id);
      if (!check.client_key) throw new Error("Pembayaran belum dapat dibuka.");
      if (isMobile && p.snap_redirect_url) {
        window.location.assign(p.snap_redirect_url);
        return;
      }
      await openSnap(p.snap_token, check.client_key, {
        onSuccess: () => void toStatus(p.order_id),
        onPending: () => void toStatus(p.order_id),
        onError: () => void toStatus(p.order_id),
        onClose: () => void toStatus(p.order_id),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pembayaran belum dapat dibuka.");
    } finally {
      setResuming(null);
    }
  };

  return (
    <>
      <Card title="Ringkasan komitmen">
        <p className="text-sm font-semibold text-muted-foreground">{c.code}</p>
        <p className="text-lg font-extrabold text-burgundy-dark">
          {c.category_name_snapshot}
          {c.animal_kind_snapshot === "sapi" &&
            ` · ${c.shares === 7 ? "1 ekor penuh" : `${c.shares}/7 bagian`}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Shahibul:{" "}
          {[...c.qurban_shares]
            .sort((a, b) => a.position - b.position)
            .map((s) => s.shahibul_name)
            .join(", ")}
        </p>
        <div className="mt-2">
          <PaymentBadge status={c.payment_status} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Total komitmen</dt>
            <dd className="font-bold tabular-nums">{formatRupiah(c.total_amount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Terverifikasi</dt>
            <dd className="font-bold tabular-nums text-primary">
              {formatRupiah(c.verified_paid_amount)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sisa</dt>
            <dd className="font-bold tabular-nums">{formatRupiah(remaining)}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <ProgressBar pct={pct} label="Progres pembayaran terverifikasi" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {pct}% terverifikasi
          {reserved > 0 && ` · ${formatRupiah(reserved)} sedang menunggu pembayaran`}
        </p>
      </Card>

      {pending.length > 0 && (
        <Card title="Pembayaran yang menunggu">
          <ul className="divide-y divide-border">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span>
                  <b className="tabular-nums">{formatRupiah(p.amount)}</b>
                  <span className="block text-xs text-muted-foreground">
                    {p.order_id} · berlaku hingga{" "}
                    {formatDate(new Date(p.expires_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void resume(p)}
                    disabled={resuming === p.id}
                  >
                    {resuming === p.id && <Loader2 className="animate-spin" />}Lanjutkan
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/pembayaran/status/$orderId" params={{ orderId: p.order_id }}>
                      Status
                    </Link>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Nominal pembayaran">
        {!emailVerified && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
          >
            Verifikasi email terlebih dahulu sebelum melakukan pembayaran.
          </p>
        )}
        {closed && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
          >
            Masa pembayaran komitmen ini telah berakhir.
          </p>
        )}
        {!closed && available === 0 && (
          <p className="mb-4 rounded-xl bg-muted p-3 text-sm">
            {remaining === 0
              ? "Komitmen ini sudah lunas. Terima kasih."
              : "Sisa komitmen sudah tercakup oleh pembayaran yang menunggu. Selesaikan atau tunggu pembayaran tersebut berakhir."}
          </p>
        )}
        {available > 0 && !closed && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Nominal cepat">
              {quick.map(([n, label]) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRaw(String(n))}
                  aria-pressed={amount === n}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${amount === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRaw(String(Math.min(available, maximum)))}
                aria-pressed={amount === available}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${amount === available ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
              >
                Lunasi sisa · {formatRupiah(available)}
              </button>
            </div>
            <label htmlFor="amount" className="mt-5 block text-sm font-bold">
              Nominal lain (Rp)
            </label>
            <Input
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              value={raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : ""}
              onChange={(e) => setRaw(digits(e.target.value))}
              placeholder={`Min. ${formatRupiah(minimum)}`}
              aria-invalid={!!error}
              aria-describedby="amount-help"
              className="mt-1 h-12 text-lg font-bold tabular-nums"
            />
            <p
              id="amount-help"
              className={`mt-1.5 text-xs ${error ? "font-semibold text-destructive" : "text-muted-foreground"}`}
            >
              {error ??
                `Minimal ${formatRupiah(minimum)}, maksimal ${formatRupiah(maximum)} per transaksi.`}
            </p>
            {config.service_fee > 0 && amount > 0 && !error && (
              <p className="mt-3 text-sm text-muted-foreground">
                Biaya layanan {formatRupiah(config.service_fee)} dikenakan terpisah dan tidak
                menambah progres kurban. Total tagihan {formatRupiah(amount + config.service_fee)}.
              </p>
            )}
          </>
        )}
        <Button size="lg" className="mt-6 w-full" disabled={!canPay} onClick={() => void pay()}>
          {busy && <Loader2 className="animate-spin" />} Bayar Sekarang
          {amount > 0 && !error ? ` · ${formatRupiah(amount)}` : ""}
        </Button>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          Pembayaran diproses melalui Midtrans. Progres kurban bertambah setelah Midtrans
          mengonfirmasi pembayaran, bukan saat jendela pembayaran ditutup.
        </p>
      </Card>
    </>
  );
}
