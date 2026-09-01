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

export const aiGeneratedEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  preview_text: z.string().min(1, "Preview text is required"),
  headline: z.string().min(1, "Headline is required"),
  body_paragraphs: z.array(z.string()).min(1, "At least one paragraph is required"),
  call_to_action_label: z.string().min(1, "Call to action is required"),
  tone: z.string().min(1, "Tone is required"),
  urgency_badge: z.enum(["low", "medium", "high"]),
});

export type AiGeneratedEmail = z.infer<typeof aiGeneratedEmailSchema>;
