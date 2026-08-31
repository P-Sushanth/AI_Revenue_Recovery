import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";
import { processPaymentEvent } from "@/lib/recovery/process-payment-event";
import { runAiAnalysis } from "@/lib/ai/recovery-agent";
import { executeRecoveryAction } from "@/lib/recovery/action-executor";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_ROUTES !== "true") {
    return NextResponse.json({
      success: false,
      message: "Forbidden: Demo endpoints are disabled in production mode.",
    }, { status: 403 });
  }

  try {
    const db = getDbClient(true);

    // Check if a specific case is requested (e.g., query params)
    const { searchParams } = new URL(request.url);
    const selectedCase = searchParams.get("case") || "alex";

    let customerExternalId = "cus_alex_123";
    let subscriptionExternalId = "sub_alex_111";
    let amount = 2499.00;
    let failureCode = "expired_card";
    let failureMessage = "Simulated expired card decline";
    let attemptNumber = 1;

    if (selectedCase === "sarah") {
      customerExternalId = "cus_sarah_456";
      subscriptionExternalId = "sub_sarah_222";
      amount = 7999.00;
      failureCode = "authentication_required";
      failureMessage = "Authentication required (3D Secure validation failed)";
      attemptNumber = 1;
    } else if (selectedCase === "john") {
      customerExternalId = "cus_john_789";
      subscriptionExternalId = "sub_john_333";
      amount = 499.00;
      failureCode = "insufficient_funds";
      failureMessage = "The account has insufficient funds to complete the payment.";
      attemptNumber = 1;
    } else if (selectedCase === "maya") {
      customerExternalId = "cus_maya_101";
      subscriptionExternalId = "sub_maya_444";
      amount = 2499.00;
      failureCode = "card_declined";
      failureMessage = "Generic bank decline event";
      attemptNumber = 4; // Multiple declines trigger critical risk level
    } else if (selectedCase === "daniel") {
      customerExternalId = "cus_daniel_202";
      subscriptionExternalId = "sub_daniel_555";
      amount = 2499.00;
      failureCode = "expired_card";
      failureMessage = "Subscription already cancelled";
      attemptNumber = 1;
    } else if (selectedCase === "clara") {
      customerExternalId = "cus_clara_303";
      subscriptionExternalId = "sub_clara_666";
      amount = 1499.00;
      failureCode = "processing_error";
      failureMessage = "Gateway processing timeout error";
      attemptNumber = 1;
    } else if (selectedCase === "james") {
      customerExternalId = "cus_james_404";
      subscriptionExternalId = "sub_james_777";
      amount = 999.00;
      failureCode = "card_declined";
      failureMessage = "Card was declined by issuing bank";
      attemptNumber = 1;
    }

    // 1. Ensure we have seeded data
    const { data: customer } = await db
      .from("customers")
      .select("external_id")
      .eq("external_id", customerExternalId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({
        success: false,
        message: `No demo customer for case "${selectedCase}" found. Please seed the database first.`,
      }, { status: 400 });
    }

    // 2. Simulate failed payment
    const externalEventId = `evt_sim_loop_${Date.now()}`;
    const rawPayload = {
      provider: "razorpay",
      external_event_id: externalEventId,
      customer_external_id: customerExternalId,
      subscription_external_id: subscriptionExternalId,
      amount,
      currency: "INR",
      status: "failed" as const,
      failure_code: failureCode as any,
      failure_message: failureMessage,
      attempt_number: attemptNumber,
      occurred_at: new Date().toISOString(),
      raw_payload: { simulation: true, trigger: "simulate-loop", case: selectedCase },
    };

    console.log("Simulating payment failure event...");
    const eventResult = await processPaymentEvent(rawPayload);

    if (!eventResult.workflowId) {
      throw new Error("Workflow Engine failed to create a recovery workflow.");
    }

    console.log(`Workflow created: ${eventResult.workflowId}. Running local AI Agent diagnosis...`);
    
    // 3. Trigger local Ollama Qwen model analysis on the workflow
    const aiRecommendation = await runAiAnalysis(eventResult.workflowId);

    console.log(`AI Agent finished analysis. Running Policy Engine and executing action...`);

    // 4. Run Policy check and execute intervention (Simulated Email Dispatch)
    const execResult = await executeRecoveryAction(eventResult.workflowId);

    // 5. Fetch the updated records to show details
    const { data: risk } = await db
      .from("revenue_risks")
      .select("*")
      .eq("id", eventResult.riskId)
      .single();

    const { data: workflow } = await db
      .from("recovery_workflows")
      .select("*")
      .eq("id", eventResult.workflowId)
      .single();

    const { data: action } = await db
      .from("recovery_actions")
      .select("*")
      .eq("workflow_id", eventResult.workflowId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      message: "Simulated end-to-end payment failure, AI diagnosis, Policy check, and Email intervention complete!",
      step_1_event_normalization: {
        provider: rawPayload.provider,
        external_event_id: rawPayload.external_event_id,
        amount: rawPayload.amount,
        currency: rawPayload.currency,
        status: rawPayload.status,
      },
      step_2_risk_engine: {
        risk_score: risk?.risk_score,
        risk_level: risk?.risk_level,
        amount_at_risk: risk?.amount_at_risk,
        recoverability_score: risk?.recoverability_score,
        reasons: risk?.reason,
        current_risk_status: risk?.status, // Should transition to 'in_recovery'
      },
      step_3_local_ai_agent: {
        workflow_id: workflow?.id,
        workflow_status: workflow?.status, // Transitions during executor
        diagnosis: aiRecommendation.diagnosis,
        reasoning_summary: aiRecommendation.reasoning_summary,
        recommended_action: aiRecommendation.recommended_action,
        urgency: aiRecommendation.urgency,
        confidence: aiRecommendation.confidence,
      },
      step_4_policy_and_executor: {
        policy_allowed: workflow?.action_status === "approved",
        approved_action: workflow?.approved_action,
        action_executed: action?.action_type,
        action_status: action?.status,
        provider_message_id: action?.provider_message_id,
        execution_summary: execResult.reason,
      }
    });

  } catch (error: any) {
    console.error("End-to-end loop simulation failed:", error);
    return NextResponse.json({
      success: false,
      error: {
        code: "LOOP_SIMULATION_FAILED",
        message: error.message || "An unexpected error occurred during end-to-end loop simulation.",
      }
    }, { status: 500 });
  }
}

// Allow GET for simple browser testing
export async function GET() {
  return POST({} as Request);
}
