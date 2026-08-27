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
