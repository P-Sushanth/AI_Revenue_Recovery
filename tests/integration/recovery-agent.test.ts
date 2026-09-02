import { vi, describe, it, expect, beforeAll, afterEach } from "vitest";
import { runAiAnalysis, chatWithBillingAgent } from "@/lib/ai/recovery-agent";
import { processPaymentEvent } from "@/lib/recovery/process-payment-event";
import { seedDemoData } from "@/lib/demo/demo-data";
import { getDbClient } from "@/lib/db/client";

describe("AI Recovery Agent Integration Tests", () => {
  const db = getDbClient(true);
  let testWorkflowId: string;

  beforeAll(async () => {
    // Seed and trigger a mock failure to create a workflow to test against
    await seedDemoData();

    const triggerResult = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_test_ai_agent_${Date.now()}`,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should successfully parse valid JSON LLM response, update workflow, and write audit logs", async () => {
    const mockLLMOutput = {
      diagnosis: "The customer's card is expired.",
      reasoning_summary: "Expired card failure detected. Customer has successful history.",
      recommended_action: "send_payment_recovery_email",
      urgency: "high",
      customer_message_intent: "Ask customer to update their expired card details.",
      confidence: "high",
    };

    // Spy on global fetch to mock LLM API response only, leaving database calls intact
    const originalFetch = global.fetch;
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url, options) => {
      const urlStr = typeof url === "string" ? url : (url as any).url || "";
      if (urlStr.includes("11434") || urlStr.includes("api.openai.com")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockLLMOutput),
                },
              },
            ],
          }),
        } as Response;
      }
      return originalFetch(url, options);
    });

    const recommendation = await runAiAnalysis(testWorkflowId);

    // Assert outputs
    expect(recommendation.recommended_action).toBe("send_payment_recovery_email");
    expect(recommendation.urgency).toBe("high");

    // Verify DB Workflow State is awaiting_approval
    const { data: workflow } = await db
      .from("recovery_workflows")
      .select("*")
      .eq("id", testWorkflowId)
      .single();

    expect(workflow).toBeDefined();
    expect(workflow!.status).toBe("awaiting_approval");
    expect(workflow!.recommended_action).toBe("send_payment_recovery_email");

    // Verify LLM Audit Log
    const { data: auditLogs } = await db
      .from("audit_logs")
      .select("*")
      .eq("workflow_id", testWorkflowId)
      .eq("event_type", "ai_analysis_completed")
      .single();

    expect(auditLogs).toBeDefined();
    expect(auditLogs!.actor).toBe("llm");
    expect(auditLogs!.output.recommended_action).toBe("send_payment_recovery_email");

    expect(fetchSpy).toHaveBeenCalled();
  });

  it("should fail gracefully, transition workflow status to failed, and log system audit log on invalid JSON", async () => {
    // Mock malformed JSON response from LLM
    const malformedOutput = "This is not JSON at all, it's just a text error.";

    const originalFetch = global.fetch;
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url, options) => {
      const urlStr = typeof url === "string" ? url : (url as any).url || "";
      if (urlStr.includes("11434") || urlStr.includes("api.openai.com")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: malformedOutput,
                },
              },
            ],
          }),
        } as Response;
      }
      return originalFetch(url, options);
    });

    // Call runs and throws error internally (which we catch in the test)
    await expect(runAiAnalysis(testWorkflowId)).rejects.toThrow();

    // Verify DB Workflow State transitioned to failed
    const { data: workflow } = await db
      .from("recovery_workflows")
      .select("*")
      .eq("id", testWorkflowId)
      .single();

    expect(workflow).toBeDefined();
    expect(workflow!.status).toBe("failed");

    // Verify system failure audit log
    const { data: auditLogs } = await db
      .from("audit_logs")
      .select("*")
      .eq("workflow_id", testWorkflowId)
      .eq("event_type", "ai_analysis_completed")
      .order("created_at", { ascending: false });

    // The latest log should be the failure log from the system actor
    const latestLog = auditLogs![0];
    expect(latestLog).toBeDefined();
    expect(latestLog.actor).toBe("system");
    expect(latestLog.output.error).toBeDefined();

    expect(fetchSpy).toHaveBeenCalled();
  });

  it("should generate grounded chat reply from chatWithBillingAgent", async () => {
    const originalFetch = global.fetch;
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url, options) => {
      const urlStr = typeof url === "string" ? url : (url as any).url || "";
      if (urlStr.includes("11434") || urlStr.includes("api.openai.com")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: "Automated recovery was approved per policy guardrails.",
                },
              },
            ],
          }),
        } as Response;
      }
      return originalFetch(url, options);
    });

    const result = await chatWithBillingAgent({
      workflowId: testWorkflowId,
      messages: [{ role: "user", content: "Why was this recovery approved or blocked by policy?" }],
    });

    expect(result).toBeDefined();
    expect(result.reply).toBeTruthy();
    expect(result.model_used).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalled();
  });
});

