import { NextResponse } from "next/server";
import crypto from "crypto";
import { processPaymentEvent } from "@/lib/recovery/process-payment-event";
import { runAiAnalysis } from "@/lib/ai/recovery-agent";
import { executeRecoveryAction } from "@/lib/recovery/action-executor";

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

      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.error("Signature verification failed.");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      console.warn("RAZORPAY_WEBHOOK_SECRET is not configured. Skipping signature verification in development.");
    }

    // 2. Parse payload
    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    
    // We only care about payment.failed and payment.captured / order.paid
    if (eventType !== "payment.failed" && eventType !== "payment.captured" && eventType !== "order.paid") {
      return NextResponse.json({ message: `Event ${eventType} ignored.` }, { status: 200 });
    }

    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      return NextResponse.json({ error: "Invalid payload: missing payment entity" }, { status: 400 });
    }

    // 3. Normalize values
    const amountInPaise = paymentEntity.amount;
    const amountInRupees = amountInPaise ? amountInPaise / 100 : 0;
    const currency = paymentEntity.currency || "INR";
    const externalEventId = paymentEntity.id; // e.g. pay_G3kK2...
    
    // In Razorpay, payment has a contact / email and optional notes.
    // Razorpay customer_id is in paymentEntity.customer_id
    const customerExternalId = paymentEntity.customer_id || paymentEntity.email;
    
    // Check if there is subscription_id in notes or root level
    const subscriptionExternalId = 
      paymentEntity.notes?.subscription_id || 
      paymentEntity.notes?.subscription_external_id || 
      paymentEntity.invoice_id || 
      `sub_fallback_${customerExternalId}`;

    const normalizedStatus = eventType === "payment.failed" ? "failed" : "succeeded";
    
    // Failure code mapping
    let failureCode = null;
    let failureMessage = null;
    if (normalizedStatus === "failed") {
      const razorpayReason = paymentEntity.error_reason || paymentEntity.error_code || "unknown";
      failureMessage = paymentEntity.error_description || "Payment failed on Razorpay";
      
      // Map Razorpay failure reasons to our standard ones:
      // card_expired, insufficient_funds, incorrect_pin, authentication_failed, card_declined, lost_or_stolen_card
      if (razorpayReason.includes("expired")) {
        failureCode = "expired_card";
      } else if (razorpayReason.includes("insufficient") || razorpayReason.includes("balance")) {
        failureCode = "insufficient_funds";
      } else if (razorpayReason.includes("pin") || razorpayReason.includes("password")) {
        failureCode = "incorrect_pin";
      } else if (razorpayReason.includes("auth") || razorpayReason.includes("otp")) {
        failureCode = "authentication_failed";
      } else {
        failureCode = "card_declined";
      }
    }

    const normalizedPayload = {
      provider: "razorpay",
      external_event_id: externalEventId,
      customer_external_id: customerExternalId || "unknown_customer",
      subscription_external_id: subscriptionExternalId || "unknown_subscription",
      amount: amountInRupees,
      currency: currency,
      status: normalizedStatus,
      failure_code: failureCode,
      failure_message: failureMessage,
      attempt_number: 1, // Default or parse from metadata
      occurred_at: new Date(payload.created_at * 1000).toISOString(),
      raw_payload: payload,
    };

    console.log(`Razorpay webhook processing normalized event: ${externalEventId} (status: ${normalizedStatus})`);
    
    // 4. Process event to database
    const processResult = await processPaymentEvent(normalizedPayload);

    // 5. Asynchronously trigger recovery if it's a failed event and a workflow was created
    if (normalizedStatus === "failed" && processResult.workflowId) {
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
      message: `Event processed. status=${normalizedStatus}`,
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
