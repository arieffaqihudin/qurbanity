import { Reveal } from "@/components/site/motion";
import { ClipboardCheck, Lock, Wallet, BadgeCheck, Truck, HeartHandshake } from "lucide-react";

export const STEPS = [
  { icon: ClipboardCheck, title: "Pilih & simulasikan", text: "Pilih kategori hewan dan jumlah bagian, lalu lihat estimasi cicilan." },
  { icon: Lock, title: "Akad & kunci harga", text: "Buat komitmen. Harga hewan dikunci sejak akad dibuat." },
  { icon: Wallet, title: "Bayar bertahap", text: "Setor kapan saja dengan nominal fleksibel hingga lunas sebelum batas waktu." },
  { icon: BadgeCheck, title: "Verifikasi pembayaran", text: "Setiap pembayaran diverifikasi. Progres hanya dihitung dari yang berhasil." },
  { icon: Truck, title: "Alokasi & pengumuman H-7", text: "Kamu dialokasikan ke hewan tertentu dan menerima pengumuman resmi." },
  { icon: HeartHandshake, title: "Pelaksanaan & laporan", text: "Penyembelihan dan distribusi didokumentasikan untukmu." },
];

export function Steps() {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((s, i) => (
        <Reveal as="li" key={s.title} delay={(i % 3) * 110} className="relative rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon className="size-5" /></span>
            <span className="text-3xl font-extrabold text-cream">0{i + 1}</span>
          </div>
          <h3 className="text-lg font-bold text-burgundy-dark">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
        </Reveal>
      ))}
    </ol>
  );
}
