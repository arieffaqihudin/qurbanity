import { queryOptions } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AdminRole = Database["public"]["Enums"]["admin_role"];
export interface AdminAccess {
  role: AdminRole;
  permissions: string[];
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "Superadmin",
  finance: "Keuangan",
  program: "Pengelola Program",
  field_officer: "Petugas Lapangan",
  auditor: "Auditor",
  content: "Pengelola Konten",
};

export const ADMIN_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  final: "Final",
  locked: "Terkunci",
  approved: "Disetujui",
  scheduled: "Terjadwal",
  published: "Dipublikasikan",
  withdrawn: "Ditarik",
  pending: "Menunggu",
  failed: "Gagal",
  success: "Berhasil",
  cancelled: "Dibatalkan",
  canceled: "Dibatalkan",
  awaiting_decision: "Menunggu Keputusan",
  paid_off: "Lunas",
  converted_sedekah: "Dialihkan ke Sedekah",
  purchase: "Akad Pembelian Hewan",
  excess_allocation: "Pengalihan Kelebihan Dana",
  sedekah_transfer: "Pengalihan Dana ke Sedekah",
  active: "Aktif",
  inactive: "Nonaktif",
  open: "Dibuka",
  closed: "Ditutup",
  completed: "Selesai",
  menunggu: "Menunggu",
  dialokasikan: "Dialokasikan",
  disembelih: "Disembelih",
  didistribusikan: "Didistribusikan",
  lunas: "Lunas",
  belum_lunas: "Belum lunas",
  dalam_cicilan: "Dalam cicilan",
  verified: "Terverifikasi",
  declined: "Tidak disetujui",
  estimated: "Perkiraan",
  official: "Resmi",
  participant: "Peserta",
  admin: "Admin",
  system: "Sistem",
  app: "Aplikasi",
};

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  akad_1: "Akad Pembelian Hewan (Akad 1)",
  akad_2a: "Pengalihan Kelebihan Dana (Akad 2A)",
  akad_2b: "Pengalihan Dana ke Sedekah (Akad 2B)",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "commitment.create": "Komitmen dibuat",
  "participant.correct": "Data peserta diperbaiki",
  "shahibul.correct": "Nama peserta kurban diperbaiki",
  "ledger.post": "Catatan dana dibuat",
  "access.group_create": "Grup hak akses dibuat",
  "access.group_update": "Grup hak akses diubah",
  "access.group_duplicate": "Grup hak akses disalin",
  USER_CREATED: "Pengguna dibuat",
  USER_ACTIVATION_REQUESTED: "Aktivasi diminta",
  USER_INVITATION_SENT: "Undangan dikirim",
  USER_INVITATION_FAILED: "Undangan gagal dikirim",
  USER_ACTIVATION_EMAIL_RESENT: "Email aktivasi dikirim ulang",
  USER_ACTIVATED: "Pengguna diaktifkan",
  USER_DEACTIVATED: "Akses pengguna dinonaktifkan",
  "report.export": "Laporan diekspor",
};

export const ADMIN_FIELD_LABEL: Record<string, string> = {
  id: "ID",
  user_id: "Pengguna",
  full_name: "Nama lengkap",
  email: "Email",
  phone: "Nomor telepon",
  whatsapp: "WhatsApp",
  address: "Alamat",
  birth_date: "Tanggal lahir",
  status: "Status",
  setup_status: "Status akun",
  is_active: "Status aktif",
  created_at: "Waktu dibuat",
  updated_at: "Waktu diperbarui",
  approved_at: "Waktu disetujui",
  published_at: "Waktu diterbitkan",
  program_id: "Periode program",
  program_name: "Nama program",
  category_name_snapshot: "Kategori hewan",
  animal_cost_snapshot: "Harga hewan saat akad",
  operational_cost_snapshot: "Biaya operasional saat akad",
  price_per_share_snapshot: "Harga per bagian saat akad",
  total_amount: "Total komitmen",
  verified_paid_amount: "Dana terverifikasi",
  payment_status: "Status pembayaran",
  execution_status: "Status pelaksanaan",
  commitment_id: "Komitmen",
  source_account: "Dana dari",
  dest_account: "Dana ke",
  amount: "Nominal",
  reference: "Referensi",
  reason: "Alasan",
  action: "Tindakan",
  entity: "Bagian",
  entity_id: "ID catatan",
  result: "Hasil",
  source: "Sumber",
  role: "Peran",
  group_id: "Grup pengguna",
  permissions: "Hak akses",
  is_final: "Harga final",
  animal_cost: "Harga hewan",
  operational_cost: "Biaya operasional",
  note: "Catatan",
  code: "Kode",
  name: "Nama",
  title: "Judul",
  summary: "Ringkasan",
  body: "Isi",
  version: "Versi",
  category: "Kategori",
  category_name: "Kategori hewan",
  animal_kind: "Jenis hewan",
  animal_kind_snapshot: "Jenis hewan saat akad",
  shares: "Jumlah bagian",
  weight: "Perkiraan bobot",
  weight_range: "Rentang bobot",
  frequency: "Frekuensi setoran",
  deadline: "Batas pelunasan",
  payment_deadline: "Batas pelunasan",
  iduladha_date: "Tanggal Iduladha",
  date_status: "Status tanggal",
  hijri_year: "Tahun Hijriah",
  minimum_payment: "Pembayaran minimum",
  announcement_days: "Jarak pengumuman",
  contract_code: "Jenis akad",
  contract_type: "Jenis akad",
  contract_version: "Versi akad",
  decision: "Keputusan",
  preference: "Pilihan publikasi",
  execution: "Pelaksanaan",
  allocation: "Alokasi",
  participants: "Peserta",
  commitments: "Komitmen",
  total: "Jumlah",
  paid: "Dana terverifikasi",
  verified_total: "Dana terverifikasi",
  committed_total: "Total komitmen",
  payment_frequency: "Frekuensi setoran",
  published: "Status publikasi",
  withdrawn_reason: "Alasan penarikan",
  stage: "Tahap",
  stage_date: "Tanggal tahap",
  location: "Lokasi",
  visibility: "Visibilitas",
  document_category: "Jenis dokumen",
  actor: "Pelaku",
  actor_id: "Pelaku",
  ip_address: "Alamat jaringan",
  metadata: "Rincian tambahan",
};

