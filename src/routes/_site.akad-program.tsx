import { createFileRoute } from "@tanstack/react-router";
import { Lock, BookOpen, Scale, FileSearch } from "lucide-react";
import { PageHeader, Section, SectionHeading, Notice, Placeholder } from "@/components/site/primitives";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/akad-program")({
  head: () => seo("Akad Program", "Struktur akad dan prinsip transparansi keuangan program kurban bertahap qurbanity."),
  component: Page,
});

const principles = [
  { icon: Lock, t: "Harga dikunci saat akad", d: "Harga hewan dan biaya operasional disepakati di awal dan berlaku hingga komitmen selesai." },
  { icon: BookOpen, t: "Pencatatan ledger", d: "Setiap pembayaran, koreksi, dan pengembalian dicatat sebagai entri permanen yang dapat diaudit." },
  { icon: Scale, t: "Pemisahan dana", d: "Dana peserta dicatat terpisah dari dana operasional lembaga." },
  { icon: FileSearch, t: "Laporan terbuka", d: "Ringkasan penerimaan dan penyaluran dipublikasikan secara berkala." },
];

function Page() {
  return (
    <>
      <PageHeader eyebrow="Akad program" title="Akad yang jelas, amanah yang terjaga" intro="Gambaran struktur kesepakatan antara peserta dan Manfaat Mengalir dalam program kurban bertahap." />
      <Section>
        <Notice kind="pending" className="mb-8">Teks akad resmi, termasuk jenis akad syariah yang digunakan, masih dalam peninjauan dewan syariah dan tim hukum. Halaman ini bersifat pengantar dan belum mengikat.</Notice>
        <SectionHeading eyebrow="Struktur" title="Pihak dan objek akad" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Peserta (shahibul kurban)", "Pihak yang berkomitmen membeli hewan atau bagian hewan kurban."],
            ["Manfaat Mengalir", "Pengelola program yang menyediakan hewan, merawat, menyembelih, dan mendistribusikan."],
            ["Objek akad", "Hewan kurban sesuai kategori dan jumlah bagian, dengan harga yang dikunci saat akad."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-5"><p className="font-bold text-burgundy-dark">{t}</p><p className="mt-1.5 text-sm text-muted-foreground">{d}</p></div>
          ))}
        </div>
      </Section>
      <Section tone="cream">
        <SectionHeading eyebrow="Prinsip" title="Transparansi keuangan" />
        <div className="grid gap-4 sm:grid-cols-2">
          {principles.map((p) => (
            <div key={p.t} className="flex gap-4 rounded-2xl bg-card p-5 shadow-soft">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><p.icon className="size-5" /></span>
              <div><p className="font-bold text-burgundy-dark">{p.t}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.d}</p></div>
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <SectionHeading eyebrow="Dokumen" title="Teks resmi akad" />
        <div className="grid gap-4 md:grid-cols-2">
          <Placeholder title="Jenis dan lafaz akad" />
          <Placeholder title="Hak dan kewajiban para pihak" />
          <Placeholder title="Ketentuan pembatalan dan pengembalian dana" />
          <Placeholder title="Ketentuan keadaan kahar (force majeure)" />
        </div>
      </Section>
    </>
  );
}
