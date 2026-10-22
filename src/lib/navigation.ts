import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, HeartHandshake, Wallet, History, Camera, FileText, UserCircle,
  Users, CreditCard, BadgeCheck, XCircle, KeyRound, PawPrint, Tags, Split, Megaphone,
  Route as RouteIcon, Landmark, BarChart3, ScrollText, Settings, ShieldCheck,
  CalendarRange, Building2, Sparkles, Coins, Bell, UserCog,
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

/** Every admin page (one per route). Pages that share a workspace appear as tabs of one sidebar entry. */
const P = {
  dashboard: { to: "/admin", label: "Ringkasan", icon: LayoutDashboard, description: "Kondisi program saat ini dan hal yang perlu ditindaklanjuti.", perms: ["dashboard.view"] },
  peserta: { to: "/admin/peserta", label: "Peserta", icon: Users, description: "Cari peserta, lihat komitmen, persetujuan, dan koreksi data.", perms: ["participants.view"] },
  transaksi: { to: "/admin/transaksi", label: "Transaksi", icon: CreditCard, description: "Dana masuk dan keluar yang tercatat di ledger.", perms: ["finance.view"] },
  verifikasi: { to: "/admin/verifikasi", label: "Antrian Verifikasi", icon: BadgeCheck, description: "Pembayaran yang menunggu verifikasi.", perms: ["finance.manage"] },
  nominal: { to: "/admin/nominal-pembayaran", label: "Aturan Nominal", icon: Coins, description: "Batas nominal, nominal cepat, dan metode pembayaran.", perms: ["payments.config"] },
  pembatalan: { to: "/admin/pembatalan", label: "Pembatalan & Pengembalian", icon: XCircle, description: "Pengajuan pembatalan komitmen dan pengembalian dana.", perms: ["finance.manage"] },
  pemulihan: { to: "/admin/pemulihan-akun", label: "Pemulihan Akun", icon: KeyRound, description: "Bantuan bagi peserta yang kehilangan akses akun.", perms: ["recovery.manage"] },
  sapi: { to: "/admin/sapi", label: "Kategori Hewan", icon: PawPrint, description: "Jenis hewan, kapasitas patungan, dan ketersediaan.", perms: ["catalog.view"] },
  harga: { to: "/admin/harga", label: "Harga & Riwayat", icon: Tags, description: "Harga berlaku dan riwayat perubahannya. Harga komitmen yang sudah akad tidak berubah.", perms: ["catalog.view"] },
  alokasi: { to: "/admin/alokasi", label: "Alokasi Hewan", icon: Split, description: "Kelompokkan peserta lunas ke unit hewan, lalu kunci setelah ditinjau.", perms: ["allocation.view"] },
  penyaluran: { to: "/admin/penyaluran", label: "Pelaksanaan & Dokumentasi", icon: RouteIcon, description: "Empat tahap pelaksanaan beserta dokumentasinya.", perms: ["journey.view", "docs.upload"] },
  pengumuman: { to: "/admin/pengumuman", label: "Pengumuman Kelompok", icon: Megaphone, description: "Snapshot kelompok hewan H-7 dan publikasinya.", perms: ["announcement.view"] },
  keuangan: { to: "/admin/keuangan", label: "Rekonsiliasi", icon: Landmark, description: "Saldo per akun ledger untuk dicocokkan dengan rekening.", perms: ["finance.view"] },
  sedekah: { to: "/admin/sedekah", label: "Pengelolaan Dana", icon: HeartHandshake, description: "Kelebihan dana, sedekah, dan pengembalian.", perms: ["finance.view"] },
  laporan: { to: "/admin/laporan", label: "Laporan", icon: BarChart3, description: "Pilih jenis laporan, atur filter, pratinjau, lalu unduh.", perms: ["reports.view"] },
  logAktivitas: { to: "/admin/log-aktivitas", label: "Log Aktivitas", icon: ScrollText, description: "Jejak audit lengkap seluruh aksi penting; tidak dapat diubah atau dihapus.", perms: ["audit.view"] },
  program: { to: "/admin/program", label: "Program & Akad", icon: CalendarRange, description: "Periode program, tanggal penting, dan versi akad.", perms: ["program.view"] },
  identitas: { to: "/admin/identitas", label: "Identitas", icon: Building2, description: "Profil organisasi dan penerbit dokumen.", perms: ["settings.view"] },
  konten: { to: "/admin/konten", label: "Konten Website", icon: FileText, description: "Teks beranda, kontak, dan info program.", perms: ["content.manage", "settings.view"] },
  website: { to: "/admin/pengaturan-website", label: "Tampilan Website", icon: Settings, description: "Mode pemeliharaan dan elemen yang tampil di situs.", perms: ["settings.view"] },
  karakter: { to: "/admin/karakter-hewan", label: "Karakter Hewan", icon: Sparkles, description: "Nama karakter di Padang Kurban peserta.", perms: ["settings.view", "characters.manage"] },
  notifikasi: { to: "/admin/notifikasi", label: "Templat Notifikasi", icon: Bell, description: "Templat pesan dan kanal pengiriman.", perms: ["notifications.manage", "settings.view"] },
  hakAkses: { to: "/admin/hak-akses", label: "Hak Akses", icon: ShieldCheck, description: "Grup pengguna dan matriks hak akses untuk setiap menu (khusus SUPERADMIN).", perms: ["access.manage"] },
  pengguna: { to: "/admin/pengguna", label: "Pengguna", icon: UserCog, description: "Akun admin: undangan, penugasan grup, dan status akses (khusus SUPERADMIN).", perms: ["users.manage"] },
} satisfies Record<string, AdminNavItem>;

