import { getDbClient } from "../db/client";
import { validateRecoveryAction } from "../policies/recovery-policy";
import { sendRecoveryEmail } from "../email/recovery-email";

export interface ExecutionResult {
  success: boolean;
  actionId?: string;
  policyApproved: boolean;
  reason: string;
  providerMessageId?: string;
}

/**
 * Validates the workflow against policies and dispatches the recovery action.
 * Enforces strict safety guardrails and idempotency controls.
 */
export async function executeRecoveryAction(workflowId: string): Promise<ExecutionResult> {
  const db = getDbClient(true); // Bypass RLS as system runner

  // 1. Fetch workflow and related records
  const { data: workflow, error: wfError } = await db
    .from("recovery_workflows")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (wfError || !workflow) {
    throw new Error(`Workflow with ID ${workflowId} not found.`);
  }

  // Already completed or failed? Return early.
  if (workflow.status === "completed" || workflow.status === "failed" || workflow.status === "cancelled") {
    return {
      success: workflow.status === "completed",
      policyApproved: workflow.action_status === "approved",
      reason: `Workflow is already in a terminal state: ${workflow.status}.`,
    };
  }

  const { data: risk, error: riskError } = await db
    .from("revenue_risks")
    .select("*")
    .eq("id", workflow.revenue_risk_id)
    .single();

  if (riskError || !risk) {
    throw new Error(`Revenue risk not found for workflow ${workflowId}.`);
  }

  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("*")
    .eq("id", workflow.customer_id)
    .single();

  if (customerError || !customer) {
    throw new Error(`Customer details not found for workflow ${workflowId}.`);
  }

  const { data: subscription, error: subError } = await db
    .from("subscriptions")
    .select("*")
    .eq("id", workflow.subscription_id)
    .single();

  if (subError || !subscription) {
    throw new Error(`Subscription details not found for workflow ${workflowId}.`);
  }

  const { data: paymentEvent, error: peError } = await db
    .from("payment_events")
    .select("*")
    .eq("id", risk.payment_event_id)
    .single();

  if (peError || !paymentEvent) {
    throw new Error(`Payment event details not found for risk ${risk.id}.`);
  }

  // 2. Perform Policy Validation Check
  const policyResult = validateRecoveryAction({
    recommendedAction: workflow.recommended_action || "no_action",
    risk,
    workflow,
    customer,
    subscription,
  });

  // Save policy check outcomes on the workflow
  await db
    .from("recovery_workflows")
    .update({
      approved_action: policyResult.approvedAction,
      action_status: policyResult.allowed ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", workflowId);

  // Write Policy Audit Log
  await db.from("audit_logs").insert({
    workflow_id: workflowId,
    event_type: "policy_check_completed",
    actor: "system",
    input: {
      risk_level: risk.risk_level,
      subscription_status: subscription.status,
      recommended_action: workflow.recommended_action,
    },
    output: {
      allowed: policyResult.allowed,
      approved_action: policyResult.approvedAction,
      reason: policyResult.reason,
    },
  });

  // Handle policy rejection / denial
  if (!policyResult.allowed || policyResult.approvedAction === "no_action") {
    // Transition workflow to cancelled/no-action state
    await db
      .from("recovery_workflows")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    await db.from("audit_logs").insert({
      workflow_id: workflowId,
      event_type: "workflow_completed",
      actor: "system",
      input: { reason: "policy_rejection" },
      output: { status: "cancelled", policy_reason: policyResult.reason },
    });

    return {
      success: false,
      policyApproved: false,
      reason: policyResult.reason,
    };
  }

  // 3. Idempotency Guard: Ensure we don't repeat action execution
  const { data: existingAction, error: actionQueryError } = await db
    .from("recovery_actions")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("action_type", policyResult.approvedAction)
    .maybeSingle();

  if (actionQueryError) {
    throw new Error(`Failed to query existing actions: ${actionQueryError.message}`);
  }

  if (existingAction) {
    if (existingAction.status === "succeeded") {
      // Transition parent workflow to completed if it isn't already
      await db
        .from("recovery_workflows")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", workflowId);

      return {
        success: true,
        actionId: existingAction.id,
        policyApproved: true,
        reason: "Idempotency: Action already executed successfully.",
        providerMessageId: existingAction.provider_message_id,
      };
    }
    if (existingAction.status === "executing") {
      return {
        success: false,
        actionId: existingAction.id,
        policyApproved: true,
        reason: "Idempotency: Action is currently in execution.",
      };
    }
  }

  // 4. Create Recovery Action entry and update workflow status to executing
  const { data: action, error: actionInsertError } = await db
    .from("recovery_actions")
    .insert({
      workflow_id: workflowId,
      action_type: policyResult.approvedAction,
      status: "executing",
      executed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (actionInsertError || !action) {
    throw new Error(`Failed to initialize recovery action record: ${actionInsertError?.message}`);
  }

  await db
    .from("recovery_workflows")
    .update({
      status: "executing",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", workflowId);

  // 5. Retrieve the LLM customer intent from audit log (if available)
  const { data: aiAuditLog } = await db
    .from("audit_logs")
    .select("output")
    .eq("workflow_id", workflowId)
    .eq("event_type", "ai_analysis_completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const messageIntent = aiAuditLog?.output?.customer_message_intent || null;

  // 6. Execute action dispatch
  console.log(`Executing recovery action ${action.id} of type ${action.action_type}...`);
  const emailResult = await sendRecoveryEmail({
    customer,
    subscription,
    paymentEvent,
    messageIntent,
  });

  if (emailResult.success) {
    // 7. Update Action & Workflow to succeeded/completed
    await db
      .from("recovery_actions")
      .update({
        status: "succeeded",
        provider_message_id: emailResult.providerMessageId || null,
        payload: { email_html: emailResult.rawContent },
      })
      .eq("id", action.id);

    await db
      .from("recovery_workflows")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    // Audit logs
    await db.from("audit_logs").insert([
      {
        workflow_id: workflowId,
        event_type: "action_executed",
        actor: "system",
        input: { action_id: action.id, type: action.action_type },
        output: { success: true, message_id: emailResult.providerMessageId },
      },
      {
        workflow_id: workflowId,
        event_type: "workflow_completed",
        actor: "system",
        input: { outcome: "completed" },
        output: { success: true, reason: "automated_action_executed_successfully" },
      },
    ]);

    // Update risk status to in_recovery since email went out
    await db
      .from("revenue_risks")
      .update({ status: "in_recovery", updated_at: new Date().toISOString() })
      .eq("id", workflow.revenue_risk_id);

    return {
      success: true,
      actionId: action.id,
      policyApproved: true,
      reason: "Action executed and workflow completed successfully.",
      providerMessageId: emailResult.providerMessageId,
    };
  } else {
    // 8. Update Action & Workflow to failed
    await db
      .from("recovery_actions")
      .update({
        status: "failed",
        error_message: emailResult.errorMessage || "Email dispatch failed.",
      })
      .eq("id", action.id);

    await db
      .from("recovery_workflows")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    await db.from("audit_logs").insert([
      {
        workflow_id: workflowId,
        event_type: "action_failed",
        actor: "system",
        input: { action_id: action.id, type: action.action_type },
        output: { error: emailResult.errorMessage },
      },
      {
        workflow_id: workflowId,
        event_type: "workflow_completed",
        actor: "system",
        input: { outcome: "failed" },
        output: { success: false, reason: emailResult.errorMessage },
      },
    ]);

    return {
      success: false,
      actionId: action.id,
      policyApproved: true,
      reason: `Action execution failed: ${emailResult.errorMessage}`,
    };
  }
}
