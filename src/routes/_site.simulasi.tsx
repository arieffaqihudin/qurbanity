import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Section } from "@/components/site/primitives";
import { Simulator } from "@/components/site/Simulator";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/simulasi")({
  head: () => seo("Simulasi Cicilan Kurban", "Hitung estimasi cicilan harian, mingguan, atau bulanan untuk sapi atau kambing kurban hingga batas pelunasan."),
  component: () => (
    <>
      <PageHeader eyebrow="Simulasi" title="Rencanakan kurbanmu dalam satu menit" intro="Pilih hewan, jumlah bagian, dan frekuensi setoran. Kami tampilkan perkiraan cicilan hingga batas pelunasan." />
      <Section><Simulator /></Section>
    </>
  ),
});
