import { describe, it, expect } from "vitest";
import { parseRazorpayWebhook, RAZORPAY_EVENT_MAP } from "@/lib/payments/razorpay/parser";

describe("Razorpay Event Parser Unit Tests", () => {
  it("should return null for unsupported webhook event types", () => {
    const unsupportedPayload = {
      event: "subscription.activated",
      created_at: 1694143430,
    };
    const result = parseRazorpayWebhook(unsupportedPayload);
    expect(result).toBeNull();
  });

  it("should successfully parse payment.failed webhook event", () => {
    const payload = {
      event: RAZORPAY_EVENT_MAP.PAYMENT_FAILED,
      created_at: 1694143430,
      payload: {
        payment: {
          entity: {
            id: "pay_failed_abc",
            amount: 49900,
            currency: "INR",
            status: "failed",
            customer_id: "cust_sarah_456",
            error_reason: "insufficient_balance",
            error_description: "Insufficient funds in bank account.",
            notes: {
              subscription_id: "sub_sarah_222",
            },
          },
        },
      },
    };

    const result = parseRazorpayWebhook(payload);
    expect(result).not.toBeNull();
    expect(result!.provider).toBe("razorpay");
    expect(result!.external_event_id).toBe("pay_failed_abc");
    expect(result!.customer_external_id).toBe("cust_sarah_456");
    expect(result!.subscription_external_id).toBe("sub_sarah_222");
    expect(result!.amount).toBe(499.00);
    expect(result!.currency).toBe("INR");
    expect(result!.status).toBe("failed");
    expect(result!.failure_code).toBe("insufficient_funds");
    expect(result!.failure_message).toBe("Insufficient funds in bank account.");
  });

  it("should successfully parse payment.captured webhook event", () => {
    const payload = {
      event: RAZORPAY_EVENT_MAP.PAYMENT_CAPTURED,
      created_at: 1694143430,
      payload: {
        payment: {
          entity: {
            id: "pay_captured_xyz",
            amount: 799900,
            currency: "INR",
            status: "captured",
            email: "sarah@example.com",
            notes: {
              subscription_id: "sub_sarah_222",
            },
          },
        },
      },
    };

    const result = parseRazorpayWebhook(payload);
    expect(result).not.toBeNull();
    expect(result!.provider).toBe("razorpay");
    expect(result!.external_event_id).toBe("pay_captured_xyz");
    expect(result!.customer_external_id).toBe("sarah@example.com"); // fallbacks to email if customer_id missing
    expect(result!.subscription_external_id).toBe("sub_sarah_222");
    expect(result!.amount).toBe(7999.00);
    expect(result!.status).toBe("succeeded");
    expect(result!.failure_code).toBeNull();
  });

  it("should throw error if payment entity is missing in supported events", () => {
    const invalidPayload = {
      event: RAZORPAY_EVENT_MAP.PAYMENT_FAILED,
      created_at: 1694143430,
      payload: {},
    };
    expect(() => parseRazorpayWebhook(invalidPayload)).toThrow("Invalid Razorpay payload: missing payment entity");
  });
});
