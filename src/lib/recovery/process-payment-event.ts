import { z } from "zod";
import { getDbClient } from "../db/client";
import { analyzePaymentRisk } from "../risk/risk-engine";
import {
  paymentStatusSchema,
  paymentFailureCodeSchema,
  PaymentEvent,
} from "../schemas/database";

// Schema for raw payload validation
export const rawPaymentEventSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  external_event_id: z.string().min(1, "External event ID is required"),
  customer_external_id: z.string().min(1, "Customer external ID is required"),
  subscription_external_id: z.string().nullable().optional(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().min(1).max(10),
  status: paymentStatusSchema,
  failure_code: paymentFailureCodeSchema.nullable().optional(),
  failure_message: z.string().nullable().optional(),
  attempt_number: z.number().int().nonnegative().default(1),
  occurred_at: z.string().datetime(), // Expect ISO datetime string
  raw_payload: z.record(z.string(), z.any()).nullable().optional(),
});

export type RawPaymentEvent = z.infer<typeof rawPaymentEventSchema>;

export interface ProcessEventResult {
  paymentEvent: PaymentEvent;
  isDuplicate: boolean;
  riskId?: string;
  workflowId?: string;
  resolvedWorkflowId?: string;
}

/**
 * Normalizes payment provider webhooks, enforces idempotency, evaluates risks,
 * and initiates or resolves recovery workflows.
 */
