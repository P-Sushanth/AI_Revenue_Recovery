import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDbClient(true); // Bypass RLS as system runner

    const { data: risksData, error: risksError } = await db
      .from("revenue_risks")
      .select(`
        *,
        customer:customers(
          name, 
          email, 
          country,
          payment_events(id, amount, status, failure_code, attempt_number, occurred_at)
        ),
        subscription:subscriptions(plan_name, amount, status),
        payment_event:payment_events(provider, failure_code, failure_message, attempt_number),
        workflows:recovery_workflows(id, status, recommended_action, approved_action, action_status)
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

    // 3. Fetch Payments Data (for time-series trend)
    const { data: paymentsData, error: paymentsError } = await db
      .from("payment_events")
      .select("amount, status, occurred_at")
      .order("occurred_at", { ascending: true });

    if (paymentsError) {
      throw new Error(`Failed to fetch payments data: ${paymentsError.message}`);
    }

    const payments = paymentsData || [];

    // 4. Compute KPI Metrics
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

    // 5. Fetch Recent Audit Logs for Dashboard Timeline Activity
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

    // 6. Group failure reasons for analytics chart
    const failureGroups: Record<string, number> = {};
    risks.forEach((risk: any) => {
      const code = risk.payment_event?.failure_code || "unknown";
      failureGroups[code] = (failureGroups[code] || 0) + 1;
    });
    const failureChartData = Object.entries(failureGroups).map(([name, value]) => ({
      name: name.replace(/_/g, " ").toUpperCase(),
      value,
    }));

    // 7. Group historical payments by month for time-series trend chart
    const monthlyGroups: Record<string, { date: string; monthLabel: string; recovered: number; atRisk: number }> = {};
    payments.forEach((payment: any) => {
      const dateObj = new Date(payment.occurred_at || new Date());
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const groupKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      const monthLabel = dateObj.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      
      if (!monthlyGroups[groupKey]) {
        monthlyGroups[groupKey] = {
          date: `${year}-${String(month + 1).padStart(2, "0")}-01`,
          monthLabel,
          recovered: 0,
          atRisk: 0,
        };
      }
      
      const amount = Number(payment.amount);
      if (payment.status === "succeeded") {
        monthlyGroups[groupKey].recovered += amount;
      } else if (payment.status === "failed") {
        monthlyGroups[groupKey].atRisk += amount;
      }
    });
    const trendChartData = Object.values(monthlyGroups).sort((a, b) => a.date.localeCompare(b.date));

    // 8. Group active risks by risk level
    const riskLevelGroups = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    risks.forEach((risk: any) => {
      const lvl = (risk.risk_level || "low").toLowerCase() as keyof typeof riskLevelGroups;
      if (lvl in riskLevelGroups) {
        riskLevelGroups[lvl] += 1;
      }
    });
    const riskDistributionData = Object.entries(riskLevelGroups).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
    }));

    // 9. Group workflow outcomes (recovered, in_recovery, failed)
    const outcomeGroups = {
      recovered: 0,
      in_recovery: 0,
      failed: 0,
    };
    risks.forEach((risk: any) => {
      if (risk.status === "recovered") {
        outcomeGroups.recovered += 1;
      } else if (risk.status === "open" || risk.status === "in_recovery") {
        outcomeGroups.in_recovery += 1;
      } else if (risk.status === "lost") {
        outcomeGroups.failed += 1;
      }
    });
    const recoveryOutcomesData = [
      { name: "Recovered", value: outcomeGroups.recovered, color: "#10b981" },
      { name: "In Recovery", value: outcomeGroups.in_recovery, color: "#a855f7" },
      { name: "Failed", value: outcomeGroups.failed, color: "#ef4444" },
    ];

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
        trendChartData,
        riskDistributionData,
        recoveryOutcomesData,
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
