import { describe, it, expect } from "vitest";
import { centsToMajor, majorToCents } from "@/lib/payments/stripe/amount";

describe("Stripe Currency minor-unit converter utilities", () => {
  describe("centsToMajor", () => {
    it("should successfully convert minor unit (cents/paise) to major unit currency (Rupees/Dollars)", () => {
      expect(centsToMajor(249900)).toBe(2499.00);
      expect(centsToMajor(100)).toBe(1.00);
      expect(centsToMajor(0)).toBe(0.00);
      expect(centsToMajor(99)).toBe(0.99);
    });

    it("should throw an error if negative cent value is passed", () => {
      expect(() => centsToMajor(-100)).toThrow("Stripe amount cannot be negative");
    });
  });

  describe("majorToCents", () => {
    it("should successfully convert base currency units back to minor currency units", () => {
      expect(majorToCents(2499.00)).toBe(249900);
      expect(majorToCents(1.00)).toBe(100);
      expect(majorToCents(0.00)).toBe(0);
      expect(majorToCents(0.99)).toBe(99);
    });

    it("should throw an error if negative currency amount is passed", () => {
      expect(() => majorToCents(-24.50)).toThrow("Base currency amount cannot be negative");
    });

    it("should handle rounding issues safely", () => {
      expect(majorToCents(10.234)).toBe(1023); // rounds down
      expect(majorToCents(10.236)).toBe(1024); // rounds up
    });
  });
});
