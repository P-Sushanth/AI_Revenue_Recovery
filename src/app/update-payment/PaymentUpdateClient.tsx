"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Lock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface PaymentUpdateClientProps {
  customer: {
    id: string;
    name: string;
    email: string;
  };
  subscription: {
    plan_name: string;
    amount: number;
    currency: string;
    status: string;
  } | null;
  workflow: {
    id: string;
    status: string;
    revenue_risk?: {
      payment_event?: {
        failure_message?: string;
        failure_code?: string;
      };
    };
  } | null;
}

export default function PaymentUpdateClient({
  customer,
  subscription,
  workflow,
}: PaymentUpdateClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [cardName, setCardName] = useState(customer.name || "");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 16);
    // Format card number with spaces (1234 5678 1234 5678)
    const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (value.length > 2) {
      setCardExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setCardExpiry(value);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardCvv(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflow?.id) {
      setError("No pending recovery workflow found for this account.");
      return;
    }

    if (!cardNumber || cardNumber.replace(/\s/g, "").length < 16) {
      setError("Please enter a valid 16-digit card number.");
      return;
    }

    if (!cardExpiry || cardExpiry.length < 5) {
      setError("Please enter a valid card expiry date (MM/YY).");
      return;
    }

    if (!cardCvv || cardCvv.length < 3) {
      setError("Please enter a valid 3 or 4-digit card CVV code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call simulated recovery endpoint to resolve subscription and complete the workflow
      const res = await fetch(`/api/workflows/${workflow.id}/recover`, {
        method: "POST",
      });
      const result = await res.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error?.message || "Failed to process card update. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "A connection network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hasActiveWorkflow = workflow && ["pending", "analyzing", "awaiting_approval", "executing", "failed"].includes(workflow.status);

  // If no subscription is configured or subscription is already cancelled
  if (!subscription) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">No Active Subscription</h1>
          <p className="text-zinc-400 text-sm mb-6">
            We could not find an active subscription associated with this account link.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold py-2.5 px-4 rounded-lg transition"
          >
            Return to Console
          </button>
        </div>
      </div>
    );
  }

  // Success view
  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-zinc-300 text-sm mb-6">
            Thank you, {customer.name}. Your payment method has been updated and the outstanding invoice of{" "}
            <strong className="text-zinc-100">{formatAmount(Number(subscription.amount), subscription.currency)}</strong> for your{" "}
            <strong className="text-zinc-100">{subscription.plan_name}</strong> plan has been processed successfully. Your subscription is active.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
          >
            Go to SaaS Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Already fully recovered view (No outstanding bills)
  if (!hasActiveWorkflow || subscription.status === "active") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold mb-2">Account Fully Paid</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Hi {customer.name}, your subscription plan <strong>{subscription.plan_name}</strong> is currently active and fully paid. No action is required.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold py-2.5 px-4 rounded-lg transition"
          >
            Go to SaaS Dashboard
          </button>
        </div>
      </div>
    );
  }

  const declineMessage = workflow?.revenue_risk?.payment_event?.failure_message || 
                         workflow?.revenue_risk?.payment_event?.failure_code?.replace(/_/g, " ") || 
                         "Card declined by issuing bank.";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col justify-center items-center p-6">
      {/* Brand Header */}
      <div className="flex items-center gap-2 mb-8 select-none">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
          R
        </div>
        <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
          RevRecovery Secure Portal
        </span>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Invoice details */}
        <div className="md:col-span-5 bg-zinc-900/40 backdrop-blur border border-zinc-800/80 rounded-2xl p-6 shadow-xl">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Invoice Summary</h2>
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100">{subscription.plan_name} Plan</h3>
              <p className="text-xs text-zinc-400 mt-1">{customer.name} ({customer.email})</p>
            </div>
            <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-2.5 py-1 rounded-full font-medium">
              Overdue
            </span>
          </div>

          <hr className="border-zinc-800 my-4" />

          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Subscription Cost</span>
              <span className="font-semibold">{formatAmount(Number(subscription.amount), subscription.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Total Due</span>
              <span className="text-lg font-bold text-zinc-50">{formatAmount(Number(subscription.amount), subscription.currency)}</span>
            </div>
          </div>

          <hr className="border-zinc-800 my-4" />

          {/* Decline Reason Banner */}
          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-red-400">Payment Failed</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed capitalize">{declineMessage}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Credit Card form */}
        <div className="md:col-span-7 bg-zinc-900/60 backdrop-blur border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
          
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-bold text-zinc-100">Secure Card Update</h2>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-sm flex gap-2 items-center">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="card-name" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Cardholder Name
              </label>
              <input
                id="card-name"
                type="text"
                required
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="card-number" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Card Number
              </label>
              <div className="relative">
                <input
                  id="card-number"
                  type="text"
                  required
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="0000 0000 0000 0000"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg py-2.5 pl-10 pr-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition font-mono"
                />
                <CreditCard className="w-4 h-4 text-zinc-600 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="card-expiry" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Expiry Date
                </label>
                <input
                  id="card-expiry"
                  type="text"
                  required
                  value={cardExpiry}
                  onChange={handleExpiryChange}
                  placeholder="MM/YY"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition font-mono text-center"
                />
              </div>

              <div>
                <label htmlFor="card-cvv" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  CVV / CVC
                </label>
                <input
                  id="card-cvv"
                  type="password"
                  required
                  value={cardCvv}
                  onChange={handleCvvChange}
                  placeholder="•••"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition font-mono text-center"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 text-sm mt-8 cursor-pointer select-none"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing Securely...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Update Details & Pay {formatAmount(Number(subscription.amount), subscription.currency)}
                </>
              )}
            </button>
          </form>

          {/* Secure details footer */}
          <div className="flex items-center gap-2 mt-6 justify-center">
            <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              PCI-DSS Compliant 256-Bit SSL Encryption
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
