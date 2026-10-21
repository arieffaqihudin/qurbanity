import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, HeartHandshake, Wallet, History, Camera, FileText, UserCircle,
  Users, CreditCard, BadgeCheck, XCircle, KeyRound, PawPrint, Tags, Split, Megaphone,
  Route as RouteIcon, Landmark, BarChart3, ScrollText, Settings, ShieldCheck,
} from "lucide-react";

export const PUBLIC_NAV = [
  { to: "/pilihan-sapi", label: "Pilihan Hewan" },
  { to: "/simulasi", label: "Simulasi" },
  { to: "/cara-kerja", label: "Cara Kerja" },
  { to: "/akad-program", label: "Akad" },
  { to: "/dampak", label: "Dampak" },
  { to: "/tentang", label: "Tentang" },
  { to: "/faq", label: "FAQ" },
] as const;

export interface ShellItem {
  slug: string; // "" = index
  label: string;
  icon: LucideIcon;
  description: string;
}

export const PORTAL_NAV: ShellItem[] = [
  { slug: "", label: "Dashboard", icon: LayoutDashboard, description: "Ringkasan komitmen kurban dan progres pembayaran terverifikasi." },
  { slug: "kurban-saya", label: "Kurban Saya", icon: HeartHandshake, description: "Daftar komitmen kurban dengan harga terkunci saat akad." },
  { slug: "bayar", label: "Bayar", icon: Wallet, description: "Pembayaran cicilan dengan nominal fleksibel." },
  { slug: "aktivitas", label: "Aktivitas & Riwayat", icon: History, description: "Riwayat transaksi dan aktivitas akun." },
  { slug: "dokumentasi", label: "Dokumentasi", icon: Camera, description: "Foto dan video perjalanan hewan kurban Anda." },
  { slug: "laporan", label: "Laporan", icon: FileText, description: "Laporan pelaksanaan dan distribusi kurban." },
  { slug: "akun", label: "Akun & Profil", icon: UserCircle, description: "Data diri, keamanan akun, dan persetujuan publikasi." },
];

export const ADMIN_NAV: ShellItem[] = [
  { slug: "", label: "Ringkasan", icon: LayoutDashboard, description: "Indikator utama program dan pembayaran." },
  { slug: "peserta", label: "Peserta", icon: Users, description: "Data peserta dan komitmen kurban." },
  { slug: "pembayaran", label: "Pembayaran", icon: CreditCard, description: "Ledger pembayaran masuk." },
  { slug: "verifikasi", label: "Verifikasi", icon: BadgeCheck, description: "Antrian verifikasi pembayaran dan dokumen." },
  { slug: "pembatalan", label: "Pembatalan", icon: XCircle, description: "Pengajuan pembatalan komitmen." },
  { slug: "pemulihan-akun", label: "Pemulihan Akun", icon: KeyRound, description: "Permintaan pemulihan akses peserta." },
  { slug: "kategori-hewan", label: "Kategori Hewan", icon: PawPrint, description: "Pengelolaan kategori dan ketersediaan hewan." },
  { slug: "harga", label: "Harga & Riwayat", icon: Tags, description: "Penetapan harga dan riwayat perubahan." },
  { slug: "alokasi", label: "Alokasi", icon: Split, description: "Alokasi peserta ke hewan kurban." },
  { slug: "pengumuman", label: "Pengumuman H-7", icon: Megaphone, description: "Pengumuman resmi menjelang Iduladha." },
  { slug: "perjalanan", label: "Perjalanan & Dokumentasi", icon: RouteIcon, description: "Tahapan perjalanan dan unggahan dokumentasi." },
  { slug: "keuangan", label: "Keuangan", icon: Landmark, description: "Rekonsiliasi dan pembukuan berbasis ledger." },
  { slug: "laporan", label: "Laporan", icon: BarChart3, description: "Laporan program dan dampak." },
  { slug: "audit-log", label: "Audit Log", icon: ScrollText, description: "Jejak audit seluruh aksi administratif." },
  { slug: "pengaturan", label: "Pengaturan", icon: Settings, description: "Konfigurasi program." },
  { slug: "manajemen-admin", label: "Manajemen Admin", icon: ShieldCheck, description: "Peran dan izin admin (ditegakkan di backend)." },
];
