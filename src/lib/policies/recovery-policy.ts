import {
  Customer,
  Subscription,
  RevenueRisk,
  RecoveryWorkflow,
} from "../schemas/database";

export interface PolicyParams {
  recommendedAction: string;
  risk: RevenueRisk;
  workflow: RecoveryWorkflow;
  customer: Pick<Customer, "email" | "name">;
  subscription: Pick<Subscription, "status" | "plan_name">;
}

export interface PolicyCheckResult {
  allowed: boolean;
  approvedAction: "send_payment_recovery_email" | "no_action";
  reason: string;
}

/**
 * Deterministically validates an LLM-recommended action against safety rules and guardrails.
 */
export function validateRecoveryAction(params: PolicyParams): PolicyCheckResult {
  const { recommendedAction, risk, customer, subscription } = params;

  // Rule 1: Reject unknown actions
  if (recommendedAction !== "send_payment_recovery_email" && recommendedAction !== "no_action") {
    return {
      allowed: false,
      approvedAction: "no_action",
      reason: `Rejected: Recommended action type "${recommendedAction}" is not a recognized intervention.`,
    };
  }

  // Rule 2: Cancelled subscriptions are locked out of all interventions
  if (subscription.status === "cancelled") {
    return {
      allowed: false,
      approvedAction: "no_action",
      reason: "Rejected: Customer subscription is cancelled. No billing recovery interventions are permitted.",
    };
  }

  // Rule 3: Low-risk failures do not receive direct interventions (let default retries run)
  if (risk.risk_level === "low") {
    return {
      allowed: false,
      approvedAction: "no_action",
      reason: "Rejected: Customer risk level is classified as LOW. Automated dunning emails are bypassed.",
    };
  }

  // Rule 4: Action requires customer email to send recovery mail
  if (recommendedAction === "send_payment_recovery_email" && (!customer.email || !customer.email.trim())) {
    return {
      allowed: false,
      approvedAction: "no_action",
      reason: "Rejected: Customer email address is missing. Cannot send recovery email.",
    };
  }

  // Rule 5: If LLM explicitly chose no_action, approve it
  if (recommendedAction === "no_action") {
    return {
      allowed: true,
      approvedAction: "no_action",
      reason: "Approved: System agreed with the AI recommendation to perform no action.",
    };
  }

  // If all guardrails pass, allow the intervention
  return {
    allowed: true,
    approvedAction: "send_payment_recovery_email",
    reason: `Approved: Recovery email authorized for ${customer.name} (${risk.risk_level} risk).`,
  };
}
