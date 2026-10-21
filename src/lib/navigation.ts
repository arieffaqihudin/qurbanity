import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, HeartHandshake, Wallet, History, Camera, FileText, UserCircle,
  Users, CreditCard, BadgeCheck, XCircle, KeyRound, PawPrint, Tags, Split, Megaphone,
  Route as RouteIcon, Landmark, BarChart3, ScrollText, Settings, ShieldCheck,
  CalendarRange, Building2, Sparkles, Coins, Bell,
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
  { slug: "dokumentasi", label: "Dokumentasi", icon: Camera, description: "Foto dan video perjalanan hewan kurbanmu." },
  { slug: "laporan", label: "Laporan", icon: FileText, description: "Laporan pelaksanaan dan distribusi kurban." },
  { slug: "akun", label: "Akun & Profil", icon: UserCircle, description: "Data diri, keamanan akun, dan persetujuan publikasi." },
];

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** any-of permission list; enforced again in the database */
  perms: string[];
}
export interface AdminNavGroup { label: string; items: AdminNavItem[] }

export const ADMIN_GROUPS: AdminNavGroup[] = [
  { label: "Ringkasan", items: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, description: "Indikator utama program dari data tersimpan.", perms: ["dashboard.view"] },
  ] },
  { label: "Peserta & Pembayaran", items: [
    { to: "/admin/peserta", label: "Peserta", icon: Users, description: "Data peserta, komitmen, dan koreksi data.", perms: ["participants.view"] },
    { to: "/admin/transaksi", label: "Transaksi", icon: CreditCard, description: "Pembayaran masuk yang tercatat di ledger.", perms: ["finance.view"] },
    { to: "/admin/verifikasi", label: "Pusat Verifikasi", icon: BadgeCheck, description: "Antrian verifikasi pembayaran.", perms: ["finance.manage"] },
    { to: "/admin/pembatalan", label: "Pembatalan", icon: XCircle, description: "Pengajuan pembatalan dan pengembalian dana.", perms: ["finance.manage"] },
    { to: "/admin/pemulihan-akun", label: "Pemulihan Akun", icon: KeyRound, description: "Permintaan pemulihan akses peserta.", perms: ["recovery.manage"] },
  ] },
  { label: "Operasional Kurban", items: [
    { to: "/admin/sapi", label: "Kategori Hewan", icon: PawPrint, description: "Katalog kategori hewan dan ketersediaan.", perms: ["catalog.view"] },
    { to: "/admin/harga", label: "Harga & Riwayat", icon: Tags, description: "Penetapan harga (append-only) dan riwayatnya.", perms: ["catalog.view"] },
    { to: "/admin/alokasi", label: "Alokasi & Kelompok Hewan", icon: Split, description: "Unit hewan dan alokasi komitmen lunas.", perms: ["allocation.view"] },
    { to: "/admin/pengumuman", label: "Pengumuman H-7", icon: Megaphone, description: "Snapshot kelompok hewan dan publikasinya.", perms: ["announcement.view"] },
    { to: "/admin/penyaluran", label: "Perjalanan & Dokumentasi", icon: RouteIcon, description: "Tahapan pelaksanaan dan dokumentasi.", perms: ["journey.view", "docs.upload"] },
  ] },
  { label: "Keuangan", items: [
    { to: "/admin/sedekah", label: "Sedekah & Kelebihan Dana", icon: HeartHandshake, description: "Kelebihan dana, pengembalian, dan sedekah.", perms: ["finance.view"] },
    { to: "/admin/keuangan", label: "Rekonsiliasi Keuangan", icon: Landmark, description: "Saldo per akun dan entri ledger.", perms: ["finance.view"] },
  ] },
  { label: "Laporan & Audit", items: [
    { to: "/admin/laporan", label: "Laporan", icon: BarChart3, description: "13 kategori laporan dari data tersimpan.", perms: ["reports.view"] },
    { to: "/admin/audit", label: "Audit Log", icon: ScrollText, description: "Jejak seluruh aksi penting.", perms: ["audit.view"] },
  ] },
  { label: "Pengaturan", items: [
    { to: "/admin/program", label: "Program & Akad", icon: CalendarRange, description: "Periode program dan versi akad.", perms: ["program.view"] },
    { to: "/admin/identitas", label: "Identitas Penyelenggara", icon: Building2, description: "Profil dan identitas penerbit dokumen.", perms: ["settings.view"] },
    { to: "/admin/karakter-hewan", label: "Karakter Hewan", icon: Sparkles, description: "Nama dan tampilan karakter Padang Kurban.", perms: ["settings.view", "characters.manage"] },
    { to: "/admin/nominal-pembayaran", label: "Nominal Pembayaran", icon: Coins, description: "Batas nominal dan metode (belum aktif).", perms: ["payments.config"] },
    { to: "/admin/konten", label: "Konten Website", icon: FileText, description: "Teks beranda, kontak, dan info program.", perms: ["content.manage", "settings.view"] },
    { to: "/admin/notifikasi", label: "Notifikasi", icon: Bell, description: "Templat dan kanal notifikasi.", perms: ["notifications.manage", "settings.view"] },
    { to: "/admin/pengaturan-website", label: "Pengaturan Website", icon: Settings, description: "Tampilan umum situs.", perms: ["settings.view"] },
    { to: "/admin/manajemen-admin", label: "Manajemen Admin", icon: ShieldCheck, description: "Akun admin dan peran (khusus SUPERADMIN).", perms: ["admins.manage"] },
  ] },
];

export const ADMIN_ITEMS = ADMIN_GROUPS.flatMap((g) => g.items);
export const adminItem = (to: string) => ADMIN_ITEMS.find((i) => i.to === to)!;
