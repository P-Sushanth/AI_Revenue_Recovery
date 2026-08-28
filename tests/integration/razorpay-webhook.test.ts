import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import { POST } from "@/app/api/webhooks/razorpay/route";
import { seedDemoData } from "@/lib/demo/demo-data";
import { getDbClient } from "@/lib/db/client";

describe("Razorpay Webhook Integration Tests", () => {
  const db = getDbClient(true);
  const webhookSecret = "test_webhook_secret_key_123456";

  beforeAll(async () => {
    // Seed standard base customer / subscription profiles
    await seedDemoData();
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
  });

  const generateSignature = (payloadObj: any) => {
    const rawBody = JSON.stringify(payloadObj);
    return crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
  };

  it("should reject webhook with 401 if x-razorpay-signature header is missing", async () => {
    const payload = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_test_failed_1",
            amount: 249900,
            currency: "INR",
            status: "failed",
            customer_id: "cus_alex_123",
            error_reason: "card_expired",
            error_description: "Card has expired",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const req = new Request("http://localhost:3000/api/webhooks/razorpay", {
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

  it("should reject webhook with 401 if x-razorpay-signature is invalid", async () => {
    const payload = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_test_failed_2",
            amount: 249900,
            currency: "INR",
            status: "failed",
            customer_id: "cus_alex_123",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const req = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": "wrong_calculated_signature_value",
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("should process payment.failed, insert records, and initialize AI workflow", async () => {
    const paymentId = `pay_fail_test_${Date.now()}`;
    const payload = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: 249900, // paise (₹2,499.00)
            currency: "INR",
            status: "failed",
            customer_id: "cus_alex_123",
            error_reason: "card_expired",
            error_description: "The card has expired.",
            notes: {
              subscription_id: "sub_alex_111",
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const signature = generateSignature(payload);

    const req = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
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
      .eq("external_event_id", paymentId)
      .single();

    expect(dbEvent).toBeDefined();
    expect(dbEvent.amount).toBe(2499.00);
    expect(dbEvent.provider).toBe("razorpay");
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

  it("should process duplicate payment.failed event and ignore duplicate runs", async () => {
    const paymentId = `pay_duplicate_test_${Date.now()}`;
    const payload = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: 249900,
            currency: "INR",
            status: "failed",
            customer_id: "cus_alex_123",
            error_reason: "card_expired",
            error_description: "Card has expired",
            notes: {
              subscription_id: "sub_alex_111",
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const signature = generateSignature(payload);

    // Call 1
    const req1 = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      body: JSON.stringify(payload),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);
    expect(body1.workflowId).toBeDefined();

    // Call 2 (Duplicate)
    const req2 = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      body: JSON.stringify(payload),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.workflowId).toBeNull(); // Ignored duplicate should return null workflowId
  });

  it("should process payment.captured event and auto-resolve existing open workflows", async () => {
    // 1. First trigger a failed event to open a risk
    const failPaymentId = `pay_fail_to_resolve_${Date.now()}`;
    const failPayload = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: failPaymentId,
            amount: 799900, // paise (₹7,999.00)
            currency: "INR",
            status: "failed",
            customer_id: "cus_sarah_456",
            error_reason: "insufficient_balance",
            error_description: "Insufficient funds in account.",
            notes: {
              subscription_id: "sub_sarah_222",
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const failReq = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": generateSignature(failPayload),
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

    // 2. Trigger payment.captured for the same customer subscription to resolve
    const capturePaymentId = `pay_captured_${Date.now()}`;
    const capturePayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: capturePaymentId,
            amount: 799900,
            currency: "INR",
            status: "captured",
            customer_id: "cus_sarah_456",
            notes: {
              subscription_id: "sub_sarah_222",
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const captureReq = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": generateSignature(capturePayload),
      },
      body: JSON.stringify(capturePayload),
    });

    const captureRes = await POST(captureReq);
    expect(captureRes.status).toBe(200);

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
