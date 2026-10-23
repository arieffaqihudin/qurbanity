import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, LoadingState } from "@/components/portal/StatusUI";
import { PaymentLayout } from "@/components/portal/PaymentUI";
import {
  SANDBOX_RECEIPT_MARK,
  methodLabel,
  receiptQuery,
  type PaymentReceipt,
} from "@/lib/payments";
import { formatDate, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pembayaran/kuitansi/$orderId")({
  head: () => ({
    meta: [{ title: "Kuitansi | qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

const fmt = (iso: string) => formatDate(new Date(iso), { dateStyle: "long", timeStyle: "short" });

async function downloadReceiptPdf(r: PaymentReceipt) {
  const [{ jsPDF }, QR] = await Promise.all([import("jspdf"), import("qrcode")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = 20;
  doc.setFont("helvetica", "bold").setFontSize(20).text("QURBANITY", 15, y);
  doc.setFont("helvetica", "normal").setFontSize(10);
  y += 6;
  doc.text(
    `Diterbitkan oleh ${r.issuer?.legal_entity ?? r.issuer?.name ?? "Manfaat Mengalir"}`,
    15,
    y,
  );
  if (r.issuer?.address) doc.text(r.issuer.address, 15, (y += 5), { maxWidth: w - 30 });
  y += 10;
  doc.setFont("helvetica", "bold").setFontSize(14).text("KUITANSI PEMBAYARAN", 15, y);
  y += 4;
  doc.setDrawColor(150).line(15, y, w - 15, y);
  const rows: [string, string][] = [
    ["Nomor kuitansi", r.receipt_number],
    ["Nama peserta", r.participant_name],
    ["Kode kurban", r.commitment_code],
    ["Kategori hewan", r.category],
    ["Jumlah dibayar", formatRupiah(r.amount)],
    ["Metode", methodLabel(r.payment_method)],
    ["Tanggal pembayaran", fmt(r.paid_at)],
    ["Total terverifikasi", formatRupiah(r.verified_total)],
    ["Sisa komitmen", formatRupiah(Math.max(0, r.commitment_total - r.verified_total))],
    ["Kode verifikasi", r.verification_code],
  ];
  doc.setFontSize(11);
  for (const [k, v] of rows) {
    y += 8;
    doc.setFont("helvetica", "normal").text(k, 15, y);
    doc.setFont("helvetica", "bold").text(v, 70, y, { maxWidth: w - 85 });
  }
  const url = `${window.location.origin}/verifikasi?kode=${encodeURIComponent(r.verification_code)}`;
  const qr = await QR.toDataURL(url, { margin: 1, width: 240 });
  doc.addImage(qr, "PNG", 15, y + 8, 32, 32);
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9)
    .text("Pindai untuk memverifikasi keaslian dokumen.", 52, y + 25);
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(180, 30, 30);
  doc.text(SANDBOX_RECEIPT_MARK, w / 2, y + 55, { align: "center", maxWidth: w - 30 });
  doc.save(`kuitansi-${r.receipt_number}.pdf`);
}

function Page() {
  const { orderId } = Route.useParams();
  const q = useQuery(receiptQuery(orderId));
  const back = { to: `/pembayaran/status/${orderId}`, label: "Status pembayaran" };
  if (q.isPending)
    return (
      <PaymentLayout title="Kuitansi" back={back}>
        <LoadingState />
      </PaymentLayout>
    );
  if (q.error || !q.data) {
    return (
      <PaymentLayout title="Kuitansi" back={back}>
        <ErrorState
          message={q.error?.message ?? "Kuitansi tersedia setelah pembayaran terverifikasi."}
          onRetry={() => void q.refetch()}
        />
      </PaymentLayout>
    );
  }
  const r = q.data;
  return (
    <PaymentLayout title="Kuitansi" back={back}>
      <Card>
        <p className="rounded-lg border-2 border-destructive/60 p-2 text-center text-sm font-extrabold text-destructive">
          {SANDBOX_RECEIPT_MARK}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Diterbitkan oleh {r.issuer?.legal_entity ?? r.issuer?.name ?? "Manfaat Mengalir"}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {(
            [
              ["Nomor kuitansi", r.receipt_number],
              ["Nama peserta", r.participant_name],
              ["Kode kurban", r.commitment_code],
              ["Kategori hewan", r.category],
              ["Jumlah dibayar", formatRupiah(r.amount)],
              ["Tanggal pembayaran", fmt(r.paid_at)],
              ["Total terverifikasi", formatRupiah(r.verified_total)],
              ["Sisa komitmen", formatRupiah(Math.max(0, r.commitment_total - r.verified_total))],
              ["Kode verifikasi", r.verification_code],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-all font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() =>
              void downloadReceiptPdf(r).catch(() => toast.error("PDF belum dapat dibuat."))
            }
          >
            <Download /> Unduh PDF
          </Button>
          <Button variant="outline" asChild>
            <Link to="/verifikasi" search={{ kode: r.verification_code } as never}>
              Verifikasi dokumen
            </Link>
          </Button>
        </div>
      </Card>
    </PaymentLayout>
  );
}
