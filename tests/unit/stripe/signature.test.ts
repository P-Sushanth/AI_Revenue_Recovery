import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyStripeWebhookSignature } from "@/lib/payments/stripe/signature";

describe("Stripe Cryptographic Webhook Signature Verification", () => {
  const testSecret = "whsec_test_signing_key_987654";
  const testRawBody = JSON.stringify({
    id: "evt_test_failed_signature",
    type: "invoice.payment_failed",
    data: { object: { id: "in_invoice_123" } }
  });

  const generateHeader = (rawBody: string, secret: string, timestampOverride?: string) => {
    const timestamp = timestampOverride || Math.floor(Date.now() / 1000).toString();
    const signedPayload = `${timestamp}.${rawBody}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");
    return `t=${timestamp},v1=${signature}`;
  };

  it("should successfully accept a valid recent webhook signature", () => {
    const signatureHeader = generateHeader(testRawBody, testSecret);
    const result = verifyStripeWebhookSignature(testRawBody, signatureHeader, testSecret);
    expect(result).toBe(true);
  });

  it("should reject signatures generated with a different secret", () => {
    const signatureHeader = generateHeader(testRawBody, "wrong_signing_secret");
    const result = verifyStripeWebhookSignature(testRawBody, signatureHeader, testSecret);
    expect(result).toBe(false);
  });

  it("should reject signature headers that are malformed or missing keys", () => {
    const result1 = verifyStripeWebhookSignature(testRawBody, "t=123456", testSecret);
    const result2 = verifyStripeWebhookSignature(testRawBody, "v1=abcde", testSecret);
    const result3 = verifyStripeWebhookSignature(testRawBody, "", testSecret);
    
    expect(result1).toBe(false);
    expect(result2).toBe(false);
    expect(result3).toBe(false);
  });

  it("should reject signature if timestamp difference exceeds tolerance bounds (prevent replay)", () => {
    // Timestamp 10 minutes ago
    const tenMinutesAgo = (Math.floor(Date.now() / 1000) - 600).toString();
    const signatureHeader = generateHeader(testRawBody, testSecret, tenMinutesAgo);
    
    // Test with default tolerance of 5 minutes (300 seconds)
    const result = verifyStripeWebhookSignature(testRawBody, signatureHeader, testSecret);
    expect(result).toBe(false);
  });

  it("should reject signature if timestamp is in the future beyond tolerance bounds", () => {
    // Timestamp 10 minutes in the future
    const tenMinutesFuture = (Math.floor(Date.now() / 1000) + 600).toString();
    const signatureHeader = generateHeader(testRawBody, testSecret, tenMinutesFuture);
    
    const result = verifyStripeWebhookSignature(testRawBody, signatureHeader, testSecret);
    expect(result).toBe(false);
  });
});
