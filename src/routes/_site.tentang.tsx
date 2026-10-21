import { createFileRoute } from "@tanstack/react-router";
import { HandHeart, Sparkles, Users } from "lucide-react";
import { PageHeader, Section, SectionHeading } from "@/components/site/primitives";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/tentang")({
  head: () => seo("Tentang Kami", "Mengenal Manfaat Mengalir dan inisiatif qurbanity untuk memudahkan umat menunaikan ibadah kurban."),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader eyebrow="Tentang kami" title="Manfaat yang terus mengalir" intro="qurbanity lahir dari keyakinan bahwa setiap Muslim yang berniat kurban layak mendapatkan jalan yang mudah, amanah, dan transparan." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
            <p><strong className="text-burgundy-dark">Manfaat Mengalir</strong> adalah inisiatif sosial-keagamaan yang berfokus pada program kebaikan berkelanjutan.</p>
            <p>Banyak keluarga ingin berkurban, namun terkendala harga yang harus dibayar sekaligus. qurbanity membantu mewujudkan niat itu melalui komitmen bertahap dengan harga yang dikunci sejak awal.</p>
            <p>Kami menjaga amanah dengan pencatatan yang rapi, verifikasi setiap pembayaran, dan laporan pelaksanaan yang dapat diakses peserta.</p>
          </div>
          <div className="grid gap-4">
            {[
              { icon: HandHeart, t: "Misi", d: "Memudahkan umat menunaikan ibadah kurban secara terencana." },
              { icon: Sparkles, t: "Nilai", d: "Amanah, transparan, dan memuliakan peserta serta penerima." },
              { icon: Users, t: "Komunitas", d: "Menghubungkan pekurban dengan masyarakat yang membutuhkan." },
            ].map((x) => (
              <div key={x.t} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <x.icon className="size-6 shrink-0 text-primary" />
                <div><p className="font-bold text-burgundy-dark">{x.t}</p><p className="text-sm text-muted-foreground">{x.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <Section tone="cream">
        <SectionHeading title="Profil lembaga" intro="Informasi legalitas, susunan pengurus, dan dewan pengawas syariah akan ditampilkan setelah dokumen resmi tersedia." />
      </Section>
    </>
  );
}
