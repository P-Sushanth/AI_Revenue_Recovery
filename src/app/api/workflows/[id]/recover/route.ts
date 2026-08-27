import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;
    const db = getDbClient(true); // Bypass RLS as admin runner

    // 1. Fetch Workflow details
    const { data: workflow, error: wfError } = await db
      .from("recovery_workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (wfError || !workflow) {
      return NextResponse.json(
        { success: false, message: `Workflow with ID ${workflowId} not found.` },
        { status: 404 }
      );
    }

    // 2. Fetch associated Revenue Risk
    const { data: risk, error: riskError } = await db
      .from("revenue_risks")
      .select("*")
      .eq("id", workflow.revenue_risk_id)
      .single();

    if (riskError || !risk) {
      return NextResponse.json(
        { success: false, message: `Revenue risk not found for workflow ${workflowId}.` },
        { status: 404 }
      );
    }

    if (risk.status === "recovered") {
      return NextResponse.json({
        success: true,
        message: "Payment is already marked as recovered.",
      });
    }

    // 3. Update Revenue Risk status to recovered
    await db
      .from("revenue_risks")
      .update({
        status: "recovered",
        updated_at: new Date().toISOString(),
      })
      .eq("id", risk.id);

    // 4. Update parent Workflow status to completed
    await db
      .from("recovery_workflows")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    // 5. Insert simulated successful payment event to resolve subscription blockage
    const successEventId = `evt_recover_sim_${Date.now()}`;
    const { data: successEvent, error: eventError } = await db
      .from("payment_events")
      .insert({
        provider: "stripe",
        external_event_id: successEventId,
        customer_id: workflow.customer_id,
        subscription_id: workflow.subscription_id,
        amount: risk.amount_at_risk,
        currency: "INR", // Default to INR or currency of sub
        status: "succeeded",
        attempt_number: 1,
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (eventError) {
      console.warn("Could not record successful resolution event:", eventError.message);
    }

    // 6. Write Audit Logs
    await db.from("audit_logs").insert([
      {
        workflow_id: workflowId,
        event_type: "workflow_completed",
        actor: "user",
        input: { trigger: "simulate_recovery_resolution" },
        output: { status: "completed", payment_event_id: successEvent?.id || null },
      },
    ]);

    // 7. Update subscription back to active (if it was blocked or unpaid)
    await db
      .from("subscriptions")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflow.subscription_id);

    return NextResponse.json({
      success: true,
      message: "Simulation: Payment recovered successfully!",
      recovered_amount: risk.amount_at_risk,
      workflow_id: workflowId,
    });
  } catch (error: any) {
    console.error("Workflow recovery action failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "WORKFLOW_RECOVERY_FAILED",
          message: error.message || "An unexpected error occurred during simulated recovery.",
        },
      },
      { status: 500 }
    );
  }
}
