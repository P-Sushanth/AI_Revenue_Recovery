import { describe, it, expect } from "vitest";
import { parseStripeWebhook, STRIPE_EVENT_MAP } from "@/lib/payments/stripe/parser";

describe("Stripe Webhook Event Parser Utility", () => {
  it("should return null for unsupported Stripe event types", () => {
    const payload = {
      id: "evt_123",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123" } }
    };
    const result = parseStripeWebhook(payload);
    expect(result).toBeNull();
  });

  it("should successfully parse and normalize invoice.payment_failed event", () => {
    const payload = {
      id: "evt_fail_1",
      type: STRIPE_EVENT_MAP.INVOICE_PAYMENT_FAILED,
      created: 1787900337,
      data: {
        object: {
          id: "in_invoice_fail_123",
          customer: "cus_stripe_alex_123",
          subscription: "sub_stripe_alex_111",
          amount_due: 249900, // $2499.00 in cents
          currency: "usd",
          attempt_count: 2,
          last_payment_error: {
            code: "expired_card",
            decline_code: "expired_card",
            message: "The card has expired."
          }
        }
      }
    };

    const normalized = parseStripeWebhook(payload);
    expect(normalized).not.toBeNull();
    expect(normalized!.provider).toBe("stripe");
    expect(normalized!.external_event_id).toBe("in_invoice_fail_123");
    expect(normalized!.customer_external_id).toBe("cus_stripe_alex_123");
    expect(normalized!.subscription_external_id).toBe("sub_stripe_alex_111");
    expect(normalized!.amount).toBe(2499.00);
    expect(normalized!.currency).toBe("USD");
    expect(normalized!.status).toBe("failed");
    expect(normalized!.failure_code).toBe("expired_card");
    expect(normalized!.failure_message).toBe("The card has expired.");
    expect(normalized!.attempt_number).toBe(2);
    expect(normalized!.occurred_at).toBe(new Date(1787900337 * 1000).toISOString());
    expect(normalized!.raw_payload).toEqual(payload);
  });

  it("should successfully parse and normalize invoice.payment_succeeded event", () => {
    const payload = {
      id: "evt_success_1",
      type: STRIPE_EVENT_MAP.INVOICE_PAYMENT_SUCCEEDED,
      created: 1787900350,
      data: {
        object: {
          id: "in_invoice_success_123",
          customer: "cus_stripe_sarah_456",
          subscription: "sub_stripe_sarah_222",
          amount_paid: 799900, // $7999.00 in cents
          currency: "usd",
          attempt_count: 1
        }
      }
    };

    const normalized = parseStripeWebhook(payload);
    expect(normalized).not.toBeNull();
    expect(normalized!.provider).toBe("stripe");
    expect(normalized!.external_event_id).toBe("in_invoice_success_123");
    expect(normalized!.customer_external_id).toBe("cus_stripe_sarah_456");
    expect(normalized!.subscription_external_id).toBe("sub_stripe_sarah_222");
    expect(normalized!.amount).toBe(7999.00);
    expect(normalized!.currency).toBe("USD");
    expect(normalized!.status).toBe("succeeded");
    expect(normalized!.failure_code).toBeNull();
    expect(normalized!.failure_message).toBeNull();
    expect(normalized!.attempt_number).toBe(1);
    expect(normalized!.occurred_at).toBe(new Date(1787900350 * 1000).toISOString());
    expect(normalized!.raw_payload).toEqual(payload);
  });

  it("should correctly classify generic decline error codes", () => {
    const payload = {
      id: "evt_fail_generic",
      type: STRIPE_EVENT_MAP.INVOICE_PAYMENT_FAILED,
      data: {
        object: {
          id: "in_generic_123",
          customer: "cus_generic",
          amount_due: 1000,
          currency: "usd",
          last_payment_error: {
            code: "card_declined",
            decline_code: "generic_decline",
            message: "The card was declined."
          }
        }
      }
    };

    const normalized = parseStripeWebhook(payload);
    expect(normalized!.failure_code).toBe("card_declined");
  });

  it("should throw an error on payloads missing invoice attributes", () => {
    const invalidPayload1 = {
      type: STRIPE_EVENT_MAP.INVOICE_PAYMENT_FAILED,
      data: {} // missing object
    };
    const invalidPayload2 = {
      type: STRIPE_EVENT_MAP.INVOICE_PAYMENT_FAILED,
      data: { object: { customer: "cus_123" } } // missing invoice ID
    };

    expect(() => parseStripeWebhook(invalidPayload1)).toThrow();
    expect(() => parseStripeWebhook(invalidPayload2)).toThrow();
  });
});
