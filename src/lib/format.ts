export const TIMEZONE = "Asia/Jakarta";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number) {
  return idr.format(value).replace(/\u00a0/g, " ");
}

export function formatDate(d: Date, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: TIMEZONE, ...opts }).format(d);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

/** Waktu relatif Bahasa Indonesia, mis. "5 menit lalu". */
export function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  return formatDate(new Date(iso), { dateStyle: "medium" });
}
