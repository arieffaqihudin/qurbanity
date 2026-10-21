/**
 * SAMPLE PRICING (Phase 1). Values are illustrative examples for the public
 * simulator only. Real prices come from the database and are locked per
 * commitment at akad time.
 */
export type CategoryId = "sapi-reguler" | "sapi-super" | "sapi-super-duper" | "kambing";
export type Frequency = "harian" | "mingguan" | "bulanan";

export interface AnimalCategory {
  id: CategoryId;
  name: string;
  kind: "sapi" | "kambing";
  weightRange: string;
  maxShares: number; // 7 for sapi, 1 for kambing
  /** Full animal cost (Rp); null when final price not set */
  animalCost: number | null;
  /** Full operational cost (Rp); null when final price not set */
  operationalCost: number | null;
  description: string;
}

export const CATEGORIES: AnimalCategory[] = [
  {
    id: "sapi-reguler",
    name: "Sapi Reguler",
    kind: "sapi",
    weightRange: "± 250–300 kg",
    maxShares: 7,
    animalCost: 19_600_000,
    operationalCost: 1_400_000,
    description: "Pilihan hemat untuk patungan bersama keluarga atau komunitas.",
  },
  {
    id: "sapi-super",
    name: "Sapi Super",
    kind: "sapi",
    weightRange: "± 350–400 kg",
    maxShares: 7,
    animalCost: 25_900_000,
    operationalCost: 2_100_000,
    description: "Sapi berbobot lebih besar dengan manfaat daging lebih luas.",
  },
  {
    id: "sapi-super-duper",
    name: "Sapi Super Duper",
    kind: "sapi",
    weightRange: "± 500 kg ke atas",
    maxShares: 7,
    animalCost: null,
    operationalCost: null,
    description: "Kategori premium. Harga final belum ditetapkan.",
  },
  {
    id: "kambing",
    name: "Kambing",
    kind: "kambing",
    weightRange: "± 25–30 kg",
    maxShares: 1,
    animalCost: 3_150_000,
    operationalCost: 350_000,
    description: "Satu ekor untuk satu shahibul kurban.",
  },
];

/** Estimated Iduladha 1448 H (sample, awaiting official announcement). */
export const IDULADHA_DATE = new Date("2027-05-16T07:00:00+07:00");
/** Sample payment deadline: 30 days before Iduladha. */
export const PAYMENT_DEADLINE = new Date("2027-04-16T23:59:59+07:00");

export function getCategory(id: CategoryId) {
  return CATEGORIES.find((c) => c.id === id)!;
}

export function isAvailable(c: AnimalCategory) {
  return c.animalCost !== null && c.operationalCost !== null;
}

export function fullPrice(c: AnimalCategory): number | null {
  if (!isAvailable(c)) return null;
  return c.animalCost! + c.operationalCost!;
}

/** Price per share (sapi) or per animal (kambing). */
export function pricePerShare(c: AnimalCategory): number | null {
  const full = fullPrice(c);
  return full === null ? null : Math.round(full / c.maxShares);
}

const DAY = 86_400_000;

export function countPeriods(freq: Frequency, from: Date, to: Date): number {
  const days = Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY));
  if (days === 0) return 0;
  if (freq === "harian") return days;
  if (freq === "mingguan") return Math.max(1, Math.ceil(days / 7));
  return Math.max(1, Math.ceil(days / 30));
}

export interface Simulation {
  total: number;
  periods: number;
  perPeriod: number;
  daysLeft: number;
}

/** Installment estimate rounded up to the nearest Rp 1.000. */
export function simulate(
  c: AnimalCategory,
  shares: number,
  freq: Frequency,
  now: Date = new Date(),
  deadline: Date = PAYMENT_DEADLINE,
): Simulation | null {
  const per = pricePerShare(c);
  if (per === null) return null;
  const s = Math.min(Math.max(1, Math.floor(shares)), c.maxShares);
  const total = per * s;
  const periods = countPeriods(freq, now, deadline);
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY));
  const perPeriod = periods > 0 ? Math.ceil(total / periods / 1000) * 1000 : total;
  return { total, periods, perPeriod, daysLeft };
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  harian: "Harian",
  mingguan: "Mingguan",
  bulanan: "Bulanan",
};
export const FREQUENCY_UNIT: Record<Frequency, string> = {
  harian: "hari",
  mingguan: "minggu",
  bulanan: "bulan",
};
