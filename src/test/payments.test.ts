import { describe, expect, it } from "vitest";
import { displayStatus, parsePresets, reservedAmount } from "@/lib/payments";

describe("payment helpers", () => {
  it("only accepts positive safe integer payment presets", () => {
    expect(parsePresets("100000, 0, -1, 2500.5, invalid, 200000")).toEqual([100000, 200000]);
  });

  it("presents pending payments past their expiry as expired", () => {
    expect(
      displayStatus({
        status: "pending",
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).toBe("expired");
  });

  it("reserves only unexpired pending payment amounts", () => {
    expect(
      reservedAmount([
        {
          status: "pending",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          amount: 50_000,
        },
        {
          status: "pending",
          expires_at: new Date(Date.now() - 60_000).toISOString(),
          amount: 75_000,
        },
        {
          status: "success",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          amount: 25_000,
        },
      ]),
    ).toBe(50_000);
  });
});
