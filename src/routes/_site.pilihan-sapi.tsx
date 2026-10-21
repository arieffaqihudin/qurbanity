import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Section, SectionHeading, Notice } from "@/components/site/primitives";
import { CategoryCard } from "@/components/site/CategoryCard";
import { CATEGORIES, fullPrice, isAvailable, pricePerShare } from "@/lib/pricing";
import { formatRupiah } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/pilihan-sapi")({
  head: () => seo("Pilihan Hewan Kurban", "Bandingkan Sapi Reguler, Sapi Super, Sapi Super Duper, dan Kambing: estimasi bobot, rincian biaya, dan harga per bagian."),
  component: Page,
});

const dash = <span className="text-muted-foreground">Belum ditetapkan</span>;

function Page() {
  return (
    <>
      <PageHeader eyebrow="Pilihan hewan" title="Hewan kurban sesuai niat dan kemampuan" intro="Setiap kategori mencakup harga hewan dan biaya operasional: perawatan, penyembelihan, pengemasan, dan distribusi." />
      <Section>
        <Notice kind="sample" className="mb-8">Seluruh harga di halaman ini adalah contoh dari PRD dan belum final. Harga resmi akan dikunci pada saat akad.</Notice>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => <CategoryCard key={c.id} c={c} featured={c.id === "sapi-reguler"} />)}
        </div>
      </Section>
      <Section tone="cream">
        <SectionHeading eyebrow="Perbandingan" title="Rincian biaya per kategori" />
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Perbandingan kategori hewan kurban (contoh harga)</caption>
            <thead className="bg-muted text-burgundy-dark">
              <tr>
                <th scope="col" className="p-4 font-bold">Rincian</th>
                {CATEGORIES.map((c) => <th key={c.id} scope="col" className="p-4 font-bold">{c.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <Row label="Estimasi bobot" cells={CATEGORIES.map((c) => c.weightRange)} />
              <Row label="Jumlah shahibul" cells={CATEGORIES.map((c) => (c.kind === "sapi" ? "1–7 bagian" : "1 orang"))} />
              <Row label="Harga hewan (utuh)" cells={CATEGORIES.map((c) => (c.animalCost ? formatRupiah(c.animalCost) : dash))} />
              <Row label="Biaya operasional" cells={CATEGORIES.map((c) => (c.operationalCost ? formatRupiah(c.operationalCost) : dash))} />
              <Row label="Total per ekor" strong cells={CATEGORIES.map((c) => (fullPrice(c) ? formatRupiah(fullPrice(c)!) : dash))} />
              <Row label="Harga per bagian" strong cells={CATEGORIES.map((c) => (pricePerShare(c) ? formatRupiah(pricePerShare(c)!) : dash))} />
              <Row label="Dapat dipilih" cells={CATEGORIES.map((c) => (isAvailable(c) ? <Check className="size-5 text-success" aria-label="Ya" /> : <Minus className="size-5 text-muted-foreground" aria-label="Belum" />))} />
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Sapi Super Duper belum dapat dipilih hingga harga final ditetapkan.</p>
        <Button size="lg" className="mt-8" asChild><Link to="/simulasi">Simulasikan cicilan <ArrowRight /></Link></Button>
      </Section>
    </>
  );
}

function Row({ label, cells, strong }: { label: string; cells: ReactNode[]; strong?: boolean }) {
  return (
    <tr>
      <th scope="row" className="p-4 font-semibold text-muted-foreground">{label}</th>
      {cells.map((c, i) => <td key={i} className={strong ? "p-4 font-extrabold text-primary tabular-nums" : "p-4 tabular-nums"}>{c}</td>)}
    </tr>
  );
}
