import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Section, SectionHeading, Notice } from "@/components/site/primitives";
import { STEPS } from "@/components/site/Steps";
import { seo } from "@/lib/seo";
import { ParallaxLayer, Reveal } from "@/components/site/motion";

export const Route = createFileRoute("/_site/cara-kerja")({
  head: () => seo("Cara Kerja", "Perjalanan lengkap peserta qurbanity: dari simulasi, akad, pembayaran bertahap, hingga laporan pelaksanaan kurban."),
  component: Page,
});

const details = [
  "Buka halaman Simulasi, pilih kategori hewan dan jumlah bagian, lalu bandingkan estimasi cicilan harian, mingguan, atau bulanan.",
  "Daftar akun, lengkapi data shahibul, dan setujui akad. Harga hewan dikunci pada saat ini dan tidak berubah untuk komitmen tersebut.",
  "Lakukan pembayaran kapan pun dengan nominal yang kamu tentukan. Kamu boleh memiliki lebih dari satu komitmen.",
  "Tim kami memverifikasi setiap pembayaran. Progres di dashboard hanya bertambah dari pembayaran yang berhasil dan terverifikasi.",
  "Setelah lunas, kamu dialokasikan ke hewan tertentu. Sekitar H-7 Iduladha kamu menerima pengumuman resmi alokasi.",
  "Penyembelihan dilakukan pada Iduladha dan hari tasyrik. Dokumentasi dan laporan distribusi tersedia di portal peserta.",
];

function Page() {
  return (
    <>
      <PageHeader eyebrow="Cara kerja" title="Dari niat hingga daging sampai ke penerima" intro="Enam langkah sederhana yang dirancang agar mudah diikuti siapa saja." />
      <Section className="relative isolate overflow-hidden">
        <ParallaxLayer speed={-0.15} className="absolute -right-24 top-10 -z-10 hidden size-80 rounded-full bg-beige/50 md:block" />
        <ParallaxLayer speed={0.1} className="absolute -left-20 bottom-20 -z-10 hidden size-64 rounded-full bg-rose/15 md:block" />
        <ol className="relative space-y-6 border-l-2 border-beige pl-8 md:pl-10">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} className="relative">
              <span className="absolute -left-[3.05rem] grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft md:-left-[3.55rem]"><s.icon className="size-5" /></span>
              <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
                <p className="eyebrow">Langkah {i + 1}</p>
                <h2 className="mt-1 text-xl font-extrabold text-burgundy-dark">{s.title}</h2>
                <p className="mt-2 leading-relaxed text-muted-foreground">{details[i]}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>
      <Section tone="cream">
        <SectionHeading title="Penting untuk dipahami" />
        <div className="grid gap-3 md:grid-cols-3">
          <Notice kind="info">Lunas pembayaran tidak berarti kurban sudah dilaksanakan. Pelaksanaan mengikuti jadwal Iduladha.</Notice>
          <Notice kind="info">qurbanity bukan produk perbankan atau tabungan, melainkan komitmen pembelian hewan kurban.</Notice>
          <Notice kind="info">Namamu hanya ditampilkan di laporan publik jika kamu memberikan persetujuan.</Notice>
        </div>
        <Button size="lg" className="mt-8" asChild><Link to="/simulasi">Mulai simulasi <ArrowRight /></Link></Button>
      </Section>
    </>
  );
}