export async function processPaymentEvent(payload: unknown): Promise<ProcessEventResult> {
  const db = getDbClient(true); // Bypass RLS as system runner

  // 1. Validate payload
  const validated = rawPaymentEventSchema.parse(payload);

  // 2. Check Idempotency: Check if the event already exists
  const { data: existingEvent, error: findError } = await db
    .from("payment_events")
    .select("*")
    .eq("provider", validated.provider)
    .eq("external_event_id", validated.external_event_id)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to query event idempotency: ${findError.message}`);
  }

  if (existingEvent) {
    console.log(`Idempotency: Event ${validated.provider}/${validated.external_event_id} already processed.`);
    return {
      paymentEvent: {
        ...existingEvent,
        occurred_at: new Date(existingEvent.occurred_at),
        created_at: new Date(existingEvent.created_at),
      },
      isDuplicate: true,
    };
  }

  // 3. Look up Customer by external ID
  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("*")
    .eq("external_id", validated.customer_external_id)
    .maybeSingle();

  if (customerError || !customer) {
    throw new Error(`Customer with external ID ${validated.customer_external_id} not found.`);
  }

  // 4. Look up Subscription by external ID (if provided)
  let subscription = null;
  if (validated.subscription_external_id) {
    const { data: subData, error: subError } = await db
      .from("subscriptions")
      .select("*")
      .eq("external_id", validated.subscription_external_id)
      .maybeSingle();

    if (subError) {
      throw new Error(`Error looking up subscription: ${subError.message}`);
    }
    subscription = subData;
  }

  // 5. Store normalized payment event
  const normalizedEvent: Omit<PaymentEvent, "id" | "created_at"> = {
    customer_id: customer.id,
    subscription_id: subscription?.id || null,
    provider: validated.provider,
    external_event_id: validated.external_event_id,
    amount: validated.amount,
    currency: validated.currency,
    status: validated.status,
    failure_code: validated.failure_code || null,
    failure_message: validated.failure_message || null,
    attempt_number: validated.attempt_number,
    occurred_at: new Date(validated.occurred_at),
    raw_payload: validated.raw_payload || null,
  };

  const { data: insertedEvent, error: insertError } = await db
    .from("payment_events")
    .insert(normalizedEvent)
    .select()
    .single();

  if (insertError || !insertedEvent) {
    throw new Error(`Failed to insert normalized payment event: ${insertError?.message}`);
  }

  const paymentEvent: PaymentEvent = {
    ...insertedEvent,
    occurred_at: new Date(insertedEvent.occurred_at),
    created_at: new Date(insertedEvent.created_at),
  };

  // 6. Workflow Logic: Failed Payment -> Trigger Risk Evaluation & Workflow
  if (paymentEvent.status === "failed") {
    if (!subscription) {
      throw new Error("Cannot process a payment failure risk without an associated subscription.");
    }

    // Fetch historical payment events to calculate risk score properly
    const { data: history, error: historyError } = await db
      .from("payment_events")
      .select("*")
      .eq("customer_id", customer.id);

    if (historyError) {
      throw new Error(`Failed to fetch customer payment history: ${historyError.message}`);
    }

    const historicalPayments: PaymentEvent[] = (history || []).map((p) => ({
      ...p,
      occurred_at: new Date(p.occurred_at),
      created_at: new Date(p.created_at),
    }));

    // Run deterministic risk scoring
    const riskAnalysis = analyzePaymentRisk(
      paymentEvent,
      { customer, historicalPayments },
      { subscription }
    );

    // Save Revenue Risk
    const { data: risk, error: riskError } = await db
      .from("revenue_risks")
      .insert({
        customer_id: customer.id,
        subscription_id: subscription.id,
        payment_event_id: paymentEvent.id,
        amount_at_risk: riskAnalysis.amountAtRisk,
        risk_score: riskAnalysis.riskScore,
        risk_level: riskAnalysis.riskLevel,
        reason: riskAnalysis.reasons.join(" "),
        recoverability_score: riskAnalysis.recoverabilityScore,
        status: "open",
      })
      .select()
      .single();

    if (riskError || !risk) {
      throw new Error(`Failed to create revenue risk record: ${riskError?.message}`);
    }

    // Save Recovery Workflow
    const { data: workflow, error: workflowError } = await db
      .from("recovery_workflows")
      .insert({
        customer_id: customer.id,
        subscription_id: subscription.id,
        revenue_risk_id: risk.id,
        trigger_type: "payment_failure",
        status: "pending",
        risk_score: riskAnalysis.riskScore,
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      throw new Error(`Failed to create recovery workflow: ${workflowError?.message}`);
    }

    // Write Audit Log
    const { error: auditError } = await db.from("audit_logs").insert({
      workflow_id: workflow.id,
      event_type: "risk_detected",
      actor: "system",
      input: { payment_event_id: paymentEvent.id },
      output: {
        risk_id: risk.id,
        risk_score: risk.risk_score,
        risk_level: risk.risk_level,
        recoverability_score: risk.recoverability_score,
      },
    });

    if (auditError) {
      console.error("Failed to write system audit log:", auditError.message);
    }

    return {
      paymentEvent,
      isDuplicate: false,
      riskId: risk.id,
      workflowId: workflow.id,
    };
  }

  // 7. Workflow Logic: Succeeded Payment -> Resolve open risks/workflows
  if (paymentEvent.status === "succeeded" && subscription) {
    // Find open or in_recovery risks for this subscription
    const { data: activeRisks, error: activeError } = await db
      .from("revenue_risks")
      .select("id")
      .eq("subscription_id", subscription.id)
      .in("status", ["open", "in_recovery"]);

    if (activeError) {
      console.error("Failed to query active risks for resolution:", activeError.message);
    }

    let resolvedWorkflowId: string | undefined;

    if (activeRisks && activeRisks.length > 0) {
      const activeRiskIds = activeRisks.map((r) => r.id);

      // Resolve Risks
      await db
        .from("revenue_risks")
        .update({ status: "recovered", updated_at: new Date().toISOString() })
        .in("id", activeRiskIds);

      // Resolve Recovery Workflows
      const { data: workflows, error: updateError } = await db
        .from("recovery_workflows")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("revenue_risk_id", activeRiskIds)
        .select("id");

      if (updateError) {
        console.error("Failed to update active workflows:", updateError.message);
      }

      if (workflows && workflows.length > 0) {
        resolvedWorkflowId = workflows[0].id;

        // Write Audit Logs for resolution
        for (const wf of workflows) {
          await db.from("audit_logs").insert({
            workflow_id: wf.id,
            event_type: "workflow_completed",
            actor: "system",
            input: { payment_event_id: paymentEvent.id },
            output: { resolution: "payment_recovered_via_succeeded_event" },
          });
        }
      }
    }

    return {
      paymentEvent,
      isDuplicate: false,
      resolvedWorkflowId,
    };
  }

  return {
    paymentEvent,
    isDuplicate: false,
  };
}
