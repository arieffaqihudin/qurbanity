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
