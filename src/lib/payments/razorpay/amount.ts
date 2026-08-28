/**
 * Handles currency minor unit conversion for Razorpay (e.g. Paise to Rupees).
 * Decouples minor unit details from internal database values.
 */

/**
 * Converts Razorpay amount (paise) to Rupees.
 * @param paise Amount in minor currency units.
 * @returns Amount in base currency units.
 */
export function paiseToRupees(paise: number): number {
  if (paise < 0) {
    throw new Error("Razorpay amount cannot be negative");
  }
  return paise / 100;
}

/**
 * Converts Rupees to Razorpay amount (paise).
 * @param rupees Amount in base currency units.
 * @returns Amount in minor currency units.
 */
export function rupeesToPaise(rupees: number): number {
  if (rupees < 0) {
    throw new Error("Base currency amount cannot be negative");
  }
  return Math.round(rupees * 100);
}
