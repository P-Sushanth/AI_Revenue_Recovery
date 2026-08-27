import { z } from "zod";

// --- Base Type Validation Schemas ---

export const customerSchema = z.object({
  id: z.string().uuid().optional(),
  external_id: z.string().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  currency: z.string().min(1).max(10),
  country: z.string().min(1).max(10),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const subscriptionStatusSchema = z.enum(["active", "past_due", "cancelled", "paused"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  external_id: z.string().nullable().optional(),
  plan_name: z.string().min(1, "Plan name is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().min(1).max(10),
  status: subscriptionStatusSchema,
  billing_interval: z.string(),
  next_billing_date: z.date().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const paymentStatusSchema = z.enum(["succeeded", "failed", "pending"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentFailureCodeSchema = z.enum([
  "insufficient_funds",
  "expired_card",
  "card_declined",
  "authentication_required",
  "payment_method_invalid",
  "processing_error",
  "unknown",
]);
export type PaymentFailureCode = z.infer<typeof paymentFailureCodeSchema>;

export const paymentEventSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  subscription_id: z.string().uuid().nullable().optional(),
  provider: z.string(),
  external_event_id: z.string(),
  amount: z.number().positive(),
  currency: z.string().min(1).max(10),
  status: paymentStatusSchema,
  failure_code: paymentFailureCodeSchema.nullable().optional(),
  failure_message: z.string().nullable().optional(),
  attempt_number: z.number().int().nonnegative().default(1),
  occurred_at: z.date(),
  raw_payload: z.record(z.string(), z.any()).nullable().optional(),
  created_at: z.date().optional(),
});

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const riskStatusSchema = z.enum(["open", "in_recovery", "recovered", "lost", "dismissed"]);
export type RiskStatus = z.infer<typeof riskStatusSchema>;

export const revenueRiskSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  payment_event_id: z.string().uuid(),
  amount_at_risk: z.number().positive(),
  risk_score: z.number().int().min(0).max(100),
  risk_level: riskLevelSchema,
  reason: z.string(),
  recoverability_score: z.number().int().min(0).max(100),
  status: riskStatusSchema.default("open"),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const workflowStatusSchema = z.enum([
  "pending",
  "analyzing",
  "awaiting_approval",
  "executing",
  "completed",
  "failed",
  "cancelled",
]);
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const recoveryWorkflowSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  revenue_risk_id: z.string().uuid(),
  trigger_type: z.string(),
  status: workflowStatusSchema.default("pending"),
  risk_score: z.number().int().min(0).max(100),
  recommended_action: z.string().nullable().optional(),
  approved_action: z.string().nullable().optional(),
  action_status: z.string().nullable().optional(),
  started_at: z.date().nullable().optional(),
  completed_at: z.date().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const recoveryActionTypeSchema = z.enum(["send_payment_recovery_email"]);
export type RecoveryActionType = z.infer<typeof recoveryActionTypeSchema>;

export const recoveryActionSchema = z.object({
  id: z.string().uuid().optional(),
  workflow_id: z.string().uuid(),
  action_type: recoveryActionTypeSchema,
  payload: z.record(z.string(), z.any()).nullable().optional(),
  status: z.string(),
  provider_message_id: z.string().nullable().optional(),
  executed_at: z.date().nullable().optional(),
  error_message: z.string().nullable().optional(),
  created_at: z.date().optional(),
});

export const auditActorSchema = z.enum(["system", "llm", "user"]);
export type AuditActor = z.infer<typeof auditActorSchema>;

export const auditEventTypeSchema = z.enum([
  "risk_detected",
  "ai_analysis_completed",
  "policy_check_completed",
  "action_approved",
  "action_executed",
  "action_failed",
  "workflow_completed",
]);
export type AuditEventType = z.infer<typeof auditEventTypeSchema>;

export const auditLogSchema = z.object({
  id: z.string().uuid().optional(),
  workflow_id: z.string().uuid(),
  event_type: auditEventTypeSchema,
  actor: auditActorSchema,
  input: z.record(z.string(), z.any()).nullable().optional(),
  output: z.record(z.string(), z.any()).nullable().optional(),
  created_at: z.date().optional(),
});

// --- Inferred TypeScript Interfaces ---
export type Customer = z.infer<typeof customerSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type PaymentEvent = z.infer<typeof paymentEventSchema>;
export type RevenueRisk = z.infer<typeof revenueRiskSchema>;
export type RecoveryWorkflow = z.infer<typeof recoveryWorkflowSchema>;
export type RecoveryAction = z.infer<typeof recoveryActionSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
