import { Customer, Subscription, PaymentEvent } from "../schemas/database";
import {
  RISK_LEVELS,
  RISK_THRESHOLDS,
  RISK_WEIGHTS,
  RECOVERABILITY_WEIGHTS,
} from "./constants";

export interface CustomerContext {
  customer: Customer;
  historicalPayments: PaymentEvent[];
}

export interface SubscriptionContext {
  subscription: Subscription;
}

export interface RiskAnalysisResult {
  riskScore: number;
  riskLevel: typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
  amountAtRisk: number;
  recoverabilityScore: number;
  reasons: string[];
}

/**
 * Classifies a numerical risk score into a risk level string.
 */
export function classifyRiskLevel(score: number): typeof RISK_LEVELS[keyof typeof RISK_LEVELS] {
  if (score <= RISK_THRESHOLDS.LOW_MAX) {
    return RISK_LEVELS.LOW;
  }
  if (score <= RISK_THRESHOLDS.MEDIUM_MAX) {
    return RISK_LEVELS.MEDIUM;
  }
  if (score <= RISK_THRESHOLDS.HIGH_MAX) {
    return RISK_LEVELS.HIGH;
  }
  return RISK_LEVELS.CRITICAL;
}

/**
 * Deterministic revenue risk score calculation.
 */
export function calculateRiskScore(
  paymentEvent: PaymentEvent,
  customerContext: CustomerContext,
  subscriptionContext: SubscriptionContext,
  reasons: string[] = []
): number {
  let score = 0;
  const { historicalPayments } = customerContext;
  const { subscription } = subscriptionContext;

  // 1. Payment failed
  if (paymentEvent.status === "failed") {
    score += RISK_WEIGHTS.BASE_PAYMENT_FAILURE;
    reasons.push("Payment transaction failed.");
  }

  // 2. Retry attempts (attempts > 1 means additional attempts)
  if (paymentEvent.attempt_number > 1) {
    const additionalAttempts = paymentEvent.attempt_number - 1;
    score += additionalAttempts * RISK_WEIGHTS.RETRY_ATTEMPT_MULTIPLIER;
    reasons.push(`Repeated retry attempt #${paymentEvent.attempt_number}.`);
  }

  // 3. Subscription status
  if (subscription.status === "active") {
    score += RISK_WEIGHTS.ACTIVE_SUBSCRIPTION;
    reasons.push("Subscription is active (active revenue stream is blocked).");
  }

  // 4. Customer successful historical payments
  const hasSuccessfulHistory = historicalPayments.some((p) => p.status === "succeeded");
  if (hasSuccessfulHistory) {
    score -= RISK_WEIGHTS.SUCCESSFUL_HISTORY_BONUS;
    reasons.push("Customer has a history of successful payments.");
  }

  // 5/6. Failure code classification
  const failureCode = paymentEvent.failure_code;
  if (failureCode === "insufficient_funds" || failureCode === "processing_error") {
    score += RISK_WEIGHTS.TEMPORARY_FAILURE_SURCHARGE;
    reasons.push(`Failure reason (${failureCode}) is likely temporary.`);
  } else if (
    failureCode === "expired_card" ||
    failureCode === "authentication_required" ||
    failureCode === "payment_method_invalid"
  ) {
    score += RISK_WEIGHTS.ACTION_REQUIRED_FAILURE_SURCHARGE;
    reasons.push(`Failure reason (${failureCode}) requires customer action to update payment details.`);
  }

  // 7. Repeated failures in recent history
  // Excluding the current trigger event to look at historical context
  const historicalFailures = historicalPayments.filter(
    (p) => p.status === "failed" && p.id !== paymentEvent.id
  );
  if (historicalFailures.length > 0) {
    score += RISK_WEIGHTS.REPEATED_RECENT_FAILURES;
    reasons.push("Customer has other recent payment failures.");
  }

  // Cap at 100
  return Math.min(100, Math.max(0, score));
}

/**
 * Deterministic recoverability score calculation.
 */
export function calculateRecoverabilityScore(
  paymentEvent: PaymentEvent,
  customerContext: CustomerContext,
  subscriptionContext: SubscriptionContext
): number {
  let score = RECOVERABILITY_WEIGHTS.BASE;
  const { historicalPayments } = customerContext;
  const { subscription } = subscriptionContext;

  // 1. Successful historical payments
  const hasSuccessfulHistory = historicalPayments.some((p) => p.status === "succeeded");
  if (hasSuccessfulHistory) {
    score += RECOVERABILITY_WEIGHTS.SUCCESSFUL_HISTORY_BONUS;
  }

  // 2. Active subscription
  if (subscription.status === "active") {
    score += RECOVERABILITY_WEIGHTS.ACTIVE_SUBSCRIPTION_BONUS;
  }

  // 3. Temporary failure code
  const failureCode = paymentEvent.failure_code;
  if (failureCode === "insufficient_funds" || failureCode === "processing_error") {
    score += RECOVERABILITY_WEIGHTS.TEMPORARY_FAILURE_BONUS;
  }

  // 4. Repeated failures (count total failed events including this one)
  const totalFailures = historicalPayments.filter((p) => p.status === "failed").length;
  // If we have at least 3 failed attempts, deduct points
  if (totalFailures >= 3) {
    score += RECOVERABILITY_WEIGHTS.REPEATED_FAILURES_PENALTY;
  }

  // 5. Cancelled subscription
  if (subscription.status === "cancelled") {
    score += RECOVERABILITY_WEIGHTS.CANCELLED_SUBSCRIPTION_PENALTY;
  }

  // Clamp 0-100
  return Math.min(100, Math.max(0, score));
}

/**
 * Analyzes payment event risk and returns deterministic metrics.
 */
export function analyzePaymentRisk(
  paymentEvent: PaymentEvent,
  customerContext: CustomerContext,
  subscriptionContext: SubscriptionContext
): RiskAnalysisResult {
  const reasons: string[] = [];

  const riskScore = calculateRiskScore(paymentEvent, customerContext, subscriptionContext, reasons);
  const riskLevel = classifyRiskLevel(riskScore);
  const recoverabilityScore = calculateRecoverabilityScore(paymentEvent, customerContext, subscriptionContext);

  // MVP: amount_at_risk is the amount of the failed payment
  const amountAtRisk = paymentEvent.amount;

  return {
    riskScore,
    riskLevel,
    amountAtRisk,
    recoverabilityScore,
    reasons,
  };
}
