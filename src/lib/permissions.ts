import { ADMIN_GROUPS } from "@/lib/navigation";

export interface PermEntry {
  key: string;
  label: string;
  sensitive?: boolean;
}
export interface PermMenu {
  label: string;
  perms: PermEntry[];
}
export interface PermSection {
  group: string;
  menus: PermMenu[];
}

/** Indonesian labels for every real permission the backend enforces. */
export const PERM_LABEL: Record<string, string> = {
  "*": "Semua hak akses",
  "dashboard.view": "Lihat ringkasan",
  "participants.view": "Lihat Peserta",
  "participants.edit": "Koreksi Data Peserta",
  "finance.view": "Lihat transaksi & keuangan",
  "finance.manage": "Verifikasi & Kelola Pembayaran",
  "payments.config": "Kelola Aturan Nominal",
  "recovery.manage": "Kelola Pemulihan Akun",
  "catalog.view": "Lihat Hewan & Harga",
  "catalog.manage": "Kelola Kategori & Harga",
  "allocation.view": "Lihat alokasi",
  "allocation.manage": "Kelola Alokasi",
  "allocation.lock": "Kunci Alokasi",
  "journey.view": "Lihat pelaksanaan",
  "journey.manage": "Kelola Tahap Pelaksanaan",
  "docs.upload": "Unggah Dokumentasi",
  "docs.publish": "Publikasi Dokumentasi",
  "announcement.view": "Lihat pengumuman",
  "announcement.manage": "Publikasi Pengumuman",
  "reports.view": "Lihat laporan",
  "reports.export": "Ekspor Laporan",
  "audit.view": "Lihat Log Aktivitas",
  "audit.export": "Ekspor Log Aktivitas",
  "program.view": "Lihat program & akad",
  "program.manage": "Kelola Program & Akad",
  "settings.view": "Lihat pengaturan",
  "settings.manage": "Kelola Identitas & Website",
  "content.manage": "Kelola Konten Website",
  "characters.manage": "Kelola Karakter Hewan",
  "notifications.manage": "Kelola Templat Notifikasi",
  "access.manage": "Kelola Hak Akses",
  "users.manage": "Kelola Pengguna",
};

/** Permissions with elevated impact — highlighted in the matrix. */
export const SENSITIVE_PERMS = new Set([
  "*",
  "access.manage",
  "users.manage",
  "finance.manage",
  "allocation.lock",
  "audit.export",
]);

/** Manage/action permissions that are not visible as sidebar menu permissions, attached to their module. */
const ACTION_PERMS: Record<string, string[]> = {
  "/admin/peserta": ["participants.edit"],
  "/admin/pembayaran": ["finance.manage"],
  "/admin/sapi": ["catalog.manage"],
  "/admin/alokasi": ["allocation.manage", "allocation.lock"],
  "/admin/penyaluran": ["journey.manage", "docs.publish"],
  "/admin/pengumuman": ["announcement.manage"],
  "/admin/laporan": ["reports.export"],
  "/admin/log-aktivitas": ["audit.export"],
  "/admin/program": ["program.manage"],
  "/admin/identitas": ["settings.manage"],
  "/admin/hak-akses": ["access.manage"],
  "/admin/pengguna": ["users.manage"],
};

/** Permission matrix generated from the actual admin sidebar registry. */
export function permissionSections(): PermSection[] {
  return ADMIN_GROUPS.map((g) => ({
    group: g.label,
    menus: g.items
      .flatMap((h) =>
        h.tabs.map((t) => {
          const keys = [...new Set([...t.perms, ...(ACTION_PERMS[t.to] ?? [])])].filter(
            (k) => k !== "*" && PERM_LABEL[k],
          );
          return {
            label: h.tabs.length > 1 ? `${h.label} — ${t.label}` : t.label,
            perms: keys.map((k) => ({
              key: k,
              label: PERM_LABEL[k]!,
              sensitive: SENSITIVE_PERMS.has(k),
            })),
          };
        }),
      )
      .filter((m) => m.perms.length),
  })).filter((s) => s.menus.length);
}

/** All selectable permission keys (everything except the superadmin wildcard). */
export function allPermissionKeys(): string[] {
  return permissionSections().flatMap((s) => s.menus.flatMap((m) => m.perms.map((p) => p.key)));
}

export function isViewPerm(key: string) {
  return key.endsWith(".view");
}
