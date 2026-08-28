/**
 * Handles currency minor unit conversion for Stripe (e.g., Cents to Dollars/Rupees).
 * Decouples minor unit details from internal database values.
 */

/**
 * Converts Stripe minor unit amount (cents) to major unit currency.
 * @param cents Amount in cents/minor units.
 * @returns Amount in major currency units (e.g., dollars).
 */
export function centsToMajor(cents: number): number {
  if (cents < 0) {
    throw new Error("Stripe amount cannot be negative");
  }
  return cents / 100;
}

/**
 * Converts major unit currency to Stripe minor unit amount (cents).
 * @param amount Amount in major currency units.
 * @returns Amount in cents/minor units.
 */
export function majorToCents(amount: number): number {
  if (amount < 0) {
    throw new Error("Base currency amount cannot be negative");
  }
  return Math.round(amount * 100);
}
