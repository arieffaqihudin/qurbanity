import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FlaskConical } from "lucide-react";
import {
  PageHead,
  Panel,
  Guard,
  Loading,
  Failure,
  SearchBox,
  NativeSelect,
  Pager,
  DataTable,
  Empty,
  Tag,
  RowActions,
  Kpi,
  ProgramFilter,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { rpc, useAdmin, toCsv, download } from "@/lib/admin";
import {
  adminVerifyPayment,
  METHOD_FILTER,
  methodLabel,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  SANDBOX_NOTICE,
  displayStatus,
  type PaymentStatus,
} from "@/lib/payments";
import { formatDate, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pembayaran")({
  head: () => ({
    meta: [{ title: "Pembayaran | Admin qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <Guard perms="finance.view">
      <Page />
    </Guard>
  ),
});

interface Row {
  id: string;
  order_id: string;
  full_name: string;
  email: string;
  commitment_code: string;
  category_name_snapshot: string;
  program_name: string;
  amount: number;
  service_fee: number;
  payment_method: string | null;
  status: string;
  gateway_status: string | null;
  created_at: string;
  expires_at: string;
  verified_at: string | null;
  receipt_number: string | null;
}
interface Summary {
  successful_count: number;
  verified_amount: number;
  pending_count: number;
  failed_count: number;
  expired_count: number;
  refund_review_count: number;
  unreconciled_count: number;
}

const STATUS_OPTIONS = [
  "pending",
  "success",
  "failed",
  "expired",
  "cancelled",
  "refund_required",
] as const;
const label = (s: string) => PAYMENT_STATUS_LABEL[s as PaymentStatus] ?? s;
const tone = (s: string) => PAYMENT_STATUS_TONE[s as PaymentStatus] ?? "muted";
const fmt = (iso: string | null) =>
  iso ? formatDate(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : "—";

function StatusTag({ r }: { r: Pick<Row, "status" | "expires_at"> }) {
  const s = displayStatus(r as never);
  return <Tag tone={tone(s)}>{label(s)}</Tag>;
}

function Page() {
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [program, setProgram] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"detail" | "riwayat">("detail");
  const [checking, setChecking] = useState<string | null>(null);

  const args = {
    p_search: search.trim() || null,
    p_status: status || null,
    p_method: method || null,
    p_program_id: program || null,
    p_from: from ? `${from}T00:00:00+07:00` : null,
    p_to: to
      ? `${new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000).toISOString()}`
      : null,
  };
  const summary = useQuery({
    queryKey: ["admin", "pay-summary", program],
    queryFn: () => rpc<Summary>("admin_payment_summary", { p_program_id: program || null }),
  });
  const q = useQuery({
    queryKey: ["admin", "pay-page", args, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: () =>
      rpc<{ total_count: number; rows: Row[] }>("admin_payment_page", {
        ...args,
        p_limit: pageSize,
        p_offset: page * pageSize,
      }),
  });

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };
  const open = (id: string, t: "detail" | "riwayat" = "detail") => {
    setTab(t);
    setOpenId(id);
  };

  const check = async (r: Row) => {
    setChecking(r.id);
    try {
      const res = await adminVerifyPayment(r.id);
      toast.success(
        `Status Midtrans: ${res.gateway_status}. Status internal: ${label(res.status?.status ?? r.status)}.`,
      );
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status belum dapat diperiksa.");
    } finally {
      setChecking(null);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await rpc<{ rows: Row[] }>("admin_payment_page", {
        ...args,
        p_limit: 10000,
        p_offset: 0,
        p_export: true,
      });
      const rows = res.rows.map((r) => ({
        id_transaksi: r.order_id,
        peserta: r.full_name,
        kode_kurban: r.commitment_code,
        tanggal: fmt(r.created_at),
        nominal: r.amount,
        biaya_layanan: r.service_fee,
        metode: methodLabel(r.payment_method),
        status: label(displayStatus(r as never)),
        lingkungan: "UJI COBA (sandbox)",
      }));
      download(
        `pembayaran-sandbox-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(rows),
        "text/csv",
      );
      toast.success(`${rows.length} transaksi diekspor`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ekspor gagal.");
    }
  };

  const s = summary.data;
  const filtersActive = !!(search || status || method || program || from || to);

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <PageHead
        to="/admin/pembayaran"
        count={q.data?.total_count}
        actions={
          <>
            <ProgramFilter value={program} onChange={(v) => reset(() => setProgram(v))} />
            {can("reports.export") && (
              <Button size="sm" variant="outline" onClick={() => void exportCsv()}>
                <Download className="size-4" /> Ekspor CSV
              </Button>
            )}
          </>
        }
      >
        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-burgundy-dark">
          <FlaskConical className="size-3.5" />
          {SANDBOX_NOTICE}
        </p>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total Pembayaran Berhasil" value={s ? s.successful_count : "…"} />
        <Kpi
          label="Total Dana Terverifikasi"
          value={s ? formatRupiah(s.verified_amount) : "…"}
          hint="Uji coba, bukan dana nyata"
        />
        <Kpi label="Menunggu Pembayaran" value={s ? s.pending_count : "…"} />
        <Kpi label="Transaksi Gagal" value={s ? s.failed_count : "…"} />
        <Kpi label="Transaksi Kedaluwarsa" value={s ? s.expired_count : "…"} />
      </div>

      {q.isPending ? (
        <Panel>
          <Loading />
        </Panel>
      ) : q.isError ? (
        <Panel>
          <Failure error={q.error} onRetry={() => void q.refetch()} />
        </Panel>
      ) : (
        <DataTable
          rows={q.data.rows}
          rowKey={(r) => r.id}
          empty={
            <Empty
              title="Belum ada transaksi"
              text={
                filtersActive
                  ? "Coba ubah kata kunci atau filter."
                  : "Transaksi Midtrans Sandbox akan tampil di sini."
              }
            />
          }
          toolbar={
            <>
              <SearchBox
                value={search}
                onChange={(v) => reset(() => setSearch(v))}
                placeholder="Cari ID, peserta, atau kode"
              />
              <NativeSelect
                label="Status"
                value={status}
                onChange={(v) => reset(() => setStatus(v))}
              >
                <option value="">Semua status</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {label(o)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                label="Metode"
                value={method}
                onChange={(v) => reset(() => setMethod(v))}
              >
                <option value="">Semua metode</option>
                {METHOD_FILTER.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
              <Input
                type="date"
                aria-label="Dari tanggal"
                value={from}
                onChange={(e) => reset(() => setFrom(e.target.value))}
                className="h-9 w-auto"
              />
              <Input
                type="date"
                aria-label="Sampai tanggal"
                value={to}
                onChange={(e) => reset(() => setTo(e.target.value))}
                className="h-9 w-auto"
              />
              {filtersActive && (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary underline"
                  onClick={() =>
                    reset(() => {
                      setSearch("");
                      setStatus("");
                      setMethod("");
                      setProgram("");
                      setFrom("");
                      setTo("");
                    })
                  }
                >
                  Reset filter
                </button>
              )}
            </>
          }
          footer={
            <Pager
              page={page}
              pageSize={pageSize}
              total={q.data.total_count}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(0);
              }}
            />
          }
          cols={[
            {
              label: "ID Transaksi",
              primary: true,
              cell: (r) => (
                <button
                  type="button"
                  className="break-all text-left font-semibold text-primary underline-offset-2 hover:underline"
                  onClick={() => open(r.id)}
                >
                  {r.order_id}
                </button>
              ),
            },
            {
              label: "Peserta",
              cell: (r) => (
                <span>
                  {r.full_name}
                  <span className="block text-xs text-muted-foreground">{r.email}</span>
                </span>
              ),
            },
            { label: "Kode Kurban", cell: (r) => r.commitment_code },
            { label: "Tanggal", sort: (r) => r.created_at, cell: (r) => fmt(r.created_at) },
            {
              label: "Nominal",
              sort: (r) => r.amount,
              className: "text-right tabular-nums",
              cell: (r) => formatRupiah(r.amount),
            },
            {
              label: "Metode Pembayaran",
              hideOnMobile: true,
              cell: (r) => methodLabel(r.payment_method),
            },
            { label: "Status", cell: (r) => <StatusTag r={r} /> },
            {
              label: "Aksi",
              cell: (r) => (
                <RowActions
                  items={[
                    { label: "Lihat Detail", onSelect: () => open(r.id) },
                    can("finance.manage") && {
                      label: checking === r.id ? "Memeriksa…" : "Periksa Status Midtrans",
                      disabled: checking === r.id,
                      onSelect: () => void check(r),
                    },
                    r.status === "success"
                      ? { label: "Lihat Kuitansi", onSelect: () => open(r.id) }
                      : null,
                    { label: "Lihat Riwayat", onSelect: () => open(r.id, "riwayat") },
                  ]}
                />
              ),
            },
          ]}
        />
      )}
      <DetailSheet id={openId} tab={tab} onClose={() => setOpenId(null)} />
    </div>
  );
}

interface Detail {
  payment: Row & {
    transaction_id: string | null;
    gateway_status_code: string | null;
    fraud_status: string | null;
    environment: string;
    verification_code: string | null;
    paid_amount?: number;
  };
  participant: { full_name: string; email: string; whatsapp: string | null };
  commitment: {
    id: string;
    code: string;
    category: string;
    total_amount: number;
    verified_paid_amount: number;
    execution_status: string;
  };
  events: {
    id: string;
    new_status: string;
    previous_status: string | null;
    gateway_status: string | null;
    source: string;
    created_at: string;
  }[];
  ledger: {
    id: string;
    amount: number;
    source_account: string;
    dest_account: string;
    created_at: string;
    system_source: string | null;
  }[];
  audit: {
    id: string;
    action: string;
    created_at: string;
    metadata: { status?: string; gateway_status?: string; environment?: string } | null;
  }[];
}

function DetailSheet({
  id,
  tab,
  onClose,
}: {
  id: string | null;
  tab: "detail" | "riwayat";
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["admin", "pay-detail", id],
    enabled: !!id,
    queryFn: () => rpc<Detail>("admin_payment_detail", { p_payment_id: id }),
  });
  const d = q.data;
  const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="break-all text-right font-semibold">{v}</dd>
    </div>
  );
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detail Transaksi</SheetTitle>
          <SheetDescription>{SANDBOX_NOTICE}</SheetDescription>
        </SheetHeader>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <Failure error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          d && (
            <div className="space-y-5 px-4 pb-6">
              {tab === "detail" && (
                <>
                  <section>
                    <h3 className="mb-1 font-extrabold">Peserta</h3>
                    <dl>
                      <KV k="Nama" v={d.participant.full_name} />
                      <KV k="Email" v={d.participant.email} />
                      <KV k="WhatsApp" v={d.participant.whatsapp ?? "—"} />
                    </dl>
                  </section>
                  <section>
                    <h3 className="mb-1 font-extrabold">Komitmen</h3>
                    <dl>
                      <KV k="Kode" v={d.commitment.code} />
                      <KV k="Kategori" v={d.commitment.category} />
                      <KV k="Total" v={formatRupiah(d.commitment.total_amount)} />
                      <KV k="Terverifikasi" v={formatRupiah(d.commitment.verified_paid_amount)} />
                      <KV k="Pelaksanaan" v={d.commitment.execution_status} />
                    </dl>
                  </section>
                  <section>
                    <h3 className="mb-1 font-extrabold">Pembayaran</h3>
                    <dl>
                      <KV k="Nominal" v={formatRupiah(d.payment.amount)} />
                      <KV k="Biaya layanan" v={formatRupiah(d.payment.service_fee)} />
                      <KV k="Metode" v={methodLabel(d.payment.payment_method)} />
                      <KV k="Status internal" v={<StatusTag r={d.payment} />} />
                      <KV
                        k="Status verifikasi gateway"
                        v={d.payment.gateway_status ?? "Belum ada"}
                      />
                      <KV k="Order Midtrans" v={d.payment.order_id} />
                      <KV k="ID transaksi Midtrans" v={d.payment.transaction_id ?? "—"} />
                      <KV k="Dibuat" v={fmt(d.payment.created_at)} />
                      <KV k="Berlaku hingga" v={fmt(d.payment.expires_at)} />
                      <KV k="Terverifikasi" v={fmt(d.payment.verified_at)} />
                      <KV k="Lingkungan" v="Uji coba (sandbox)" />
                    </dl>
                    {d.payment.status === "success" && (
                      <p className="mt-2 text-sm">
                        Kuitansi: <b>{d.payment.receipt_number}</b> ·{" "}
                        <Link
                          className="text-primary underline"
                          to="/pembayaran/kuitansi/$orderId"
                          params={{ orderId: d.payment.order_id }}
                        >
                          Lihat Kuitansi
                        </Link>
                      </p>
                    )}
                  </section>
                  <section>
                    <h3 className="mb-1 font-extrabold">Catatan ledger terkait</h3>
                    {d.ledger.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada posting ledger.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {d.ledger.map((l) => (
                          <li key={l.id}>
                            {l.source_account} → {l.dest_account} · <b>{formatRupiah(l.amount)}</b>{" "}
                            · {fmt(l.created_at)}
                            {l.system_source === "midtrans_sandbox" && " · uji coba"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
              <section>
                <h3 className="mb-1 font-extrabold">Riwayat verifikasi</h3>
                {d.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada kejadian.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {d.events.map((e) => (
                      <li key={e.id}>
                        {fmt(e.created_at)} · {e.previous_status ? `${e.previous_status} → ` : ""}
                        <b>{e.new_status}</b>
                        {e.gateway_status && ` (${e.gateway_status})`} · {e.source}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-1 font-extrabold">Riwayat audit</h3>
                {d.audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada catatan audit.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {d.audit.map((a) => (
                      <li key={a.id}>
                        {fmt(a.created_at)} · {a.action} ·{" "}
                        {a.metadata?.status ?? a.metadata?.gateway_status ?? "Aktivitas sistem"}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}
