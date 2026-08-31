import { getDbClient } from "@/lib/db/client";
import PaymentUpdateClient from "./PaymentUpdateClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ customer_id?: string }> | { customer_id?: string };
}

export default async function UpdatePaymentPage({ searchParams }: PageProps) {
  // Safe resolution of searchParams across Next.js versions (15+ searchParams is a Promise)
  const resolvedParams = searchParams && typeof (searchParams as any).then === "function"
    ? await searchParams
    : (searchParams as any);

  const customerId = resolvedParams?.customer_id;

  if (!customerId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <h1 className="text-xl font-bold text-red-500 mb-2">Error: Invalid Link</h1>
          <p className="text-zinc-400 text-sm">
            This payment update link is missing a valid customer identifier. Please check the URL in your email or contact support.
          </p>
        </div>
      </div>
    );
  }

  const db = getDbClient(true); // Server-side admin client to bypass RLS

  // 1. Fetch customer details
  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("id, name, email")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <h1 className="text-xl font-bold text-red-500 mb-2">Customer Not Found</h1>
          <p className="text-zinc-400 text-sm">
            We could not locate a customer profile matching the provided ID. Please verify the URL.
          </p>
        </div>
      </div>
    );
  }

  // 2. Fetch the latest subscription details
  const { data: subscription } = await db
    .from("subscriptions")
    .select("plan_name, amount, currency, status")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Fetch latest active/failed workflow details
  const { data: workflow } = await db
    .from("recovery_workflows")
    .select(`
      id,
      status,
      revenue_risk:revenue_risks(
        payment_event:payment_events(
          failure_code,
          failure_message
        )
      )
    `)
    .eq("customer_id", customer.id)
    .in("status", ["pending", "analyzing", "awaiting_approval", "executing", "failed", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <PaymentUpdateClient
      customer={customer}
      subscription={subscription}
      workflow={workflow as any}
    />
  );
}