/** A sidebar entry. `tabs` (≥2) are sibling pages shown as tabs inside the workspace. */
export interface AdminHub { label: string; icon: LucideIcon; description: string; tabs: AdminNavItem[] }
export interface AdminNavGroup { label: string; items: AdminHub[] }

const hub = (label: string, icon: LucideIcon, description: string, ...tabs: AdminNavItem[]): AdminHub => ({ label, icon, description, tabs });
const one = (t: AdminNavItem): AdminHub => hub(t.label, t.icon, t.description, t);

export const ADMIN_GROUPS: AdminNavGroup[] = [
  { label: "Dashboard", items: [one(P.dashboard)] },
  { label: "Peserta & Transaksi", items: [
    one(P.peserta),
    hub("Pembayaran", CreditCard, "Transaksi, antrian verifikasi, dan aturan nominal pembayaran.", P.transaksi, P.verifikasi, P.nominal),
    one(P.pembatalan), one(P.pemulihan),
  ] },
  { label: "Pengelolaan Kurban", items: [
    hub("Hewan & Harga", PawPrint, "Kategori hewan, harga berlaku, dan riwayat harga.", P.sapi, P.harga),
    one(P.alokasi), one(P.penyaluran), one(P.pengumuman),
  ] },
  { label: "Keuangan", items: [one(P.keuangan), one(P.sedekah)] },
  { label: "Laporan", items: [one(P.laporan)] },
  { label: "Pengaturan", items: [
    one(P.program),
    hub("Pengaturan Umum", Building2, "Identitas organisasi, konten, tampilan situs, karakter hewan, dan templat notifikasi.", P.identitas, P.konten, P.website, P.karakter, P.notifikasi),
    one(P.hakAkses), one(P.pengguna), one(P.logAktivitas),
  ] },
];

export const ADMIN_ITEMS: AdminNavItem[] = ADMIN_GROUPS.flatMap((g) => g.items.flatMap((h) => h.tabs));
export const adminItem = (to: string) => ADMIN_ITEMS.find((i) => i.to === to)!;
export const adminHubOf = (to: string) => ADMIN_GROUPS.flatMap((g) => g.items.map((h) => ({ group: g.label, hub: h }))).find((x) => x.hub.tabs.some((t) => t.to === to));
