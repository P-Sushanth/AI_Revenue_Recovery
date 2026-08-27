import { describe, it, expect } from "vitest";
import { validateRecoveryAction } from "@/lib/policies/recovery-policy";
import { Customer, Subscription, RevenueRisk, RecoveryWorkflow } from "@/lib/schemas/database";

describe("Recovery Policy Engine Unit Tests", () => {
  const mockCustomer: Pick<Customer, "email" | "name"> = {
    name: "Alex",
    email: "alex@example.com",
  };

  const mockSubscription: Pick<Subscription, "status" | "plan_name"> = {
    status: "active",
    plan_name: "Pro",
  };

  const mockRisk: RevenueRisk = {
    customer_id: "cus_123",
    subscription_id: "sub_123",
    payment_event_id: "evt_123",
    amount_at_risk: 2499,
    risk_score: 75,
    risk_level: "critical",
    reason: "Payment failed",
    recoverability_score: 85,
    status: "open",
  };

  const mockWorkflow: RecoveryWorkflow = {
    customer_id: "cus_123",
    subscription_id: "sub_123",
    revenue_risk_id: "risk_123",
    trigger_type: "payment_failure",
    status: "pending",
    risk_score: 75,
  };

  it("should approve valid recovery email action for active, high-risk customer with email", () => {
    const result = validateRecoveryAction({
      recommendedAction: "send_payment_recovery_email",
      risk: mockRisk,
      workflow: mockWorkflow,
      customer: mockCustomer,
      subscription: mockSubscription,
    });

    expect(result.allowed).toBe(true);
    expect(result.approvedAction).toBe("send_payment_recovery_email");
    expect(result.reason).toContain("Approved");
  });

  it("should reject action and output no_action if customer subscription is cancelled", () => {
    const result = validateRecoveryAction({
      recommendedAction: "send_payment_recovery_email",
      risk: mockRisk,
      workflow: mockWorkflow,
      customer: mockCustomer,
      subscription: { ...mockSubscription, status: "cancelled" },
    });

    expect(result.allowed).toBe(false);
    expect(result.approvedAction).toBe("no_action");
    expect(result.reason).toContain("cancelled");
  });

  it("should reject action and output no_action if risk level is low", () => {
    const result = validateRecoveryAction({
      recommendedAction: "send_payment_recovery_email",
      risk: { ...mockRisk, risk_level: "low", risk_score: 10 },
      workflow: mockWorkflow,
      customer: mockCustomer,
      subscription: mockSubscription,
    });

    expect(result.allowed).toBe(false);
    expect(result.approvedAction).toBe("no_action");
    expect(result.reason).toContain("LOW");
  });

  it("should reject action and output no_action if customer email is missing", () => {
    const result = validateRecoveryAction({
      recommendedAction: "send_payment_recovery_email",
      risk: mockRisk,
      workflow: mockWorkflow,
      customer: { ...mockCustomer, email: "" },
      subscription: mockSubscription,
    });

    expect(result.allowed).toBe(false);
    expect(result.approvedAction).toBe("no_action");
    expect(result.reason).toContain("missing");
  });

  it("should reject unknown LLM action types", () => {
    const result = validateRecoveryAction({
      recommendedAction: "apply_discount_coupon", // Not supported
      risk: mockRisk,
      workflow: mockWorkflow,
      customer: mockCustomer,
      subscription: mockSubscription,
    });

    expect(result.allowed).toBe(false);
    expect(result.approvedAction).toBe("no_action");
    expect(result.reason).toContain("not a recognized intervention");
  });
});
