import { Customer, Subscription, PaymentEvent } from "../schemas/database";

export interface EmailParams {
  customer: Pick<Customer, "email" | "name" | "id">;
  subscription: Pick<Subscription, "plan_name" | "amount" | "currency">;
  paymentEvent: Pick<PaymentEvent, "failure_code" | "failure_message" | "attempt_number">;
  messageIntent?: string | null;
}

export interface SendEmailResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  rawContent?: string;
}

/**
 * Generates and dispatches a billing recovery email.
 * Supports both simulated mode (for the demo) and Resend API.
 */
export async function sendRecoveryEmail(params: EmailParams): Promise<SendEmailResult> {
  const { customer, subscription, paymentEvent, messageIntent } = params;

  // 1. Control the billing-update link server-side (prevent LLM hallucinations)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Demo payment update page route (to be built on frontend)
  const paymentUpdateUrl = `${appUrl}/update-payment?customer_id=${customer.id}`;

  // 2. Format monetary details
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: subscription.currency || "INR",
  }).format(Number(subscription.amount));

  // 3. Draft HTML email content safely
  const emailHtml = `
    <div style="font-family: sans-serif; padding: 24px; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #111827; margin-bottom: 16px;">Action Required: Payment Update for your ${subscription.plan_name} Plan</h2>
      <p>Hello ${customer.name},</p>
      <p>We were unable to process your recurring subscription payment of <strong>${formattedAmount}</strong> for your <strong>${subscription.plan_name}</strong> subscription.</p>
      
      <p style="background-color: #f9fafb; padding: 12px; border-left: 4px solid #ef4444; border-radius: 4px; font-size: 14px;">
        <strong>Reason reported:</strong> ${paymentEvent.failure_message || paymentEvent.failure_code || "Transaction declined"}.
        ${messageIntent ? `<br/><em>Note: ${messageIntent}</em>` : ""}
      </p>

      <p>To keep your subscription active and avoid service disruptions, please update your payment method by clicking the link below:</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${paymentUpdateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Update Payment Method</a>
      </div>

      <p style="font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px;">
        If you have any questions or did not authorize this subscription, please reply directly to this email to contact our support team.
      </p>
    </div>
  `.trim();

  const provider = process.env.EMAIL_PROVIDER || "simulated";

  if (provider === "simulated") {
    console.log("=================================================");
    console.log(`[SIMULATED EMAIL SENDER] Sending recovery email to: ${customer.email}`);
    console.log(`[SIMULATED EMAIL SENDER] Subject: Action Required: Payment Update for ${subscription.plan_name}`);
    console.log(`[SIMULATED EMAIL SENDER] CTA Link: ${paymentUpdateUrl}`);
    console.log("=================================================");

    return {
      success: true,
      providerMessageId: `sim_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      rawContent: emailHtml,
    };
  }

  if (provider === "resend") {
    const resendApiKey = process.env.RESEND_API_KEY || "";
    if (!resendApiKey) {
      return {
        success: false,
        errorMessage: "Resend API key is missing. Set RESEND_API_KEY in environment variables.",
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Revenue Recovery <billing@yourdomain.com>", // In production, must be a verified domain
          to: customer.email,
          subject: `Action Required: Payment Update for ${subscription.plan_name}`,
          html: emailHtml,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          errorMessage: `Resend request failed (${response.status}): ${errText}`,
        };
      }

      const resData = await response.json();
      return {
        success: true,
        providerMessageId: resData.id,
        rawContent: emailHtml,
      };
    } catch (e: any) {
      return {
        success: false,
        errorMessage: e.message || "An unexpected error occurred during email transmission.",
      };
    }
  }

  return {
    success: false,
    errorMessage: `Unrecognized email provider configuration: "${provider}"`,
  };
}
