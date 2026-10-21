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
