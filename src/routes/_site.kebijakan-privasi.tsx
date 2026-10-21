import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/kebijakan-privasi")({
  head: () => seo("Kebijakan Privasi", "Kerangka kebijakan privasi QURBANITY (draf, belum berlaku)."),
  component: () => (
    <LegalPage title="Kebijakan Privasi" sections={["Data yang dikumpulkan", "Tujuan penggunaan data", "Persetujuan publikasi nama", "Penyimpanan dan keamanan data", "Hak peserta atas data pribadi", "Kontak pengelola data"]} />
  ),
});
