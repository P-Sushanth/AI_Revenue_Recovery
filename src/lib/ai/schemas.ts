import { z } from "zod";

export const aiRecommendationSchema = z.object({
  diagnosis: z.string().min(1, "Diagnosis is required"),
  reasoning_summary: z.string().min(1, "Reasoning summary is required"),
  recommended_action: z.enum(["send_payment_recovery_email", "no_action"]),
  urgency: z.enum(["low", "medium", "high"]),
  customer_message_intent: z.string().min(1, "Customer message intent is required"),
  confidence: z.enum(["low", "medium", "high"]),
});

export type AiRecommendation = z.infer<typeof aiRecommendationSchema>;

export const rawBankLogAnalysisSchema = z.object({
  raw_input: z.string(),
  technical_root_cause: z.string().min(1, "Technical root cause is required"),
  customer_explanation: z.string().min(1, "Customer explanation is required"),
  recommended_action: z.enum(["send_payment_recovery_email", "no_action"]),
  customer_message_intent: z.string().min(1, "Customer message intent is required"),
  urgency: z.enum(["low", "medium", "high"]),
  confidence: z.enum(["low", "medium", "high"]),
});

export type RawBankLogAnalysis = z.infer<typeof rawBankLogAnalysisSchema>;
