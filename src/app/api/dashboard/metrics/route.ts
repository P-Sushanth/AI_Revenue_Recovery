import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDbClient(true); // Bypass RLS as system runner

    // 1. Fetch Revenue Risks (with Customer and Subscription details)
    const { data: risksData, error: risksError } = await db
      .from("revenue_risks")
      .select(`
        *,
        customer:customers(name, email, country),
        subscription:subscriptions(plan_name, amount, status),
        payment_event:payment_events(provider, failure_code, failure_message, attempt_number)
      `)
      .order("created_at", { ascending: false });

    if (risksError) {
      throw new Error(`Failed to fetch revenue risks: ${risksError.message}`);
    }

    const risks = risksData || [];

    // 2. Fetch Workflows (for status lists and details)
    const { data: workflowsData, error: wfError } = await db
      .from("recovery_workflows")
      .select("*");

    if (wfError) {
      throw new Error(`Failed to fetch workflows: ${wfError.message}`);
    }

    const workflows = workflowsData || [];

    // 3. Compute KPI Metrics
    let revenueAtRisk = 0;
    let recoveredRevenue = 0;
    let lostRevenue = 0;
    let recoverableRevenue = 0;

    risks.forEach((risk: any) => {
      const amount = Number(risk.amount_at_risk);
      if (risk.status === "open" || risk.status === "in_recovery") {
        revenueAtRisk += amount;
        // Weighted recoverable calculation: amount * (recoverability_score / 100)
        recoverableRevenue += amount * (risk.recoverability_score / 100);
      } else if (risk.status === "recovered") {
        recoveredRevenue += amount;
      } else if (risk.status === "lost") {
        lostRevenue += amount;
      }
    });

    const activeWorkflowsCount = workflows.filter((w: any) =>
      ["pending", "analyzing", "awaiting_approval", "executing"].includes(w.status)
    ).length;

    // Recovery Rate = recovered_revenue / (recovered_revenue + revenue_at_risk + lost_revenue)
    const totalRepresented = recoveredRevenue + revenueAtRisk + lostRevenue;
    const recoveryRate = totalRepresented > 0 ? (recoveredRevenue / totalRepresented) * 100 : 0;

    // 4. Fetch Recent Audit Logs for Dashboard Timeline Activity
    const { data: recentAudits, error: auditError } = await db
      .from("audit_logs")
      .select(`
        *,
        workflow:recovery_workflows(
          id,
          customer:customers(name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (auditError) {
      throw new Error(`Failed to fetch recent audit logs: ${auditError.message}`);
    }

    // 5. Group failure reasons for analytics chart
    const failureGroups: Record<string, number> = {};
    risks.forEach((risk: any) => {
      const code = risk.payment_event?.failure_code || "unknown";
      failureGroups[code] = (failureGroups[code] || 0) + 1;
    });
    const failureChartData = Object.entries(failureGroups).map(([name, value]) => ({
      name: name.replace(/_/g, " ").toUpperCase(),
      value,
    }));

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          revenueAtRisk,
          recoverableRevenue: Math.round(recoverableRevenue),
          recoveredRevenue,
          activeWorkflows: activeWorkflowsCount,
          recoveryRate: Math.round(recoveryRate * 10) / 10,
        },
        risks,
        recentActivity: recentAudits || [],
        failureChartData,
      },
    });
  } catch (error: any) {
    console.error("Dashboard metrics API failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "METRICS_FETCH_FAILED",
          message: error.message || "An unexpected error occurred while fetching dashboard metrics.",
        },
      },
      { status: 500 }
    );
  }
}
