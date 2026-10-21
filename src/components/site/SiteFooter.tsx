import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const cols = [
  { title: "Program", links: [["/pilihan-sapi", "Pilihan Hewan"], ["/simulasi", "Simulasi"], ["/cara-kerja", "Cara Kerja"], ["/akad-program", "Akad Program"]] },
  { title: "Transparansi", links: [["/dampak", "Dampak"], ["/verifikasi", "Verifikasi Dokumen"], ["/tentang", "Tentang Kami"]] },
  { title: "Bantuan", links: [["/faq", "FAQ"], ["/kontak", "Kontak"], ["/kebijakan-privasi", "Kebijakan Privasi"], ["/syarat-ketentuan", "Syarat & Ketentuan"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-burgundy-dark text-cream">
      <div className="container-q grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/75">
            Platform komitmen kurban bertahap yang amanah dan transparan. Bukan produk perbankan atau tabungan.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="mb-3 text-sm font-bold text-gold">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map(([to, label]) => (
                <li key={to}><Link to={to} className="text-sm text-cream/80 transition-colors hover:text-ivory">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-sidebar-border">
        <div className="container-q flex flex-col gap-2 py-5 text-xs text-cream/60 md:flex-row md:justify-between">
          <p>© 2026 Manfaat Mengalir. Seluruh hak dilindungi.</p>
          <p>Harga dan data yang ditampilkan di situs ini adalah contoh selama tahap pengembangan.</p>
        </div>
      </div>
    </footer>
  );
}
