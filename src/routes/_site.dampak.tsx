import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Section, SectionHeading, Notice, StatusPill } from "@/components/site/primitives";
import { formatNumber } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/dampak")({
  head: () => seo("Laporan Dampak", "Laporan dampak program kurban qurbanity: jumlah pekurban, hewan, paket daging, dan wilayah penerima."),
  component: Page,
});

// SAMPLE DATA — not real program results.
const stats = [
  { v: 1240, l: "Pekurban" },
  { v: 168, l: "Ekor sapi" },
  { v: 214, l: "Ekor kambing" },
  { v: 18600, l: "Paket daging" },
];
const regions = [
  { name: "Kab. Bogor", pct: 32 },
  { name: "Kab. Garut", pct: 24 },
  { name: "Kab. Lebak", pct: 18 },
  { name: "Kab. Cianjur", pct: 15 },
  { name: "Lainnya", pct: 11 },
];

function Page() {
  return (
    <>
      <PageHeader eyebrow="Dampak" title="Kebaikan yang dapat diukur" intro="Ringkasan publik pelaksanaan dan distribusi kurban." />
      <Section>
        <Notice kind="sample" className="mb-8">Seluruh angka di halaman ini adalah ilustrasi tampilan laporan. Data riil akan ditampilkan setelah program berjalan.</Notice>
        <div className="mb-4 flex items-center gap-2"><h2 className="text-xl font-extrabold text-burgundy-dark">Iduladha 1447 H</h2><StatusPill kind="sample" /></div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-3xl font-extrabold tabular-nums text-primary md:text-4xl">{formatNumber(s.v)}</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section tone="cream">
        <SectionHeading eyebrow="Distribusi" title="Sebaran wilayah penerima" />
        <div className="space-y-4 rounded-2xl bg-card p-5 shadow-soft md:p-8">
          {regions.map((r) => (
            <div key={r.name}>
              <div className="mb-1.5 flex justify-between text-sm font-semibold"><span>{r.name}</span><span className="tabular-nums">{r.pct}%</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={r.name}>
                <div className="h-full rounded-full bg-burgundy-gradient" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Nama peserta hanya ditampilkan dengan persetujuan publikasi.</p>
      </Section>
    </>
  );
}
