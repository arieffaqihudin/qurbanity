import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator, Lock, Coins, ShieldCheck, Eye, FileCheck2, Camera, Sprout, Scissors, PackageCheck, CheckCircle2 } from "lucide-react";
import heroImg from "@/assets/hero-pasture.jpg";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/site/primitives";
import { CategoryCard } from "@/components/site/CategoryCard";
import { Simulator } from "@/components/site/Simulator";
import { Steps } from "@/components/site/Steps";
import { Countdown } from "@/components/site/Countdown";
import { FaqList } from "@/components/site/FaqList";
import { CATEGORIES } from "@/lib/pricing";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/")({
  head: () => seo("Kurban Bertahap, Harga Terkunci", "Wujudkan niat kurban dengan cicilan fleksibel, harga terkunci saat akad, dan laporan pelaksanaan yang transparan."),
  component: Home,
});

const journey = [
  { icon: Sprout, label: "Perawatan hewan" },
  { icon: FileCheck2, label: "Alokasi & H-7" },
  { icon: Scissors, label: "Penyembelihan" },
  { icon: PackageCheck, label: "Distribusi" },
  { icon: Camera, label: "Laporan & dokumentasi" },
];

function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img src={heroImg} alt="Sapi merumput di padang hijau saat senja" width={1600} height={1008} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="bg-hero-overlay absolute inset-0 -z-10" aria-hidden />
        <div className="container-q py-20 text-ivory md:py-28 lg:py-32">
          <p className="eyebrow animate-rise mb-4 text-rose">Kurban bertahap · amanah · transparan</p>
          <h1 className="animate-rise max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
            Niat kurban hari ini, tunaikan dengan tenang di Iduladha.
          </h1>
          <p className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-cream/90">
            Kunci harga hewan kurban sejak akad, bayar sedikit demi sedikit sesuai kemampuan, dan ikuti perjalanannya hingga sampai ke penerima.
          </p>
          <div className="animate-rise mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="ivory" size="lg" asChild><Link to="/simulasi">Mulai Kurban <ArrowRight /></Link></Button>
            <Button variant="light" size="lg" asChild><Link to="/simulasi"><Calculator /> Simulasikan Kurban</Link></Button>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-cream/90">
            {["Harga terkunci saat akad", "Nominal setoran fleksibel", "Bukan produk tabungan"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-rose" />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Categories */}
      <Section>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <SectionHeading eyebrow="Pilihan hewan" title="Pilih hewan kurban kamu" intro="Patungan sapi hingga 7 bagian, atau satu ekor kambing untuk satu shahibul." />
          <Button variant="outline" asChild className="mb-8 self-start md:mb-10 md:self-auto"><Link to="/pilihan-sapi">Bandingkan kategori <ArrowRight /></Link></Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => <CategoryCard key={c.id} c={c} featured={c.id === "sapi-reguler"} />)}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">* Harga merupakan contoh dari PRD dan belum final.</p>
      </Section>

      {/* Flexible installments */}
      <Section tone="cream">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SectionHeading eyebrow="Cicilan fleksibel" title="Bayar sesuai ritme rezeki kamu" intro="Tidak ada jadwal kaku. Setor harian, mingguan, atau bulanan, dengan nominal yang kamu tentukan sendiri, selama lunas sebelum batas pelunasan." />
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              { icon: Lock, t: "Harga terkunci", d: "Tidak terpengaruh kenaikan harga setelah akad." },
              { icon: Coins, t: "Nominal bebas", d: "Setor kecil atau besar, kapan saja." },
              { icon: ShieldCheck, t: "Terverifikasi", d: "Progres hanya dari pembayaran yang berhasil." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-card p-5 shadow-soft">
                <x.icon className="mb-3 size-6 text-primary" />
                <p className="font-bold text-burgundy-dark">{x.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Simulator */}
      <Section id="simulasi">
        <SectionHeading eyebrow="Simulasi" title="Hitung cicilan kurban kamu" intro="Coba berbagai pilihan dan lihat perkiraan setoran hingga batas pelunasan." />
        <Simulator />
      </Section>

      {/* How it works */}
      <Section tone="cream">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <SectionHeading eyebrow="Cara kerja" title="Enam langkah menuju kurban" />
          <Button variant="outline" asChild className="mb-8 self-start md:mb-10 md:self-auto"><Link to="/cara-kerja">Selengkapnya <ArrowRight /></Link></Button>
        </div>
        <Steps />
      </Section>

      {/* Trust */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <SectionHeading eyebrow="Amanah & transparansi" title="Setiap rupiah tercatat, setiap langkah terlihat" intro="Kepercayaan kamu kami jaga dengan prinsip yang tegas dan terdokumentasi." />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: FileCheck2, t: "Pencatatan berbasis ledger", d: "Setiap transaksi tercatat permanen dan dapat diaudit." },
              { icon: Lock, t: "Harga dikunci saat akad", d: "Komitmen kamu terlindungi dari perubahan harga." },
              { icon: Eye, t: "Privasi dihormati", d: "Nama kamu hanya dipublikasikan dengan persetujuan." },
              { icon: ShieldCheck, t: "Dokumen terverifikasi", d: "Keaslian sertifikat dapat dicek publik." },
            ].map((x) => (
              <div key={x.t} className="flex gap-4 rounded-2xl border border-border p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-beige/60 text-burgundy"><x.icon className="size-5" /></span>
                <div><p className="font-bold text-burgundy-dark">{x.t}</p><p className="mt-1 text-sm text-muted-foreground">{x.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Journey + countdown */}
      <Section tone="dark">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading light eyebrow="Perjalanan kurban" title="Ikuti hewan kurban kamu sampai tujuan" intro="Lunas pembayaran bukan akhir. Kamu akan menerima kabar di setiap tahap pelaksanaan." />
            <ol className="space-y-3">
              {journey.map((j, i) => (
                <li key={j.label} className="flex items-center gap-4 rounded-xl bg-ivory/5 p-3">
                  <span className="grid size-10 place-items-center rounded-full bg-ivory text-burgundy"><j.icon className="size-5" /></span>
                  <span className="font-semibold">{i + 1}. {j.label}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <SectionHeading light eyebrow="Menuju Iduladha" title="Hitung mundur Iduladha 1448 H" />
            <Countdown />
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <SectionHeading eyebrow="FAQ" title="Pertanyaan yang sering diajukan" />
            <Button variant="outline" asChild><Link to="/faq">Lihat semua FAQ <ArrowRight /></Link></Button>
          </div>
          <FaqList limit={4} />
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="pt-0">
        <div className="relative overflow-hidden rounded-3xl bg-burgundy-gradient p-8 text-center text-ivory md:p-14">
          <div className="pattern-dots absolute inset-0 opacity-30" aria-hidden />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight md:text-4xl">Mulailah dari langkah kecil. Tunaikan dengan sempurna.</h2>
            <p className="mx-auto mt-3 max-w-xl text-cream/85">Kunci harga hewan kurban kamu hari ini dan cicil dengan tenang.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="ivory" size="lg" asChild><Link to="/simulasi">Mulai Kurban <ArrowRight /></Link></Button>
              <Button variant="light" size="lg" asChild><Link to="/kontak">Hubungi Kami</Link></Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
