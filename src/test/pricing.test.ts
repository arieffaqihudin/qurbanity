import { describe, expect, it } from "vitest";
import { getCategory, pricePerShare, simulate, countPeriods } from "@/lib/pricing";

describe("pricing rules", () => {
  it("sapi is split into 7 shares", () => {
    expect(pricePerShare(getCategory("sapi-reguler"))).toBe(3_000_000);
  });
  it("kambing is one animal for one shahibul", () => {
    const k = getCategory("kambing");
    expect(k.maxShares).toBe(1);
    expect(simulate(k, 5, "bulanan")!.total).toBe(3_500_000);
  });
  it("Sapi Super Duper is unavailable until a final price is set", () => {
    expect(simulate(getCategory("sapi-super-duper"), 1, "harian")).toBeNull();
  });
  it("shares are capped at 7", () => {
    expect(simulate(getCategory("sapi-super"), 9, "bulanan")!.total).toBe(28_000_000);
  });
  it("weekly periods round up", () => {
    const from = new Date("2027-01-01T00:00:00+07:00");
    const to = new Date("2027-01-16T00:00:00+07:00");
    expect(countPeriods("mingguan", from, to)).toBe(3);
  });
});

describe("simulator edge cases", () => {
  it("after the deadline there are no installment periods left", () => {
    const r = simulate(getCategory("sapi-reguler"), 1, "harian", new Date("2027-05-01T00:00:00+07:00"));
    expect(r!.daysLeft).toBe(0);
    expect(r!.periods).toBe(0);
  });
  it("shares below 1 count as 1", () => {
    expect(simulate(getCategory("sapi-reguler"), 0, "bulanan")!.total).toBe(3_000_000);
  });
});

describe("PRD share formula (matches database share_component)", () => {
  it("each component is ceiling(cost × shares / 7)", async () => {
    const { quote } = await import("@/lib/pricing");
    // 19.600.000 × 3 / 7 = 8.400.000 exact; 1.400.000 × 3 / 7 = 600.000 exact
    expect(quote(19_600_000, 1_400_000, 3, 7)).toEqual({ animal: 8_400_000, operational: 600_000, total: 9_000_000, rounding: 0 });
    // 20.000.000 × 1 / 7 = 2.857.142,86 → 2.857.143 ; 1.500.000 / 7 = 214.285,71 → 214.286
    expect(quote(20_000_000, 1_500_000, 1, 7)).toEqual({ animal: 2_857_143, operational: 214_286, total: 3_071_429, rounding: 2 });
  });
  it("a full cow (7 shares) costs exactly the full price, no rounding", async () => {
    const { quote } = await import("@/lib/pricing");
    expect(quote(20_000_000, 1_500_000, 7, 7).total).toBe(21_500_000);
  });
});
