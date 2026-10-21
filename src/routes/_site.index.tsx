import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator, Lock, Coins, ShieldCheck, Eye, FileCheck2, Camera, Sprout, Scissors, PackageCheck, CheckCircle2 } from "lucide-react";
import heroImg from "@/assets/hero-pasture.jpg";
import distributionImg from "@/assets/distribution.jpg";
import farmImg from "@/assets/farm-landscape.jpg";
import { ParallaxImage, ParallaxLayer, Reveal } from "@/components/site/motion";
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
  head: () => seo("Kurban Gak Harus Dadakan", "Cicil kurbanmu dengan nominal fleksibel, harga terkunci saat akad, dan laporan pelaksanaan yang transparan."),
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
        <ParallaxImage src={heroImg} alt="Sapi merumput di padang hijau saat senja" speed={0.22} eager />
        <div className="bg-hero-overlay absolute inset-0 -z-10" aria-hidden />
        {/* Depth: photo and clouds drift slower than the page; the foreground hill and text stay anchored. */}
        <ParallaxLayer speed={0.08} className="absolute inset-x-0 top-6 -z-10 hidden md:block">
          <svg viewBox="0 0 1200 120" className="h-24 w-full fill-ivory opacity-15"><ellipse cx="180" cy="60" rx="120" ry="22" /><ellipse cx="260" cy="48" rx="70" ry="20" /><ellipse cx="900" cy="40" rx="140" ry="18" /><ellipse cx="990" cy="30" rx="70" ry="16" /></svg>
        </ParallaxLayer>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px z-0">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="block h-10 w-full fill-background md:h-16"><path d="M0 60 Q240 20 480 44 T960 38 T1440 30 V80 H0Z" /></svg>
        </div>
        <div className="container-q relative z-10 pb-24 pt-20 text-ivory md:pb-36 md:pt-28 lg:pt-32">
          <p className="eyebrow animate-rise mb-4 text-cream">Mulai dikit, jadi kurban</p>
          <h1 className="animate-rise max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
            Kurban gak harus dadakan.
          </h1>
          <p className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-cream/90">
            Kunci harga hewan kurbanmu sejak akad, cicil sedikit demi sedikit sesuai kemampuan, lalu pantau perjalanannya sampai ke penerima.
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
          <SectionHeading eyebrow="Pilihan hewan" title="Pilih hewan kurbanmu" intro="Patungan sapi hingga 7 bagian, atau satu ekor kambing untuk satu shahibul." />
          <Button variant="outline" asChild className="mb-8 self-start md:mb-10 md:self-auto"><Link to="/pilihan-sapi">Bandingkan kategori <ArrowRight /></Link></Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => <Reveal key={c.id} delay={i * 90} className="h-full"><CategoryCard c={c} featured={c.id === "sapi-reguler"} /></Reveal>)}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">* Harga merupakan contoh dari PRD dan belum final.</p>
      </Section>

      {/* Flexible installments */}
      <Section tone="cream">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SectionHeading eyebrow="Cicilan fleksibel" title="Bayar sesuai ritme rezekimu" intro="Tidak ada jadwal kaku. Setor harian, mingguan, atau bulanan, dengan nominal yang kamu tentukan sendiri, selama lunas sebelum batas pelunasan." />
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
        <SectionHeading eyebrow="Simulasi" title="Hitung cicilan kurbanmu" intro="Coba berbagai pilihan dan lihat perkiraan setoran hingga batas pelunasan." />
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
          <SectionHeading eyebrow="Amanah & transparansi" title="Setiap rupiah tercatat, setiap langkah terlihat" intro="Kepercayaanmu kami jaga dengan prinsip yang tegas dan terdokumentasi." />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: FileCheck2, t: "Pencatatan berbasis ledger", d: "Setiap transaksi tercatat permanen dan dapat diaudit." },
              { icon: Lock, t: "Harga dikunci saat akad", d: "Komitmenmu terlindungi dari perubahan harga." },
              { icon: Eye, t: "Privasi dihormati", d: "Namamu hanya dipublikasikan dengan persetujuan." },
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
            <SectionHeading light eyebrow="Perjalanan kurban" title="Ikuti hewan kurbanmu sampai tujuan" intro="Lunas pembayaran bukan akhir. Kamu akan menerima kabar di setiap tahap pelaksanaan." />
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

      {/* Impact — photographic fixed-background parallax */}
      <section aria-labelledby="impact-title" className="bg-fixed-parallax relative isolate overflow-hidden text-ivory" style={{ backgroundImage: `url(${distributionImg})` }}>
        <div className="absolute inset-0 -z-10 bg-burgundy-dark/80" aria-hidden />
        <div className="container-q grid gap-8 py-20 md:py-28 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <Reveal>
            <p className="eyebrow mb-3 text-cream">Dampak</p>
            <h2 id="impact-title" className="max-w-xl text-3xl font-extrabold leading-tight md:text-4xl">Dari kandang sampai ke tangan penerima.</h2>
            <p className="mt-4 max-w-lg text-cream/90">Setiap tahap pelaksanaan akan dilaporkan dengan dokumentasi yang sudah diverifikasi, termasuk distribusi daging kepada penerima manfaat.</p>
          </Reveal>
          <Reveal delay={150} className="flex flex-col items-start gap-3 lg:items-end">
            <Button variant="ivory" size="lg" asChild><Link to="/dampak">Lihat laporan dampak <ArrowRight /></Link></Button>
            <p className="text-xs text-cream/75">Foto ilustrasi, bukan dokumentasi program qurbanity.</p>
          </Reveal>
        </div>
      </section>

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
        <div className="relative isolate overflow-hidden rounded-3xl p-8 text-center text-ivory md:p-14">
          <ParallaxImage src={farmImg} speed={0.15} className="rounded-3xl" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-burgundy-dark/90 via-burgundy-dark/70 to-burgundy-dark/45" aria-hidden />
          <Reveal variant="scale" className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight md:text-4xl">Yuk, mulai hari ini.</h2>
            <p className="mx-auto mt-3 max-w-xl text-cream/90">Sedikit demi sedikit, sampai Iduladha.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="ivory" size="lg" asChild><Link to="/simulasi">Mulai Kurban <ArrowRight /></Link></Button>
              <Button variant="light" size="lg" asChild><Link to="/kontak">Hubungi Kami</Link></Button>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
