import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "@/app/api/workflows/[id]/recover/route";
import { seedDemoData } from "@/lib/demo/demo-data";
import { getDbClient } from "@/lib/db/client";

describe("Workflow Recovery API Route Integration Tests", () => {
  const db = getDbClient(true); // Bypass RLS for test setups/verifications

  beforeAll(async () => {
    // Reset database and seed base customers & subscriptions
    await seedDemoData();
  });

  it("should return 404 if the recovery workflow ID does not exist", async () => {
    const fakeWorkflowId = "00000000-0000-0000-0000-000000000000";
    const req = new Request(`http://localhost:3000/api/workflows/${fakeWorkflowId}/recover`, {
      method: "POST",
    });

    const response = await POST(req, {
      params: Promise.resolve({ id: fakeWorkflowId }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain("Workflow with ID");
  });

  it("should successfully recover an active workflow, transition database states, and write audit logs", async () => {
    // 1. Fetch Alex's customer and subscription details
    const alexId = "11111111-1111-1111-1111-111111111111";
    const alexSubId = "11111111-1111-1111-1111-222222222222";

    // Query initial success count
    const { count: initialCount } = await db
      .from("payment_events")
      .select("*", { count: "exact", head: true })
      .eq("subscription_id", alexSubId)
      .eq("status", "succeeded");

    const expectedInitialCount = initialCount || 0;

    // Update Alex's subscription to past_due to simulate active recovery case
    await db
      .from("subscriptions")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("id", alexSubId);

    // 2. Create a mock payment failure event
    const { data: payEvent, error: payError } = await db
      .from("payment_events")
      .insert({
        customer_id: alexId,
        subscription_id: alexSubId,
        provider: "razorpay",
        external_event_id: `evt_recover_test_fail_${Date.now()}`,
        amount: 2499.00,
        currency: "INR",
        status: "failed",
        failure_code: "card_declined",
        attempt_number: 1,
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(payError).toBeNull();
    expect(payEvent).toBeDefined();

    // 3. Create a mock revenue risk
    const { data: risk, error: riskError } = await db
      .from("revenue_risks")
      .insert({
        customer_id: alexId,
        subscription_id: alexSubId,
        payment_event_id: payEvent.id,
        amount_at_risk: 2499.00,
        risk_score: 75,
        risk_level: "critical",
        reason: "Card declined on payment attempt.",
        recoverability_score: 85,
        status: "open",
      })
      .select()
      .single();

    expect(riskError).toBeNull();
    expect(risk).toBeDefined();

    // 4. Create a mock recovery workflow
    const { data: workflow, error: workflowError } = await db
      .from("recovery_workflows")
      .insert({
        customer_id: alexId,
        subscription_id: alexSubId,
        revenue_risk_id: risk.id,
        trigger_type: "payment_failure",
        status: "executing",
        risk_score: 75,
      })
      .select()
      .single();

    expect(workflowError).toBeNull();
    expect(workflow).toBeDefined();
    const workflowId = workflow.id;

    // 5. Invoke the recover API route POST handler
    const req = new Request(`http://localhost:3000/api/workflows/${workflowId}/recover`, {
      method: "POST",
    });

    const response = await POST(req, {
      params: Promise.resolve({ id: workflowId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.recovered_amount).toBe(2499.00);

    // 6. Verify Database transitions
    // Verify recovery workflow is completed
    const { data: updatedWorkflow } = await db
      .from("recovery_workflows")
      .select("status, completed_at")
      .eq("id", workflowId)
      .single();
    expect(updatedWorkflow.status).toBe("completed");
    expect(updatedWorkflow.completed_at).toBeDefined();

    // Verify revenue risk status is recovered
    const { data: updatedRisk } = await db
      .from("revenue_risks")
      .select("status")
      .eq("id", risk.id)
      .single();
    expect(updatedRisk.status).toBe("recovered");

    // Verify subscription status is reverted back to active
    const { data: updatedSub } = await db
      .from("subscriptions")
      .select("status")
      .eq("id", alexSubId)
      .single();
    expect(updatedSub.status).toBe("active");

    // Verify a new successful payment event was added to the history
    const { data: successEvent } = await db
      .from("payment_events")
      .select("*")
      .eq("subscription_id", alexSubId)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(successEvent).toBeDefined();
    expect(successEvent.amount).toBe(2499.00);
    expect(successEvent.provider).toBe("razorpay");

    // Verify audit logs were written for the completed workflow
    const { data: auditLog } = await db
      .from("audit_logs")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("event_type", "workflow_completed")
      .single();
    expect(auditLog).toBeDefined();
    expect(auditLog.actor).toBe("user");
    expect(auditLog.input.trigger).toBe("simulate_recovery_resolution");

    // 7. Verify Idempotency: Trigger recover endpoint again for the same completed workflow
    const secondReq = new Request(`http://localhost:3000/api/workflows/${workflowId}/recover`, {
      method: "POST",
    });

    const secondResponse = await POST(secondReq, {
      params: Promise.resolve({ id: workflowId }),
    });

    expect(secondResponse.status).toBe(200);
    const secondBody = await secondResponse.json();
    expect(secondBody.success).toBe(true);
    expect(secondBody.message).toBe("Payment is already marked as recovered.");

    // Verify database counts have not duplicated
    const { count: paymentCount } = await db
      .from("payment_events")
      .select("*", { count: "exact", head: true })
      .eq("subscription_id", alexSubId)
      .eq("status", "succeeded");

    expect(paymentCount).toBe(expectedInitialCount + 1); // Still exactly one success event added
  });
});
