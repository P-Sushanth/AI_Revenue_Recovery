import { describe, it, expect, beforeAll } from "vitest";
import { executeRecoveryAction } from "@/lib/recovery/action-executor";
import { processPaymentEvent } from "@/lib/recovery/process-payment-event";
import { seedDemoData } from "@/lib/demo/demo-data";
import { getDbClient } from "@/lib/db/client";

describe("Action Executor Integration Tests", () => {
  const db = getDbClient(true);
  let testWorkflowId: string;
  let testRiskId: string;

  beforeAll(async () => {
    // 1. Seed database
    await seedDemoData();

    // 2. Trigger failed payment to get a workflow
    const triggerResult = await processPaymentEvent({
      provider: "stripe",
      external_event_id: `evt_test_executor_${Date.now()}`,
      customer_external_id: "cus_alex_123",
      subscription_external_id: "sub_alex_111",
      amount: 2499.00,
      currency: "INR",
      status: "failed" as const,
      failure_code: "expired_card" as const,
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
    });

    testWorkflowId = triggerResult.workflowId!;
    testRiskId = triggerResult.riskId!;

    // 3. Mock AI Agent phase by writing the recommendation to the workflow
    // This allows us to test the Policy + Executor layers in isolation
    await db
      .from("recovery_workflows")
      .update({
        status: "awaiting_approval",
        recommended_action: "send_payment_recovery_email",
        updated_at: new Date().toISOString(),
      })
      .eq("id", testWorkflowId);

    // Seed mock LLM intent into audit logs so the executor can fetch it
    await db.from("audit_logs").insert({
      workflow_id: testWorkflowId,
      event_type: "ai_analysis_completed",
      actor: "llm",
      output: {
        recommended_action: "send_payment_recovery_email",
        customer_message_intent: "Ask customer to update expired card.",
      },
    });
  });

  it("should validate policies, execute email dispatch, complete workflow, and track states", async () => {
    // Run execution
    const result = await executeRecoveryAction(testWorkflowId);

    expect(result.success).toBe(true);
    expect(result.policyApproved).toBe(true);
    expect(result.actionId).toBeDefined();
    expect(result.providerMessageId).toContain("sim_msg_");

    // Verify workflow completed
    const { data: workflow } = await db
      .from("recovery_workflows")
      .select("*")
      .eq("id", testWorkflowId)
      .single();

    expect(workflow).toBeDefined();
    expect(workflow!.status).toBe("completed");
    expect(workflow!.action_status).toBe("approved");
    expect(workflow!.approved_action).toBe("send_payment_recovery_email");

    // Verify risk status moved to 'in_recovery'
    const { data: risk } = await db
      .from("revenue_risks")
      .select("status")
      .eq("id", testRiskId)
      .single();

    expect(risk).toBeDefined();
    expect(risk!.status).toBe("in_recovery");

    // Verify recovery action database record
    const { data: action } = await db
      .from("recovery_actions")
      .select("*")
      .eq("id", result.actionId)
      .single();

    expect(action).toBeDefined();
    expect(action!.status).toBe("succeeded");
    expect(action!.payload.email_html).toContain("Action Required: Payment Update");

    // Verify audit logs generated (policy check + executed + workflow completed)
    const { data: logs } = await db
      .from("audit_logs")
      .select("event_type")
      .eq("workflow_id", testWorkflowId);

    const logTypes = logs!.map((l) => l.event_type);
    expect(logTypes).toContain("policy_check_completed");
    expect(logTypes).toContain("action_executed");
    expect(logTypes).toContain("workflow_completed");
  });

  it("should prevent duplicate executions on the same completed workflow via idempotency controls", async () => {
    // Run execution a second time
    const result = await executeRecoveryAction(testWorkflowId);

    expect(result.success).toBe(true);
    expect(result.policyApproved).toBe(true);
    expect(result.reason).toMatch(/terminal state|Idempotency/);

    // Verify that we did NOT insert a duplicate action in the database
    const { data: actions } = await db
      .from("recovery_actions")
      .select("id")
      .eq("workflow_id", testWorkflowId);

    expect(actions!.length).toBe(1); // Still only 1 execution record
  });
});
