import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import { POST } from "@/app/api/webhooks/stripe/route";
import { seedDemoData } from "@/lib/demo/demo-data";
import { getDbClient } from "@/lib/db/client";

describe("Stripe Webhook Integration Tests", () => {
  const db = getDbClient(true);
  const webhookSecret = "whsec_test_stripe_integration_secret_999999";

  beforeAll(async () => {
    // Seed standard base customer / subscription profiles
    await seedDemoData();
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  });

  const generateSignatureHeader = (payloadObj: any, timestamp?: string) => {
    const rawBody = JSON.stringify(payloadObj);
    const ts = timestamp || Math.floor(Date.now() / 1000).toString();
    const signedPayload = `${ts}.${rawBody}`;
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");
    return `t=${ts},v1=${signature}`;
  };

  it("should reject webhook with 401 if stripe-signature header is missing", async () => {
    const payload = {
      id: "evt_test_missing_sig",
      type: "invoice.payment_failed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "in_stripe_test_failed_1",
          customer: "cus_alex_123",
          subscription: "sub_alex_111",
          amount_due: 249900,
          currency: "inr",
          attempt_count: 1
        }
      }
    };

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.error).toBe("Missing signature");
  });

  it("should reject webhook with 401 if stripe-signature is invalid", async () => {
    const payload = {
      id: "evt_test_invalid_sig",
      type: "invoice.payment_failed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "in_stripe_test_failed_2",
          customer: "cus_alex_123",
          amount_due: 249900,
        }
      }
    };

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=12345,v1=invalid_signature_hash_values",
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("should process invoice.payment_failed, insert records, and initialize AI workflow", async () => {
    const invoiceId = `in_test_fail_${Date.now()}`;
    const payload = {
      id: `evt_stripe_fail_${Date.now()}`,
      type: "invoice.payment_failed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: invoiceId,
          customer: "cus_alex_123",
          subscription: "sub_alex_111",
          amount_due: 249900, // $2499.00
          currency: "INR",
          attempt_count: 1,
          last_payment_error: {
            code: "card_expired",
            decline_code: "expired_card",
            message: "The card has expired."
          }
        }
      }
    };

    const signature = generateSignatureHeader(payload);

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.workflowId).toBeDefined();
    expect(body.riskId).toBeDefined();

    // Verify record insertion in PostgreSQL database
    const { data: dbEvent } = await db
      .from("payment_events")
      .select("*")
      .eq("external_event_id", invoiceId)
      .single();

    expect(dbEvent).toBeDefined();
    expect(dbEvent.amount).toBe(2499.00);
    expect(dbEvent.provider).toBe("stripe");
    expect(dbEvent.status).toBe("failed");
    expect(dbEvent.failure_code).toBe("expired_card");

    // Verify recovery workflow registered in PostgreSQL database
    const { data: workflow } = await db
      .from("recovery_workflows")
      .select("*")
      .eq("id", body.workflowId)
      .single();

    expect(workflow).toBeDefined();
    expect(["pending", "analyzing", "awaiting_approval", "completed", "executing"]).toContain(workflow.status);
  });

  it("should process invoice.payment_succeeded event and auto-resolve existing open workflows", async () => {
    // 1. First trigger a failed event to open a risk
    const failInvoiceId = `in_fail_to_resolve_${Date.now()}`;
    const failPayload = {
      id: `evt_stripe_fail_to_resolve_${Date.now()}`,
      type: "invoice.payment_failed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: failInvoiceId,
          customer: "cus_sarah_456",
          subscription: "sub_sarah_222",
          amount_due: 799900, // ₹7,999.00
          currency: "INR",
          attempt_count: 1,
          last_payment_error: {
            code: "insufficient_funds",
            decline_code: "insufficient_balance",
            message: "Insufficient funds in account."
          }
        }
      }
    };

    const failReq = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": generateSignatureHeader(failPayload),
      },
      body: JSON.stringify(failPayload),
    });

    const failRes = await POST(failReq);
    expect(failRes.status).toBe(200);
    const failResBody = await failRes.json();
    const workflowId = failResBody.workflowId;
    const riskId = failResBody.riskId;

    // Verify the risk is open
    const { data: openRisk } = await db
      .from("revenue_risks")
      .select("status")
      .eq("id", riskId)
      .single();
    expect(openRisk.status).toBe("open");

    // 2. Trigger invoice.payment_succeeded for the same customer subscription to resolve
    const successInvoiceId = `in_success_resolve_${Date.now()}`;
    const successPayload = {
      id: `evt_stripe_success_resolve_${Date.now()}`,
      type: "invoice.payment_succeeded",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: successInvoiceId,
          customer: "cus_sarah_456",
          subscription: "sub_sarah_222",
          amount_paid: 799900,
          currency: "INR",
          attempt_count: 1
        }
      }
    };

    const successReq = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": generateSignatureHeader(successPayload),
      },
      body: JSON.stringify(successPayload),
    });

    const successRes = await POST(successReq);
    expect(successRes.status).toBe(200);

    // Verify database risk status transitioned to "recovered"
    const { data: resolvedRisk } = await db
      .from("revenue_risks")
      .select("status")
      .eq("id", riskId)
      .single();
    expect(resolvedRisk.status).toBe("recovered");

    // Verify database workflow status transitioned to "completed"
    const { data: resolvedWorkflow } = await db
      .from("recovery_workflows")
      .select("status")
      .eq("id", workflowId)
      .single();
    expect(resolvedWorkflow.status).toBe("completed");
  });
});
