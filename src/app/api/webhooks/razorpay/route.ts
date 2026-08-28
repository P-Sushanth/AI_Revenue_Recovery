import { NextResponse } from "next/server";
import { processPaymentEvent } from "@/lib/recovery/process-payment-event";
import { runAiAnalysis } from "@/lib/ai/recovery-agent";
import { executeRecoveryAction } from "@/lib/recovery/action-executor";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay/signature";
import { parseRazorpayWebhook } from "@/lib/payments/razorpay/parser";

export async function POST(request: Request) {
  try {
    // 1. Get raw request body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
      if (!signature) {
        console.error("Missing X-Razorpay-Signature header.");
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }

      const isValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error("Signature verification failed.");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      console.warn("RAZORPAY_WEBHOOK_SECRET is not configured. Skipping signature verification in development.");
    }

    // 2. Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
    }

    // 3. Normalize values using the parser helper
    const normalizedPayload = parseRazorpayWebhook(payload);
    
    // If the event type is valid but irrelevant, return success without processing
    if (!normalizedPayload) {
      return NextResponse.json({ message: "Event ignored." }, { status: 200 });
    }

    console.log(`Razorpay webhook processing normalized event: ${normalizedPayload.external_event_id} (status: ${normalizedPayload.status})`);
    
    // 4. Process event to database
    const processResult = await processPaymentEvent(normalizedPayload);

    // 5. Asynchronously trigger recovery if it's a failed event and a workflow was created
    if (normalizedPayload.status === "failed" && processResult.workflowId) {
      const workflowId = processResult.workflowId;
      console.log(`Autonomous recovery started for workflow ${workflowId}`);
      
      // We run this in the background and do not block the webhook response
      (async () => {
        try {
          // Perform AI Analysis
          const recommendation = await runAiAnalysis(workflowId);
          // If recommended action is send_payment_recovery_email, execute it
          if (recommendation.recommended_action === "send_payment_recovery_email") {
            await executeRecoveryAction(workflowId);
            console.log(`Successfully completed auto recovery execution for workflow ${workflowId}`);
          } else {
            console.log(`Action ${recommendation.recommended_action} did not match send_payment_recovery_email; workflow awaiting manual approval.`);
          }
        } catch (bgErr) {
          console.error(`Background workflow run failed for workflow ${workflowId}:`, bgErr);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      message: `Event processed. status=${normalizedPayload.status}`,
      workflowId: processResult.workflowId || null,
      riskId: processResult.riskId || null,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Razorpay webhook processing failed:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Webhook handling internal error",
    }, { status: 500 });
  }
}
