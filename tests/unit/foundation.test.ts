import { describe, it, expect } from "vitest";
import { customerSchema } from "@/lib/schemas/database";

describe("Database Schema Validations", () => {
  it("should validate a correct customer payload", () => {
    const validCustomer = {
      name: "Alex",
      email: "alex@example.com",
      currency: "INR",
      country: "IN",
    };

    const parsed = customerSchema.safeParse(validCustomer);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Alex");
      expect(parsed.data.email).toBe("alex@example.com");
    }
  });

  it("should fail validation for an invalid email", () => {
    const invalidCustomer = {
      name: "Alex",
      email: "not-an-email",
      currency: "INR",
      country: "IN",
    };

    const parsed = customerSchema.safeParse(invalidCustomer);
    expect(parsed.success).toBe(false);
  });
});
