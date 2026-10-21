import { describe, expect, it } from "vitest";
import { ageOn, normalizeWhatsapp, passwordSchema, registerSchema } from "@/lib/validation";

describe("WhatsApp normalisation", () => {
  it("08xx becomes +628xx", () => expect(normalizeWhatsapp("0812-3456-7890")).toBe("+6281234567890"));
  it("62xx and +62xx are accepted", () => {
    expect(normalizeWhatsapp("6281234567890")).toBe("+6281234567890");
    expect(normalizeWhatsapp("+62 812 3456 7890")).toBe("+6281234567890");
  });
  it("non-mobile numbers are rejected", () => expect(normalizeWhatsapp("021123")).toBeNull());
});

describe("minimum age 17", () => {
  const today = new Date("2026-10-21T05:00:00Z");
  it("turns 17 today → allowed", () => expect(ageOn("2009-10-21", today)).toBe(17));
  it("turns 17 tomorrow → 16", () => expect(ageOn("2009-10-22", today)).toBe(16));
});

describe("password rule", () => {
  it("needs 10+ chars with letters and digits", () => {
    expect(passwordSchema.safeParse("abcdefghij").success).toBe(false);
    expect(passwordSchema.safeParse("123456789012").success).toBe(false);
    expect(passwordSchema.safeParse("abc12345").success).toBe(false);
    expect(passwordSchema.safeParse("kurban2027ok").success).toBe(true);
  });
});

describe("registration", () => {
  const base = { full_name: "Ahmad Fauzi", email: "a@b.co", whatsapp: "081234567890", birth_date: "1990-01-01", address: "Jl. Merapi No. 10, Magelang", password: "kurban2027ok", confirm: "kurban2027ok", terms: true };
  it("valid data passes", () => expect(registerSchema.safeParse(base).success).toBe(true));
  it("terms must be accepted", () => expect(registerSchema.safeParse({ ...base, terms: false }).success).toBe(false));
  it("passwords must match", () => expect(registerSchema.safeParse({ ...base, confirm: "kurban2027no" }).success).toBe(false));
});
