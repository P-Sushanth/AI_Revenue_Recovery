import { NormalizedPaymentEvent } from "../types";
import { paiseToRupees } from "./amount";

/**
 * Razorpay webhook event mapping constants.
 */
export const RAZORPAY_EVENT_MAP = {
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_CAPTURED: "payment.captured",
  ORDER_PAID: "order.paid",
} as const;

/**
 * Validates and parses Razorpay webhook payloads into normalized payment event objects.
 * Throws controlled errors if payload structures are invalid for supported events.
 * 
 * @param payload Raw parsed JSON webhook payload object from Razorpay.
 * @returns NormalizedPaymentEvent if event is supported, or null if event is unsupported.
 */
export function parseRazorpayWebhook(payload: any): NormalizedPaymentEvent | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const eventType = payload.event;
  
  // Safe filtering: Return null if this event is not relevant to recovery workflows
  if (
    eventType !== RAZORPAY_EVENT_MAP.PAYMENT_FAILED &&
    eventType !== RAZORPAY_EVENT_MAP.PAYMENT_CAPTURED &&
    eventType !== RAZORPAY_EVENT_MAP.ORDER_PAID
  ) {
    return null;
  }

  const paymentEntity = payload.payload?.payment?.entity;
  if (!paymentEntity || typeof paymentEntity !== "object") {
    throw new Error("Invalid Razorpay payload: missing payment entity");
  }

  const paymentId = paymentEntity.id;
  if (!paymentId) {
    throw new Error("Invalid Razorpay payload: missing payment ID");
  }

  const amountInPaise = paymentEntity.amount;
  if (amountInPaise === undefined || amountInPaise === null) {
    throw new Error("Invalid Razorpay payload: missing payment amount");
  }

  const customerExternalId = paymentEntity.customer_id || paymentEntity.email || "unknown_customer";
  
  // Pull subscription external identifier from metadata notes or fallback
  const subscriptionExternalId = 
    paymentEntity.notes?.subscription_id || 
    paymentEntity.notes?.subscription_external_id || 
    paymentEntity.invoice_id || 
    `sub_fallback_${customerExternalId}`;

  const normalizedStatus = eventType === RAZORPAY_EVENT_MAP.PAYMENT_FAILED ? "failed" : "succeeded";

  let failureCode:
    | "unknown"
    | "insufficient_funds"
    | "expired_card"
    | "card_declined"
    | "authentication_required"
    | "payment_method_invalid"
    | "processing_error"
    | null = null;
  let failureMessage = null;

  if (normalizedStatus === "failed") {
    const razorpayReason = paymentEntity.error_reason || paymentEntity.error_code || "unknown";
    failureMessage = paymentEntity.error_description || "Payment failed on Razorpay";

    // Map Razorpay gateway failure reasons to standardized internal codes
    if (razorpayReason.includes("expired")) {
      failureCode = "expired_card";
    } else if (razorpayReason.includes("insufficient") || razorpayReason.includes("balance")) {
      failureCode = "insufficient_funds";
    } else if (razorpayReason.includes("pin") || razorpayReason.includes("password")) {
      failureCode = "card_declined";
    } else if (razorpayReason.includes("auth") || razorpayReason.includes("otp")) {
      failureCode = "authentication_required";
    } else {
      failureCode = "card_declined";
    }
  }

  return {
    provider: "razorpay",
    external_event_id: paymentId,
    customer_external_id: customerExternalId,
    subscription_external_id: subscriptionExternalId,
    amount: paiseToRupees(amountInPaise),
    currency: paymentEntity.currency || "INR",
    status: normalizedStatus,
    failure_code: failureCode,
    failure_message: failureMessage,
    attempt_number: 1,
    occurred_at: new Date((payload.created_at || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    raw_payload: payload,
  };
}
