import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/syarat-ketentuan")({
  head: () => seo("Syarat & Ketentuan", "Kerangka syarat dan ketentuan program qurbanity (draf, belum berlaku)."),
  component: () => (
    <LegalPage title="Syarat & Ketentuan" sections={["Ketentuan peserta", "Akad dan penguncian harga", "Pembayaran dan verifikasi", "Batas pelunasan", "Pembatalan dan pengembalian dana", "Alokasi dan pelaksanaan kurban", "Dokumentasi dan pelaporan", "Penyelesaian sengketa"]} />
  ),
});
