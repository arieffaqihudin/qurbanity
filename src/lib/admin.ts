import { queryOptions } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AdminRole = Database["public"]["Enums"]["admin_role"];
export interface AdminAccess { role: AdminRole; permissions: string[] }

export const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "SUPERADMIN", finance: "FINANCE", program: "PROGRAM", field_officer: "FIELD OFFICER", auditor: "AUDITOR", content: "CONTENT",
};

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
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>)(fn, args);
  if (error) throw new Error(friendlyDbError(error.message));
  return data as T;
}

export function friendlyDbError(msg: string) {
  if (/permission denied|42501/i.test(msg)) return "Akses ditolak: kamu tidak memiliki izin untuk tindakan ini";
  if (/duplicate key.*code/i.test(msg)) return "Kode sudah dipakai. Gunakan kode lain.";
  if (/duplicate key/i.test(msg)) return "Data yang sama sudah ada.";
  return msg;
}

export const programsQuery = queryOptions({
  queryKey: ["admin", "programs"],
  queryFn: async () => {
    const { data, error } = await supabase.from("programs").select("*").order("iduladha_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export const PROGRAM_STATUS_LABEL: Record<string, string> = { draft: "Draf", open: "Dibuka", closed: "Ditutup", completed: "Selesai" };
export const LEDGER_LABEL: Record<string, string> = {
  EXTERNAL: "Eksternal (dana masuk/keluar)", COMMITMENT: "Dana Komitmen", ANIMAL: "Pembelian Hewan", OPERATIONAL: "Operasional",
  SEDEKAH: "Sedekah", EXCESS: "Kelebihan Dana", KUASA: "Dana Kuasa", REFUND: "Pengembalian", CANCEL_COST: "Biaya Pembatalan", USED: "Dana Terpakai",
};
export const DOC_CATEGORY_LABEL: Record<string, string> = {
  animal_photo: "Foto hewan", preparation: "Persiapan", slaughter: "Penyembelihan", distribution: "Distribusi",
  beneficiaries: "Penerima manfaat", supporting: "Dokumen pendukung", impact_report: "Laporan dampak",
};
export const STAGES = ["Persiapan Hewan", "Pelaksanaan Kurban", "Distribusi Daging", "Laporan Dampak"] as const;

/** Builds CSV text (RFC 4180, ; safe) from row objects. */
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function download(name: string, content: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Excel-compatible HTML table (.xls) — opens in Excel/Sheets without extra libraries. */
export function toExcelHtml(rows: Record<string, unknown>[], title: string) {
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><table border="1"><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${rows
    .map((r) => `<tr>${cols.map((c) => `<td>${esc(typeof r[c] === "object" && r[c] !== null ? JSON.stringify(r[c]) : r[c])}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
}
