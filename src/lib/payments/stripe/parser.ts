import { NormalizedPaymentEvent } from "../types";
import { centsToMajor } from "./amount";
import { PaymentFailureCode } from "../../schemas/database";

/**
 * Stripe webhook event constants.
 */
export const STRIPE_EVENT_MAP = {
  INVOICE_PAYMENT_FAILED: "invoice.payment_failed",
  INVOICE_PAYMENT_SUCCEEDED: "invoice.payment_succeeded",
} as const;

/**
 * Maps Stripe specific error codes/decline codes to standardized internal failure codes.
 * 
 * @param stripeCode The error code returned in last_payment_error.code
 * @param declineCode The decline code returned in last_payment_error.decline_code
 * @returns PaymentFailureCode
 */
function mapStripeFailureCode(stripeCode?: string, declineCode?: string): PaymentFailureCode {
  const code = (stripeCode || "").toLowerCase();
  const decline = (declineCode || "").toLowerCase();

  if (code === "expired_card" || code === "card_expired" || decline === "expired_card") {
    return "expired_card";
  }

  if (
    code === "insufficient_funds" || 
    decline === "insufficient_funds"
  ) {
    return "insufficient_funds";
  }

  if (
    code === "authentication_required" || 
    decline === "authentication_required"
  ) {
    return "authentication_required";
  }

  if (
    code === "incorrect_cvc" ||
    code === "incorrect_number" ||
    code === "invalid_number" ||
    code === "invalid_expiry_month" ||
    code === "invalid_expiry_year" ||
    code === "payment_method_unusable" ||
    code === "payment_method_invalid"
  ) {
    return "payment_method_invalid";
  }

  if (code === "processing_error" || decline === "processing_error") {
    return "processing_error";
  }

  return "card_declined";
}

/**
 * Validates and parses Stripe webhook payloads into normalized payment event objects.
 * 
 * @param payload Raw parsed JSON webhook payload object from Stripe.
 * @returns NormalizedPaymentEvent if event is supported, or null if event is unsupported.
 */
export function parseStripeWebhook(payload: any): NormalizedPaymentEvent | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const eventType = payload.type;

  // Filter out irrelevant events
  if (
    eventType !== STRIPE_EVENT_MAP.INVOICE_PAYMENT_FAILED &&
    eventType !== STRIPE_EVENT_MAP.INVOICE_PAYMENT_SUCCEEDED
  ) {
    return null;
  }

  const invoice = payload.data?.object;
  if (!invoice || typeof invoice !== "object") {
    throw new Error("Invalid Stripe payload: missing invoice data object");
  }

  const invoiceId = invoice.id;
  if (!invoiceId) {
    throw new Error("Invalid Stripe payload: missing invoice ID");
  }

  const customerId = invoice.customer;
  if (!customerId) {
    throw new Error("Invalid Stripe payload: missing customer ID");
  }

  const subscriptionId = invoice.subscription || null;

  // Determine amount based on succeeded vs. failed status
  const isFailed = eventType === STRIPE_EVENT_MAP.INVOICE_PAYMENT_FAILED;
  const rawAmount = isFailed ? invoice.amount_due : invoice.amount_paid;

  if (rawAmount === undefined || rawAmount === null) {
    throw new Error(`Invalid Stripe payload: missing amount field (${isFailed ? "amount_due" : "amount_paid"})`);
  }

  const normalizedStatus = isFailed ? "failed" : "succeeded";

  let failureCode: PaymentFailureCode | null = null;
  let failureMessage: string | null = null;

  if (isFailed) {
    const errorObject = invoice.last_payment_error;
    const stripeCode = errorObject?.code;
    const declineCode = errorObject?.decline_code;
    
    failureCode = mapStripeFailureCode(stripeCode, declineCode);
    failureMessage = errorObject?.message || "Invoice payment failed on Stripe";
  }

  const cents = Number(rawAmount);

  return {
    provider: "stripe",
    external_event_id: invoiceId, // Conforming to Stripe Webhook logic where the invoice ID maps to the transaction event sequence
    customer_external_id: customerId,
    subscription_external_id: subscriptionId,
    amount: centsToMajor(cents),
    currency: (invoice.currency || "usd").toUpperCase(),
    status: normalizedStatus,
    failure_code: failureCode,
    failure_message: failureMessage,
    attempt_number: Number(invoice.attempt_count || 1),
    occurred_at: new Date((payload.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    raw_payload: payload,
  };
}
