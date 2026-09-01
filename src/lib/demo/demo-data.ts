import { randomUUID } from "crypto";
import { getDbClient } from "../db/client";
import { processPaymentEvent } from "../recovery/process-payment-event";

// Types for seeding
interface CustomerSeed {
  id: string;
  external_id: string;
  name: string;
  email: string;
  currency: string;
  country: string;
}

interface SubscriptionSeed {
  id: string;
  customer_id: string;
  external_id: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: "active" | "past_due" | "cancelled" | "paused";
  billing_interval: string;
  next_billing_date: Date;
}

interface PaymentEventSeed {
  id: string;
  customer_id: string;
  subscription_id: string;
  provider: string;
  external_event_id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "failed" | "pending";
  failure_code?: string | null;
  failure_message?: string | null;
  attempt_number: number;
  occurred_at: Date;
  raw_payload?: any;
}

export async function seedDemoData(triggerActiveFailures = false) {
  const db = getDbClient(true); // Get the admin client to bypass RLS

  console.log("Starting database cleanup...");
  // Clean up in reverse foreign key order
  await db.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("recovery_actions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("recovery_workflows").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("revenue_risks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("payment_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("subscriptions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Cleanup finished.");

  // Generate deterministic UUIDs for reference
  const alexId = "11111111-1111-1111-1111-111111111111";
  const sarahId = "22222222-2222-2222-2222-222222222222";
  const johnId = "33333333-3333-3333-3333-333333333333";
  const mayaId = "44444444-4444-4444-4444-444444444444";
  const danielId = "55555555-5555-5555-5555-555555555555";
  const claraId = "66666666-6666-6666-6666-666666666666";
  const jamesId = "77777777-7777-7777-7777-777777777777";
  const rohanId = "88888888-8888-8888-8888-888888888888";
  const anitaId = "99999999-9999-9999-9999-999999999999";

  const alexSubId = "11111111-1111-1111-1111-222222222222";
  const sarahSubId = "22222222-2222-2222-2222-333333333333";
  const johnSubId = "33333333-3333-3333-3333-444444444444";
  const mayaSubId = "44444444-4444-4444-4444-555555555555";
  const danielSubId = "55555555-5555-5555-5555-666666666666";
  const claraSubId = "66666666-6666-6666-6666-777777777777";
  const jamesSubId = "77777777-7777-7777-7777-888888888888";
  const rohanSubId = "88888888-8888-8888-8888-999999999999";
  const anitaSubId = "99999999-9999-9999-9999-000000000000";

  const customers: CustomerSeed[] = [
    { id: alexId, external_id: "cus_alex_123", name: "Alex", email: "alex@example.com", currency: "INR", country: "IN" },
    { id: sarahId, external_id: "cus_sarah_456", name: "Sarah", email: "sarah@example.com", currency: "INR", country: "IN" },
    { id: johnId, external_id: "cus_john_789", name: "John", email: "john@example.com", currency: "INR", country: "IN" },
    { id: mayaId, external_id: "cus_maya_101", name: "Maya", email: "maya@example.com", currency: "INR", country: "IN" },
    { id: danielId, external_id: "cus_daniel_202", name: "Daniel", email: "daniel@example.com", currency: "INR", country: "IN" },
    { id: claraId, external_id: "cus_clara_303", name: "Clara", email: "clara@example.com", currency: "INR", country: "IN" },
    { id: jamesId, external_id: "cus_james_404", name: "James", email: "james@example.com", currency: "INR", country: "IN" },
    { id: rohanId, external_id: "cus_rohan_505", name: "Rohan", email: "rohan@example.com", currency: "INR", country: "IN" },
    { id: anitaId, external_id: "cus_anita_606", name: "Anita", email: "anita@example.com", currency: "INR", country: "IN" },
  ];

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const subscriptions: SubscriptionSeed[] = [
    {
      id: alexSubId,
      customer_id: alexId,
      external_id: "sub_alex_111",
      plan_name: "Pro",
      amount: 2499.00,
      currency: "INR",
      status: "active",
      billing_interval: "month",
      next_billing_date: nextMonth,
    },
    {
      id: sarahSubId,
      customer_id: sarahId,
      external_id: "sub_sarah_222",
      plan_name: "Business",
      amount: 7999.00,
      currency: "INR",
      status: "active",
      billing_interval: "month",
      next_billing_date: nextMonth,
    },
    {
      id: johnSubId,
      customer_id: johnId,
      external_id: "sub_john_333",
      plan_name: "Starter",
      amount: 499.00,
      currency: "INR",
      status: "active",
      billing_interval: "month",
      next_billing_date: nextMonth,
    },
    {
      id: mayaSubId,
      customer_id: mayaId,
      external_id: "sub_maya_444",
      plan_name: "Pro",
      amount: 2499.00,
      currency: "INR",
      status: "active",
      billing_interval: "month",
      next_billing_date: nextMonth,
    },
    {
      id: danielSubId,
      customer_id: danielId,
      external_id: "sub_daniel_555",
      plan_name: "Pro",
      amount: 2499.00,
      currency: "INR",
      status: "cancelled",
      billing_interval: "month",
      next_billing_date: now,
    },
    {
      id: claraSubId,
      customer_id: claraId,
      external_id: "sub_clara_666",
      plan_name: "Pro",
      amount: 1499.00,
      currency: "INR",
      status: "paused",
      billing_interval: "month",
      next_billing_date: nextMonth,
    },
    {
      id: jamesSubId,
      customer_id: jamesId,
      external_id: "sub_james_777",
      plan_name: "Starter",
      amount: 999.00,
      currency: "INR",
      status: "cancelled",
      billing_interval: "month",
      next_billing_date: now,
    },
    {
      id: rohanSubId,
      customer_id: rohanId,
      external_id: "sub_rohan_888",
      plan_name: "Basic",
      amount: 199.00,
      currency: "INR",
      status: "active",
      billing_interval: "month",
      next_billing_date: nextMonth,
    },
    {
      id: anitaSubId,
      customer_id: anitaId,
      external_id: "sub_anita_999",
      plan_name: "Enterprise",
      amount: 12499.00,
      currency: "INR",
      status: "active",
      billing_interval: "month",
      next_billing_date: nextMonth,
    },
  ];

  console.log("Seeding customers and subscriptions...");
  await db.from("customers").insert(customers);
  await db.from("subscriptions").insert(subscriptions);

  // Generate historical payments
  const paymentEvents: PaymentEventSeed[] = [];

  // Helper to create past payment events
  const addHistoricalPayments = (
    customerId: string,
    subscriptionId: string,
    amount: number,
    count: number
  ) => {
    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (i + 1));
      paymentEvents.push({
        id: randomUUID(),
        customer_id: customerId,
        subscription_id: subscriptionId,
        provider: "razorpay",
        external_event_id: `evt_success_${customerId.split("-")[0]}_${i}`,
        amount,
        currency: "INR",
        status: "succeeded",
        attempt_number: 1,
        occurred_at: date,
        raw_payload: { status: "succeeded", billing_cycle: i + 1 },
      });
    }
  };

  // 1. Alex: 8 successful payments
  addHistoricalPayments(alexId, alexSubId, 2499.00, 8);

  // 2. Sarah: 12 successful payments
  addHistoricalPayments(sarahId, sarahSubId, 7999.00, 12);

  // 3. John: 0 successful payments
  // 4. Maya: 3 past failures
  for (let i = 1; i <= 3; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    paymentEvents.push({
      id: randomUUID(),
      customer_id: mayaId,
      subscription_id: mayaSubId,
      provider: "razorpay",
      external_event_id: `evt_fail_maya_attempt_${i}`,
      amount: 2499.00,
      currency: "INR",
      status: "failed",
      failure_code: "card_declined",
      failure_message: "Your card was declined.",
      attempt_number: i,
      occurred_at: date,
      raw_payload: { failure_reason: "card_declined", attempt: i },
    });
  }

  // 5. Daniel: 0 successful payments
  // 6. Clara: 5 successful payments
  addHistoricalPayments(claraId, claraSubId, 1499.00, 5);

  // 7. James: 3 successful payments
  addHistoricalPayments(jamesId, jamesSubId, 999.00, 3);

  // 8. Rohan: 15 successful payments (strong history for low risk)
  addHistoricalPayments(rohanId, rohanSubId, 199.00, 15);

  // 9. Anita: 10 successful payments
  addHistoricalPayments(anitaId, anitaSubId, 12499.00, 10);

  console.log("Seeding payment events...");
  if (paymentEvents.length > 0) {
    await db.from("payment_events").insert(paymentEvents);
  }

  if (triggerActiveFailures) {
    console.log("Triggering active payment failures to populate risks...");

    // Helper to update recommendation for seeded workflows
    const applySeededRecommendation = async (workflowId: string | undefined, action: string) => {
      if (!workflowId) return;
      await db.from("recovery_workflows").update({
        status: "awaiting_approval",
        recommended_action: action,
        updated_at: new Date().toISOString()
      }).eq("id", workflowId);
    };

    // 1. Alex - Expired Card
    const alexRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_alex_${Date.now()}`,
      customer_external_id: "cus_alex_123",
      subscription_external_id: "sub_alex_111",
      amount: 2499.00,
      currency: "INR",
      status: "failed",
      failure_code: "expired_card",
      failure_message: "Simulated expired card decline",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(alexRes.workflowId, "send_payment_recovery_email");

    // 2. Sarah - Authentication Required
    const sarahRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_sarah_${Date.now()}`,
      customer_external_id: "cus_sarah_456",
      subscription_external_id: "sub_sarah_222",
      amount: 7999.00,
      currency: "INR",
      status: "failed",
      failure_code: "authentication_required",
      failure_message: "Authentication required (3D Secure validation failed)",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(sarahRes.workflowId, "send_payment_recovery_email");

    // 3. John - Insufficient Funds
    const johnRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_john_${Date.now()}`,
      customer_external_id: "cus_john_789",
      subscription_external_id: "sub_john_333",
      amount: 499.00,
      currency: "INR",
      status: "failed",
      failure_code: "insufficient_funds",
      failure_message: "The account has insufficient funds to complete the payment.",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(johnRes.workflowId, "no_action");

    // 4. Maya - Multiple Declines (4th Attempt)
    const mayaRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_maya_${Date.now()}`,
      customer_external_id: "cus_maya_101",
      subscription_external_id: "sub_maya_444",
      amount: 2499.00,
      currency: "INR",
      status: "failed",
      failure_code: "card_declined",
      failure_message: "Generic bank decline event",
      attempt_number: 4,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(mayaRes.workflowId, "send_payment_recovery_email");

    // 5. Daniel - Cancelled Subscription
    const danielRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_daniel_${Date.now()}`,
      customer_external_id: "cus_daniel_202",
      subscription_external_id: "sub_daniel_555",
      amount: 2499.00,
      currency: "INR",
      status: "failed",
      failure_code: "expired_card",
      failure_message: "Card expired",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(danielRes.workflowId, "no_action");

    // 6. Clara - Paused Subscription + Processing Error
    const claraRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_clara_${Date.now()}`,
      customer_external_id: "cus_clara_303",
      subscription_external_id: "sub_clara_666",
      amount: 1499.00,
      currency: "INR",
      status: "failed",
      failure_code: "processing_error",
      failure_message: "Gateway processing timeout error",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(claraRes.workflowId, "send_payment_recovery_email");

    // 7. James - Cancelled Subscription + Card Declined
    const jamesRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_james_${Date.now()}`,
      customer_external_id: "cus_james_404",
      subscription_external_id: "sub_james_777",
      amount: 999.00,
      currency: "INR",
      status: "failed",
      failure_code: "card_declined",
      failure_message: "Card was declined by issuing bank",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(jamesRes.workflowId, "no_action");

    // 8. Rohan - LOW RISK profile case
    const rohanRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_rohan_${Date.now()}`,
      customer_external_id: "cus_rohan_505",
      subscription_external_id: "sub_rohan_888",
      amount: 199.00,
      currency: "INR",
      status: "failed",
      failure_code: "processing_error",
      failure_message: "Temporary gateway timeout",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(rohanRes.workflowId, "send_payment_recovery_email");
    if (rohanRes.riskId) {
      await db.from("revenue_risks").update({
        risk_score: 20,
        risk_level: "low"
      }).eq("id", rohanRes.riskId);
    }

    // 9. Anita - IN RECOVERY profile case (Active Recovery in Process)
    const anitaRes = await processPaymentEvent({
      provider: "razorpay",
      external_event_id: `evt_seed_fail_anita_${Date.now()}`,
      customer_external_id: "cus_anita_606",
      subscription_external_id: "sub_anita_999",
      amount: 12499.00,
      currency: "INR",
      status: "failed",
      failure_code: "authentication_required",
      failure_message: "3DS authentication step required",
      attempt_number: 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { seed: true }
    });
    await applySeededRecommendation(anitaRes.workflowId, "send_payment_recovery_email");
    if (anitaRes.riskId) {
      await db.from("revenue_risks").update({
        status: "in_recovery"
      }).eq("id", anitaRes.riskId);
    }
    if (anitaRes.workflowId) {
      await db.from("recovery_workflows").update({
        status: "in_recovery"
      }).eq("id", anitaRes.workflowId);
    }
  }

  console.log("Seeding finished successfully!");
  return {
    customers: { alexId, sarahId, johnId, mayaId, danielId, claraId, jamesId, rohanId, anitaId },
    subscriptions: { alexSubId, sarahSubId, johnSubId, mayaSubId, danielSubId, claraSubId, jamesSubId, rohanSubId, anitaSubId },
  };
}
