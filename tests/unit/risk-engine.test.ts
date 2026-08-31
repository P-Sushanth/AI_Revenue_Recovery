import { describe, it, expect } from "vitest";
import { analyzePaymentRisk, classifyRiskLevel } from "@/lib/risk/risk-engine";
import { Customer, Subscription, PaymentEvent } from "@/lib/schemas/database";

describe("Risk Engine Calculations", () => {
  // Common mocks
  const mockCustomer: Customer = {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test Customer",
    email: "test@example.com",
    currency: "INR",
    country: "IN",
  };

  const mockActiveSubscription: Subscription = {
    id: "sub_111",
    customer_id: mockCustomer.id!,
    plan_name: "Pro",
    amount: 2499.00,
    currency: "INR",
    status: "active",
    billing_interval: "month",
  };

  const mockCancelledSubscription: Subscription = {
    ...mockActiveSubscription,
    status: "cancelled",
  };

  describe("classifyRiskLevel", () => {
    it("should classify correct levels based on score thresholds", () => {
      expect(classifyRiskLevel(10)).toBe("low");
      expect(classifyRiskLevel(24)).toBe("low");
      expect(classifyRiskLevel(25)).toBe("medium");
      expect(classifyRiskLevel(49)).toBe("medium");
      expect(classifyRiskLevel(50)).toBe("high");
      expect(classifyRiskLevel(74)).toBe("high");
      expect(classifyRiskLevel(75)).toBe("critical");
      expect(classifyRiskLevel(100)).toBe("critical");
    });
  });

  describe("Customer A Scenario (Alex)", () => {
    it("should compute correct scores for Customer A (expired card, active, history)", () => {
      const paymentEvent: PaymentEvent = {
        id: "evt_alex",
        customer_id: mockCustomer.id!,
        subscription_id: mockActiveSubscription.id!,
        provider: "razorpay",
        external_event_id: "evt_1",
        amount: 2499.00,
        currency: "INR",
        status: "failed",
        failure_code: "expired_card",
        failure_message: "Expired card",
        attempt_number: 1,
        occurred_at: new Date(),
      };

      // 8 successful history events
      const historicalPayments: PaymentEvent[] = Array.from({ length: 8 }, (_, i) => ({
        id: `evt_hist_${i}`,
        customer_id: mockCustomer.id!,
        subscription_id: mockActiveSubscription.id!,
        provider: "razorpay",
        external_event_id: `evt_hist_ext_${i}`,
        amount: 2499.00,
        currency: "INR",
        status: "succeeded",
        attempt_number: 1,
        occurred_at: new Date(),
      }));

      const result = analyzePaymentRisk(
        paymentEvent,
        { customer: mockCustomer, historicalPayments },
        { subscription: mockActiveSubscription }
      );

      // Risk score:
      // Base payment failed = +40
      // Active subscription = +10
      // Successful history = +10
      // Expired card (action required) = +15
      // Total = 75 (Critical)
      expect(result.riskScore).toBe(75);
      expect(result.riskLevel).toBe("critical");

      // Recoverability score:
      // Base = 50
      // Successful history = +20
      // Active sub = +15
      // Total = 85
      expect(result.recoverabilityScore).toBe(85);
    });
  });

  describe("Customer B Scenario (Sarah)", () => {
    it("should compute correct scores for Customer B (insufficient funds, active, history)", () => {
      const paymentEvent: PaymentEvent = {
        id: "evt_sarah",
        customer_id: mockCustomer.id!,
        subscription_id: mockActiveSubscription.id!,
        provider: "razorpay",
        external_event_id: "evt_2",
        amount: 7999.00,
        currency: "INR",
        status: "failed",
        failure_code: "insufficient_funds",
        attempt_number: 1,
        occurred_at: new Date(),
      };

      // 12 successful history events
      const historicalPayments: PaymentEvent[] = Array.from({ length: 12 }, (_, i) => ({
        id: `evt_hist_${i}`,
        customer_id: mockCustomer.id!,
        subscription_id: mockActiveSubscription.id!,
        provider: "razorpay",
        external_event_id: `evt_hist_ext_${i}`,
        amount: 7999.00,
        currency: "INR",
        status: "succeeded",
        attempt_number: 1,
        occurred_at: new Date(),
      }));

      const result = analyzePaymentRisk(
        paymentEvent,
        { customer: mockCustomer, historicalPayments },
        { subscription: mockActiveSubscription }
      );

      // Risk score:
      // Base payment failed = +40
      // Active subscription = +10
      // Successful history = +10
      // Insufficient funds (likely temporary) = +10
      // Total = 70 (High)
      expect(result.riskScore).toBe(70);
      expect(result.riskLevel).toBe("high");

      // Recoverability score:
      // Base = 50
      // Successful history = +20
      // Active sub = +15
      // Temporary failure = +10
      // Total = 95
      expect(result.recoverabilityScore).toBe(95);
    });
  });

  describe("Customer C Scenario (John)", () => {
    it("should compute correct scores for Customer C (unknown, active, no history)", () => {
      const paymentEvent: PaymentEvent = {
        id: "evt_john",
        customer_id: mockCustomer.id!,
        subscription_id: mockActiveSubscription.id!,
        provider: "razorpay",
        external_event_id: "evt_3",
        amount: 499.00,
        currency: "INR",
        status: "failed",
        failure_code: "unknown",
        attempt_number: 1,
        occurred_at: new Date(),
      };

      // John has no historical successful payments (just this failed one)
      const historicalPayments: PaymentEvent[] = [paymentEvent];

      const result = analyzePaymentRisk(
        paymentEvent,
        { customer: mockCustomer, historicalPayments },
        { subscription: mockActiveSubscription }
      );

      // Risk score:
      // Base payment failed = +40
      // Active subscription = +10
      // No successful history = +0
      // Unknown code = +0
      // Total = 50 (High)
      expect(result.riskScore).toBe(50);
      expect(result.riskLevel).toBe("high");

      // Recoverability score:
      // Base = 50
      // No successful history = +0
      // Active sub = +15
      // Total = 65
      expect(result.recoverabilityScore).toBe(65);
    });
  });

  describe("Customer D Scenario (Maya)", () => {
    it("should compute correct scores for Customer D (attempt 4, active, consecutive failures)", () => {
      const paymentEvent: PaymentEvent = {
        id: "evt_maya_4",
        customer_id: mockCustomer.id!,
        subscription_id: mockActiveSubscription.id!,
        provider: "razorpay",
        external_event_id: "evt_maya_4",
        amount: 2499.00,
        currency: "INR",
        status: "failed",
        failure_code: "card_declined",
        attempt_number: 4,
        occurred_at: new Date(),
      };

      // 4 failures in history (including current)
      const historicalPayments: PaymentEvent[] = Array.from({ length: 4 }, (_, i) => ({
        id: `evt_maya_${i + 1}`,
        customer_id: mockCustomer.id!,
        subscription_id: mockActiveSubscription.id!,
        provider: "razorpay",
        external_event_id: `evt_maya_ext_${i + 1}`,
        amount: 2499.00,
        currency: "INR",
        status: "failed",
        failure_code: "card_declined",
        attempt_number: i + 1,
        occurred_at: new Date(),
      }));

      const result = analyzePaymentRisk(
        paymentEvent,
        { customer: mockCustomer, historicalPayments },
        { subscription: mockActiveSubscription }
      );

      // Risk score:
      // Base payment failed = +40
      // Attempt 4 = +30 (additional attempts = 3 * 10)
      // Active subscription = +10
      // Repeated recent failures (excluding current) = +10 (we have 3 past failures)
      // Card declined = +0
      // Total = 90 (Critical)
      expect(result.riskScore).toBe(90);
      expect(result.riskLevel).toBe("critical");

      // Recoverability score:
      // Base = 50
      // Active subscription = +15
      // Total failures (4) >= 3 = -20
      // Total = 45
      expect(result.recoverabilityScore).toBe(45);
    });
  });

  describe("Customer E Scenario (Daniel)", () => {
    it("should compute correct scores for Customer E (cancelled subscription)", () => {
      const paymentEvent: PaymentEvent = {
        id: "evt_daniel",
        customer_id: mockCustomer.id!,
        subscription_id: mockCancelledSubscription.id!,
        provider: "razorpay",
        external_event_id: "evt_5",
        amount: 2499.00,
        currency: "INR",
        status: "failed",
        failure_code: "expired_card",
        attempt_number: 1,
        occurred_at: new Date(),
      };

      const historicalPayments: PaymentEvent[] = [];

      const result = analyzePaymentRisk(
        paymentEvent,
        { customer: mockCustomer, historicalPayments },
        { subscription: mockCancelledSubscription }
      );

      // Risk score:
      // Base payment failed = +40
      // Subscription not active = +0
      // Expired card = +15
      // Total = 55 (High)
      expect(result.riskScore).toBe(55);

      // Recoverability score:
      // Base = 50
      // Cancelled subscription = -30
      // Total = 20
      expect(result.recoverabilityScore).toBe(20);
    });
  });

  describe("Score Clamping", () => {
    it("should clamp risk score to a maximum of 100", () => {
      const paymentEvent: PaymentEvent = {
        id: "evt_extreme",
        customer_id: mockCustomer.id!,
        subscription_id: mockActiveSubscription.id!,
        provider: "razorpay",
        external_event_id: "evt_ext",
        amount: 1000.00,
        currency: "INR",
        status: "failed",
        failure_code: "expired_card",
        attempt_number: 10, // Extreme attempts -> +90 points
        occurred_at: new Date(),
      };

      const historicalPayments: PaymentEvent[] = [
        { ...paymentEvent, status: "failed", attempt_number: 1 },
      ];

      const result = analyzePaymentRisk(
        paymentEvent,
        { customer: mockCustomer, historicalPayments },
        { subscription: mockActiveSubscription }
      );

      expect(result.riskScore).toBe(100);
    });

    it("should clamp recoverability score between 0 and 100", () => {
      const paymentEvent: PaymentEvent = {
        id: "evt_daniel",
        customer_id: mockCustomer.id!,
        subscription_id: mockCancelledSubscription.id!,
        provider: "razorpay",
        external_event_id: "evt_5",
        amount: 2499.00,
        currency: "INR",
        status: "failed",
        failure_code: "card_declined",
        attempt_number: 4,
        occurred_at: new Date(),
      };

      // 5 failed history events, cancelled subscription
      const historicalPayments: PaymentEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `evt_${i}`,
        customer_id: mockCustomer.id!,
        subscription_id: mockCancelledSubscription.id!,
        provider: "razorpay",
        external_event_id: `evt_ext_${i}`,
        amount: 2499.00,
        currency: "INR",
        status: "failed",
        failure_code: "card_declined",
        attempt_number: i + 1,
        occurred_at: new Date(),
      }));

      const result = analyzePaymentRisk(
        paymentEvent,
        { customer: mockCustomer, historicalPayments },
        { subscription: mockCancelledSubscription }
      );

      // Base = 50
      // Cancelled sub = -30
      // Total failures >= 3 = -20
      // Expected = 0
      expect(result.recoverabilityScore).toBe(0);
    });
  });
});
