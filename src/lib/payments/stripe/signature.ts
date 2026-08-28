import crypto from "crypto";

/**
 * Cryptographically verifies Stripe webhook event signatures.
 * Employs constant-time buffer comparison to prevent timing attacks
 * and checks the timestamp tolerance to prevent replay attacks.
 * 
 * Stripe-Signature header format:
 * t=1492774577,v1=5257a869e4ece2229ad1b8d022b7b1e16b8c9d83d472654f8188711028522b1f
 * 
 * @param rawBody The unmodified, raw body text of the webhook request.
 * @param signatureHeader The value of the Stripe-Signature header.
 * @param secret The configured Stripe webhook signing secret.
 * @param toleranceSeconds Max allowed age of webhook in seconds (default 300 / 5 mins).
 * @returns boolean True if signature is valid.
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): boolean {
  if (!signatureHeader || !secret || !rawBody) {
    return false;
  }

  // 1. Extract t (timestamp) and v1 (signature) values from the header
  const parts = signatureHeader.split(",");
  let timestamp: string | null = null;
  let v1Signature: string | null = null;

  for (const part of parts) {
    const [key, val] = part.trim().split("=");
    if (key === "t") {
      timestamp = val;
    } else if (key === "v1") {
      v1Signature = val;
    }
  }

  if (!timestamp || !v1Signature) {
    return false;
  }

  // 2. Prevent replay attacks: check timestamp tolerance
  const eventTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);

  if (isNaN(eventTime) || Math.abs(currentTime - eventTime) > toleranceSeconds) {
    console.error(`Stripe Webhook verification failed: timestamp difference too large. currentTime=${currentTime}, eventTime=${eventTime}`);
    return false;
  }

  // 3. Compute the expected HMAC signature: timestamp + "." + rawBody
  const signedPayload = `${timestamp}.${rawBody}`;
  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // 4. Timing safe buffer comparison of hashes of the hex signatures
  const expectedBuffer = crypto
    .createHash("sha256")
    .update(computedSignature)
    .digest();

  const signatureBuffer = crypto
    .createHash("sha256")
    .update(v1Signature)
    .digest();

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
