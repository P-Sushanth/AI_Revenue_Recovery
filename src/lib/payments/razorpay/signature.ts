import crypto from "crypto";

/**
 * Cryptographically verifies Razorpay webhook event signatures.
 * Employs constant-time buffer comparison to prevent timing attacks.
 * 
 * @param rawBody The unmodified, raw body text of the webhook request.
 * @param signature The hex signature sent in the X-Razorpay-Signature header.
 * @param secret The configured Razorpay webhook secret.
 * @returns boolean True if signature is valid.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret || !rawBody) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // Safeguard timingSafeEqual: calculate equal-length hashes of both hex strings
  // to avoid runtime errors when comparing signature strings of differing lengths.
  const expectedBuffer = crypto
    .createHash("sha256")
    .update(expectedSignature)
    .digest();

  const signatureBuffer = crypto
    .createHash("sha256")
    .update(signature)
    .digest();

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
