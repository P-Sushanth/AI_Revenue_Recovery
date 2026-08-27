import { describe, it, expect, beforeAll } from "vitest";
import { processPaymentEvent } from "@/lib/recovery/process-payment-event";
import { seedDemoData } from "@/lib/demo/demo-data";
import { getDbClient } from "@/lib/db/client";

describe("Workflow Engine Integration Tests", () => {
  const db = getDbClient(true);

  beforeAll(async () => {
    // Seed the database to ensure we have clean customer and subscription records
    await seedDemoData();
  });

  it("should process a failed payment event, creating risk and workflow records", async () => {
    const rawPayload = {
      provider: "stripe",
      external_event_id: `evt_test_failure_${Date.now()}`,
      customer_external_id: "cus_alex_123",
      subscription_external_id: "sub_alex_111",
      amount: 2499.00,
      currency: "INR",
      status: "failed" as const,
      failure_code: "expired_card" as const,
      failure_message: "Card expired",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { test: true },
    };

    const result = await processPaymentEvent(rawPayload);

    expect(result.isDuplicate).toBe(false);
    expect(result.paymentEvent.id).toBeDefined();
    expect(result.riskId).toBeDefined();
    expect(result.workflowId).toBeDefined();

    // Verify in DB that risk is created with status open
    const { data: risk } = await db
      .from("revenue_risks")
      .select("*")
      .eq("id", result.riskId)
      .single();

    expect(risk).toBeDefined();
    expect(risk.status).toBe("open");
    expect(risk.risk_score).toBe(75); // Alex expired card -> 75

    // Verify in DB that workflow is created in pending status
    const { data: workflow } = await db
      .from("recovery_workflows")
      .select("*")
      .eq("id", result.workflowId)
      .single();

    expect(workflow).toBeDefined();
    expect(workflow.status).toBe("pending");

    // Verify audit log exists
    const { data: logs } = await db
      .from("audit_logs")
      .select("*")
      .eq("workflow_id", result.workflowId);

    expect(logs).toBeDefined();
    expect(logs!.length).toBeGreaterThan(0);
    expect(logs![0].event_type).toBe("risk_detected");
  });

  it("should enforce event idempotency and return existing event without duplicate workflows", async () => {
    const externalEventId = `evt_test_idempotency_${Date.now()}`;
    const rawPayload = {
      provider: "stripe",
      external_event_id: externalEventId,
      customer_external_id: "cus_alex_123",
      subscription_external_id: "sub_alex_111",
      amount: 2499.00,
      currency: "INR",
      status: "failed" as const,
      failure_code: "expired_card" as const,
      failure_message: "Card expired",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
    };

    // Run first time
    const result1 = await processPaymentEvent(rawPayload);
    expect(result1.isDuplicate).toBe(false);
    expect(result1.workflowId).toBeDefined();

    // Run second time
    const result2 = await processPaymentEvent(rawPayload);
    expect(result2.isDuplicate).toBe(true);
    expect(result2.paymentEvent.id).toBe(result1.paymentEvent.id);
    expect(result2.workflowId).toBeUndefined(); // No new workflow created
  });

  it("should resolve active workflows when a succeeded payment event occurs", async () => {
    const failureEventId = `evt_test_success_fail_${Date.now()}`;
    const successEventId = `evt_test_success_ok_${Date.now()}`;

    // 1. Trigger payment failure
    const failResult = await processPaymentEvent({
      provider: "stripe",
      external_event_id: failureEventId,
      customer_external_id: "cus_sarah_456",
      subscription_external_id: "sub_sarah_222",
      amount: 7999.00,
      currency: "INR",
      status: "failed" as const,
      failure_code: "insufficient_funds" as const,
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
    });

    expect(failResult.workflowId).toBeDefined();

    // 2. Trigger subsequent successful payment
    const successResult = await processPaymentEvent({
      provider: "stripe",
      external_event_id: successEventId,
      customer_external_id: "cus_sarah_456",
      subscription_external_id: "sub_sarah_222",
      amount: 7999.00,
      currency: "INR",
      status: "succeeded" as const,
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
    });

    expect(successResult.resolvedWorkflowId).toBe(failResult.workflowId);

    // Verify in DB that risk is recovered and workflow is completed
    const { data: risk } = await db
      .from("revenue_risks")
      .select("status")
      .eq("id", failResult.riskId)
      .single();

    expect(risk).toBeDefined();
    expect(risk!.status).toBe("recovered");

    const { data: workflow } = await db
      .from("recovery_workflows")
      .select("status, completed_at")
      .eq("id", failResult.workflowId)
      .single();

    expect(workflow).toBeDefined();
    expect(workflow!.status).toBe("completed");
    expect(workflow!.completed_at).toBeDefined();

    // Verify audit logs for resolution
    const { data: logs } = await db
      .from("audit_logs")
      .select("event_type")
      .eq("workflow_id", failResult.workflowId);

    expect(logs).toBeDefined();
    const logTypes = logs!.map((l) => l.event_type);
    expect(logTypes).toContain("workflow_completed");
  });
});