export const LEDGER_LABEL: Record<string, string> = {
  EXTERNAL: "Dana Masuk/Keluar",
  COMMITMENT: "Dana Komitmen",
  ANIMAL: "Pembelian Hewan",
  OPERATIONAL: "Biaya Operasional",
  SEDEKAH: "Dana Sedekah",
  EXCESS: "Kelebihan Dana",
  KUASA: "Dana Titipan",
  REFUND: "Pengembalian Dana",
  CANCEL_COST: "Biaya Pembatalan",
  USED: "Dana Terpakai",
};

export function displayAdminLabel(value: string | null | undefined, fallback = "Tidak diketahui") {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return (
    ADMIN_STATUS_LABEL[normalized] ??
    ROLE_LABEL[normalized as AdminRole] ??
    CONTRACT_TYPE_LABEL[normalized] ??
    LEDGER_LABEL[value] ??
    fallback
  );
}

export function displayAuditAction(value: string | null | undefined) {
  if (!value) return "Aktivitas tercatat";
  return (
    AUDIT_ACTION_LABEL[value] ?? (value.includes(".") ? "Data diperbarui" : "Aktivitas tercatat")
  );
}

export function displayAdminField(value: string) {
  return ADMIN_FIELD_LABEL[value] ?? "Detail lainnya";
}

/** UI-only permission check. The database re-checks every read (RLS) and write (require_perm). */
export function can(access: AdminAccess | null | undefined, perms: string | string[]) {
  if (!access) return false;
  const list = Array.isArray(perms) ? perms : [perms];
  return access.permissions.includes("*") || list.some((p) => access.permissions.includes(p));
}

export function useAdmin() {
  const ctx = useRouteContext({ from: "/_authenticated/admin" });
  return { access: ctx.access, can: (p: string | string[]) => can(ctx.access, p) };
}

/** Calls a SECURITY DEFINER admin function. Errors from the DB are already in Indonesian. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>
  )(fn, args);
  if (error) throw new Error(friendlyDbError(error.message));
  return data as T;
}

export function friendlyDbError(msg: string) {
  if (/permission denied|42501/i.test(msg))
    return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
  if (/duplicate key.*code/i.test(msg)) return "Kode sudah dipakai. Gunakan kode lain.";
  if (/duplicate key/i.test(msg)) return "Data yang sama sudah ada.";
  if (
    /\b(sql|postgres|postgrest|supabase|function|relation|column|constraint|stack|exception|rpc|json|uuid|violates|does not exist|typeerror|referenceerror|networkerror|database|request|server|query)\b/i.test(
      msg,
    ) ||
    /\b(error|failed|failure|not found|invalid|unauthorized|forbidden)\b/i.test(msg)
  )
    return "Terjadi kendala. Silakan coba lagi.";
  return msg;
}

export const programsQuery = queryOptions({
  queryKey: ["admin", "programs"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .order("iduladha_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export const PROGRAM_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  open: "Dibuka",
  closed: "Ditutup",
  completed: "Selesai",
};
export const DOC_CATEGORY_LABEL: Record<string, string> = {
  animal_photo: "Foto hewan",
  preparation: "Persiapan",
  slaughter: "Penyembelihan",
  distribution: "Distribusi",
  beneficiaries: "Penerima manfaat",
  supporting: "Dokumen pendukung",
  impact_report: "Laporan dampak",
};
export const STAGES = [
  "Persiapan Hewan",
  "Pelaksanaan Kurban",
  "Distribusi Daging",
  "Laporan Dampak",
] as const;

/** Builds CSV text (RFC 4180, ; safe) from row objects. */
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s =
      v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function download(name: string, content: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Excel-compatible HTML table (.xls) — opens in Excel/Sheets without extra libraries. */
export function toExcelHtml(rows: Record<string, unknown>[], title: string) {
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");
  return `<html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><table border="1"><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${rows
    .map(
      (r) =>
        `<tr>${cols.map((c) => `<td>${esc(typeof r[c] === "object" && r[c] !== null ? JSON.stringify(r[c]) : r[c])}</td>`).join("")}</tr>`,
    )
    .join("")}</table></body></html>`;
}
