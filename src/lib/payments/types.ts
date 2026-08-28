import { RawPaymentEvent } from "@/lib/recovery/process-payment-event";

/**
 * Normalized payment event format mapped from provider-specific webhook payloads.
 * Decouples the core recovery workflows and risk engines from payment gateway models.
 */
export type NormalizedPaymentEvent = RawPaymentEvent;
