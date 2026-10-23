import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Loader2 } from "lucide-react";
import { Panel, Loading, Failure, Tag } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { rpc, useAdmin } from "@/lib/admin";
import {
  checkGatewayHealth,
  METHOD_LABEL,
  SANDBOX_NOTICE,
  paymentConfigQuery,
} from "@/lib/payments";
import { formatDate, formatRupiah } from "@/lib/format";

interface GatewayStatus {
  last_check: {
    ok: boolean;
    keys_configured: boolean;
    detail: string | null;
    checked_at: string;
  } | null;
  last_success_check: string | null;
}

const fmt = (iso: string) => formatDate(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

/** Read-only gateway overview. Credentials live only in backend secrets and are never shown or editable here. */
export function GatewayPanel() {
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const status = useQuery({
    queryKey: ["admin", "gateway-status"],
    queryFn: () => rpc<GatewayStatus>("admin_payment_gateway_status"),
  });
  const config = useQuery(paymentConfigQuery);

  const test = async () => {
    setBusy(true);
    try {
      const r = await checkGatewayHealth();
      if (r.ok) toast.success("Koneksi ke Midtrans Sandbox berhasil.");
      else toast.error(r.detail || "Koneksi ke Midtrans belum berhasil.");
      await qc.invalidateQueries({ queryKey: ["admin", "gateway-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pemeriksaan koneksi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const last = status.data?.last_check;
  const methods = (config.data?.methods ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return (
    <Panel title="Gateway pembayaran">
      <p
        role="note"
        className="mb-3 flex items-center gap-2 rounded-lg border border-beige bg-beige/30 p-2.5 text-sm font-semibold text-burgundy-dark"
      >
        <FlaskConical className="size-4 shrink-0" /> {SANDBOX_NOTICE}
      </p>
      {status.isPending ? (
        <Loading />
      ) : status.isError ? (
        <Failure error={status.error} onRetry={() => void status.refetch()} />
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Gateway</dt>
            <dd className="font-bold">Midtrans</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lingkungan</dt>
            <dd>
              <Tag tone="warning">Sandbox</Tag>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status koneksi</dt>
            <dd>
              {!last ? (
                <Tag>Belum diperiksa</Tag>
              ) : !last.keys_configured ? (
                <Tag tone="danger">Kunci belum dikonfigurasi</Tag>
              ) : last.ok ? (
                <Tag tone="success">Terhubung</Tag>
              ) : (
                <Tag tone="danger">Bermasalah</Tag>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Koneksi berhasil terakhir</dt>
            <dd className="font-bold">
              {status.data.last_success_check
                ? fmt(status.data.last_success_check)
                : "Belum pernah"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Batas waktu pembayaran</dt>
            <dd className="font-bold">24 jam (tidak melewati batas akhir program)</dd>
          </div>
          {config.data && (
            <>
              <div>
                <dt className="text-muted-foreground">Minimum / maksimum</dt>
                <dd className="font-bold">
                  {formatRupiah(config.data.minimum_payment)} –{" "}
                  {formatRupiah(config.data.maximum_payment)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Biaya layanan</dt>
                <dd className="font-bold">
                  {config.data.service_fee > 0
                    ? formatRupiah(config.data.service_fee)
                    : "Tidak ada"}
                </dd>
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Metode pembayaran aktif</dt>
            <dd className="mt-1 text-xs text-muted-foreground">
              Metode yang tampil ke peserta ditentukan oleh konfigurasi merchant di dasbor Midtrans
              {methods.length > 0 && (
                <> (daftar pengaturan: {methods.map((m) => METHOD_LABEL[m] ?? m).join(", ")})</>
              )}
              .
            </dd>
          </div>
        </dl>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Kunci Midtrans disimpan aman di server dan tidak dapat dilihat atau diubah dari halaman ini.
      </p>
      {can("finance.manage") && (
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={() => void test()}
          disabled={busy}
        >
          {busy && <Loader2 className="size-4 animate-spin" />} Periksa koneksi
        </Button>
      )}
    </Panel>
  );
}
