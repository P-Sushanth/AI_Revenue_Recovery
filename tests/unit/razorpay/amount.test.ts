import { describe, it, expect } from "vitest";
import { paiseToRupees, rupeesToPaise } from "@/lib/payments/razorpay/amount";

describe("Razorpay Amount Converter Unit Tests", () => {
  it("should convert paise to rupees correctly", () => {
    expect(paiseToRupees(249900)).toBe(2499.00);
    expect(paiseToRupees(0)).toBe(0);
    expect(paiseToRupees(150)).toBe(1.50);
  });

  it("should convert rupees to paise correctly", () => {
    expect(rupeesToPaise(2499.00)).toBe(249900);
    expect(rupeesToPaise(0)).toBe(0);
    expect(rupeesToPaise(1.50)).toBe(150);
    expect(rupeesToPaise(9.99)).toBe(999);
  });

  it("should throw error if input paise amount is negative", () => {
    expect(() => paiseToRupees(-1)).toThrow();
  });

  it("should throw error if input rupees amount is negative", () => {
    expect(() => rupeesToPaise(-1)).toThrow();
  });
});
