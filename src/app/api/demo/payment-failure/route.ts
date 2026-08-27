import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";
import { processPaymentEvent } from "@/lib/recovery/process-payment-event";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_external_id, failure_code, attempt_number } = body;

    if (!customer_external_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_CUSTOMER_ID",
            message: "customer_external_id is required in the request body.",
          },
        },
        { status: 400 }
      );
    }

    const db = getDbClient(true); // Server admin client

    // 1. Fetch the Customer and their associated Subscription
    const { data: customer, error: customerError } = await db
      .from("customers")
      .select("id")
      .eq("external_id", customer_external_id)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CUSTOMER_NOT_FOUND",
            message: `Seeded customer with external ID ${customer_external_id} was not found. Please seed data first.`,
          },
        },
        { status: 404 }
      );
    }

    const { data: subscription, error: subError } = await db
      .from("subscriptions")
      .select("external_id, amount, currency")
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (subError || !subscription) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SUBSCRIPTION_NOT_FOUND",
            message: `Subscription for customer ${customer_external_id} not found.`,
          },
        },
        { status: 404 }
      );
    }

    // 2. Construct simulated raw payment failure event
    const externalEventId = `evt_sim_${customer_external_id}_${Date.now()}`;
    const rawPayload = {
      provider: "stripe",
      external_event_id: externalEventId,
      customer_external_id: customer_external_id,
      subscription_external_id: subscription.external_id,
      amount: Number(subscription.amount),
      currency: subscription.currency,
      status: "failed",
      failure_code: failure_code || "card_declined",
      failure_message: `Simulated payment decline: ${failure_code || "card_declined"}`,
      attempt_number: attempt_number || 1,
      occurred_at: new Date().toISOString(),
      raw_payload: { simulation: true, trigger_time: new Date().toISOString() },
    };

    // 3. Process the event via the Workflow Engine
    const result = await processPaymentEvent(rawPayload);

    return NextResponse.json({
      success: true,
      message: "Payment failure event processed successfully.",
      data: result,
    });
  } catch (error: any) {
    console.error("Simulation trigger failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SIMULATION_FAILED",
          message: error.message || "An unexpected error occurred during payment failure simulation.",
        },
      },
      { status: 500 }
    );
  }
}
