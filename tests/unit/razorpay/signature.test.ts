import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay/signature";

describe("Razorpay Signature Verification Unit Tests", () => {
  const secret = "test_webhook_secret_key_987654";
  const rawBody = JSON.stringify({ event: "payment.failed", id: "evt_123" });

  const calculateSignature = (body: string, key: string) => {
    return crypto
      .createHmac("sha256", key)
      .update(body)
      .digest("hex");
  };

  it("should return true for a valid signature", () => {
    const signature = calculateSignature(rawBody, secret);
    const result = verifyRazorpayWebhookSignature(rawBody, signature, secret);
    expect(result).toBe(true);
  });

  it("should return false for an invalid signature", () => {
    const result = verifyRazorpayWebhookSignature(rawBody, "invalid_sig_here", secret);
    expect(result).toBe(false);
  });

  it("should return false if signature is calculated with a different secret", () => {
    const wrongSignature = calculateSignature(rawBody, "different_secret_key");
    const result = verifyRazorpayWebhookSignature(rawBody, wrongSignature, secret);
    expect(result).toBe(false);
  });

  it("should return false if rawBody, signature, or secret is empty", () => {
    expect(verifyRazorpayWebhookSignature("", "sig", secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(rawBody, "", secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(rawBody, "sig", "")).toBe(false);
  });
});
