"use client";

import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Search,
  User,
  CreditCard,
  Mail,
  Zap,
  ShieldCheck,
  Check,
  X,
  ChevronRight,
  Database,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface DashboardData {
  metrics: {
    revenueAtRisk: number;
    recoverableRevenue: number;
    recoveredRevenue: number;
    activeWorkflows: number;
    recoveryRate: number;
  };
  risks: any[];
  recentActivity: any[];
  failureChartData: { name: string; value: number }[];
}

const COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6"];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected Risk for Drawer Detail view
  const [selectedRisk, setSelectedRisk] = useState<any | null>(null);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

  // Seeding and Simulation Log states
  const [seeding, setSeeding] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/dashboard/metrics");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error?.message || "Failed to load metrics.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend server.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Scroll simulation logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [simulationLogs]);

  // Handle Seeding
  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        alert("Database seeded successfully with target customer profiles!");
        fetchData(false);
      } else {
        alert("Seeding failed: " + result.message);
      }
    } catch (err: any) {
      alert("Error seeding: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Run End-to-End Simulation
  const handleRunSimulation = async () => {
    setSimulating(true);
    setSimulationLogs(["Initializing billing decline event trigger...", "Customer profile: Alex (Active, Pro Plan ₹2499)"]);
    
    try {
      // Step 1: Normalization
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSimulationLogs(prev => [...prev, "✓ Normalized Stripe decline payload (expired_card)", "Inserting risk analysis into database..."]);

      // Step 2: Risk Scoring
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSimulationLogs(prev => [...prev, "✓ Risk score calculated: 75/100 (CRITICAL)", "✓ Recoverability index: 85/100 (HIGH)", "Workflow registered: STATUS PENDING"]);

      // Step 3: LLM Analysis (Calls /api/demo/simulate-loop)
      setSimulationLogs(prev => [...prev, "Invocating local Ollama Qwen model... (Please wait)"]);
      const res = await fetch("/api/demo/simulate-loop", { method: "POST" });
      const result = await res.json();

      if (result.success) {
        const step3 = result.step_3_local_ai_agent;
        const step4 = result.step_4_policy_and_executor;

        setSimulationLogs(prev => [
          ...prev,
          `✓ Local LLM analysis complete: "${step3.diagnosis}"`,
          `✓ AI Recommendation: ${step3.recommended_action} (Urgency: ${step3.urgency})`,
          `✓ Policy Engine checked: ACTION AUTHORIZED`,
          `✓ Action executed: ${step4.action_executed} (${step4.action_status})`,
          `✓ Email dispatched: CTA link encrypted server-side`,
          `✓ Workflow completed: ID ${step3.workflow_id}`
        ]);
        fetchData(false);
      } else {
        setSimulationLogs(prev => [...prev, `❌ AI Agent failed: ${result.error?.message || "Inference error."}`]);
      }
    } catch (err: any) {
      setSimulationLogs(prev => [...prev, `❌ Connection error: ${err.message}`]);
    } finally {
      setSimulating(false);
    }
  };

  // Simulate Customer recovering invoice (clicking update and paying)
  const handleSimulateRecovery = async (workflowId: string) => {
    if (!workflowId) return;
    setRecoveringId(workflowId);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/recover`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        // Refetch selected risk details to update drawer status
        const updatedRisks = data?.risks.map(r => {
          if (r.id === selectedRisk?.id) {
            return { ...r, status: "recovered" };
          }
          return r;
        }) || [];
        
        setSelectedRisk((prev: any) => prev ? { ...prev, status: "recovered" } : null);
        fetchData(false);
        alert(`Success: ${result.message}`);
      } else {
        alert("Recovery simulation failed: " + result.message);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setRecoveringId(null);
    }
  };

  // Format currency
  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Filter and Search Logic
  const filteredRisks = data?.risks.filter(risk => {
    const nameMatch = risk.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = risk.customer?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const statusMatch = statusFilter === "all" || risk.status === statusFilter;
    return (nameMatch || emailMatch) && statusMatch;
  }) || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-blue-600 selection:text-white pb-16">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                RecoverAI
              </h1>
              <p className="text-xs text-zinc-500">Autonomous Billing Intervention & Risk Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedDatabase}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition border border-zinc-700 disabled:opacity-50"
            >
              <Database className="h-4 w-4" />
              {seeding ? "Seeding..." : "Reset Seeds"}
            </button>

            <button
              onClick={handleRunSimulation}
              disabled={simulating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              {simulating ? "AI Processing..." : "Run Decline Simulation"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Simulation Output Terminal (Visible if simulating or logs exist) */}
        {(simulating || simulationLogs.length > 0) && (
          <div className="col-span-1 lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 animate-pulse"></div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Simulation Agent Engine logs</span>
              </div>
              <button 
                onClick={() => setSimulationLogs([])}
                className="text-zinc-500 hover:text-zinc-300 transition text-xs"
              >
                Clear Log
              </button>
            </div>
            <div className="font-mono text-sm bg-black/60 rounded-xl p-4 max-h-48 overflow-y-auto space-y-2 border border-zinc-800/80 custom-scrollbar text-zinc-300">
              {simulationLogs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-zinc-600">[{index + 1}]</span>
                  <span className={log.startsWith("✓") ? "text-emerald-400" : log.startsWith("❌") ? "text-rose-400" : ""}>
                    {log}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {error && (
          <div className="col-span-1 lg:col-span-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3 text-rose-200">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="col-span-1 lg:col-span-4 py-24 flex flex-col items-center justify-center gap-4 text-zinc-400">
            <RefreshCw className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm font-medium">Fetching database analytics...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="col-span-1 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              
              {/* Card 1: Revenue at Risk */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 text-zinc-800 group-hover:text-zinc-700 transition">
                  <AlertTriangle className="h-12 w-12" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Revenue at Risk</p>
                <h3 className="text-3xl font-bold mt-2 text-amber-500">{formatINR(data?.metrics.revenueAtRisk || 0)}</h3>
                <p className="text-xs text-zinc-500 mt-1">Pending recovery interventions</p>
              </div>

              {/* Card 2: Recoverable */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 text-zinc-800 group-hover:text-zinc-700 transition">
                  <TrendingUp className="h-12 w-12" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Recoverable Target</p>
                <h3 className="text-3xl font-bold mt-2 text-blue-500">{formatINR(data?.metrics.recoverableRevenue || 0)}</h3>
                <p className="text-xs text-zinc-500 mt-1">Weighted by AI recoverability score</p>
              </div>

              {/* Card 3: Recovered */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 text-zinc-800 group-hover:text-zinc-700 transition">
                  <CheckCircle className="h-12 w-12" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Recovered Revenue</p>
                <h3 className="text-3xl font-bold mt-2 text-emerald-500">{formatINR(data?.metrics.recoveredRevenue || 0)}</h3>
                <p className="text-xs text-zinc-500 mt-1">Saved from billing failures</p>
              </div>

              {/* Card 4: Active Loops */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 text-zinc-800 group-hover:text-zinc-700 transition">
                  <Zap className="h-12 w-12" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Active Workflows</p>
                <h3 className="text-3xl font-bold mt-2 text-purple-400">{data?.metrics.activeWorkflows}</h3>
                <p className="text-xs text-zinc-500 mt-1">Currently in-flight loops</p>
              </div>

              {/* Card 5: Recovery rate */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 text-zinc-800 group-hover:text-zinc-700 transition">
                  <ArrowUpRight className="h-12 w-12" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Recovery Rate</p>
                <h3 className="text-3xl font-bold mt-2 text-white">{data?.metrics.recoveryRate}%</h3>
                <p className="text-xs text-zinc-500 mt-1">Intervention efficiency score</p>
              </div>
            </div>

            {/* Datatable & Side Analytics Charts */}
            <div className="col-span-1 lg:col-span-3 space-y-6">
              
              {/* Filter controls */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  />
                </div>

                <div className="flex gap-1.5 w-full md:w-auto overflow-x-auto">
                  {["all", "open", "in_recovery", "recovered"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition shrink-0 ${
                        statusFilter === st
                          ? "bg-blue-600/10 border-blue-500 text-blue-400"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Card */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                  <h3 className="font-semibold text-zinc-200">Revenue Risks & Workflows</h3>
                  <button onClick={() => fetchData(false)} className="text-zinc-500 hover:text-white transition">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Subscription</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                        <th className="px-6 py-3 text-center">Risk Score</th>
                        <th className="px-6 py-3 text-center">Status</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-sm">
                      {filteredRisks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                            No matching revenue risks found. Click "Run Decline Simulation" to create one.
                          </td>
                        </tr>
                      ) : (
                        filteredRisks.map((risk) => (
                          <tr
                            key={risk.id}
                            onClick={() => setSelectedRisk(risk)}
                            className="hover:bg-zinc-800/30 cursor-pointer transition group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="bg-zinc-800 h-9 w-9 rounded-full flex items-center justify-center text-zinc-400 border border-zinc-700/50">
                                  <User className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-zinc-100 group-hover:text-blue-400 transition">
                                    {risk.customer?.name}
                                  </h4>
                                  <p className="text-xs text-zinc-500">{risk.customer?.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-zinc-300 font-medium">{risk.subscription?.plan_name}</div>
                              <div className="text-xs text-zinc-500 capitalize">{risk.payment_event?.failure_code?.replace(/_/g, " ")}</div>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-semibold text-zinc-200">
                              {formatINR(risk.amount_at_risk)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  risk.risk_level === "critical"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : risk.risk_level === "high"
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}
                              >
                                {risk.risk_score} — {risk.risk_level}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  risk.status === "recovered"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : risk.status === "in_recovery"
                                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                    : "bg-zinc-500/10 text-zinc-400 border border-zinc-700/20"
                                }`}
                              >
                                {risk.status === "in_recovery" ? "Email Sent" : risk.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar Charts & Info */}
            <div className="col-span-1 space-y-6">
              
              {/* Recharts Pie Chart representing failure reasons */}
              {data && data.failureChartData.length > 0 && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl">
                  <h3 className="font-semibold text-zinc-200 mb-4">Failures by Cause</h3>
                  <div className="h-48 flex justify-center items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.failureChartData}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {data.failureChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a" }}
                          itemStyle={{ color: "#f4f4f5" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    {data.failureChartData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-zinc-400">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></span>
                        <span className="truncate">{entry.name.toLowerCase()}</span>
                        <span className="font-bold text-zinc-200">({entry.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System Audit Timeline */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl">
                <h3 className="font-semibold text-zinc-200 mb-4">Live Activity</h3>
                <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                  {data?.recentActivity.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">No recent system logs.</p>
                  ) : (
                    data?.recentActivity.map((log) => (
                      <div key={log.id} className="flex gap-3 text-xs border-l border-zinc-800 pl-3 pb-3 relative">
                        <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-800 border border-zinc-700"></div>
                        <div>
                          <p className="text-zinc-400">
                            <span className="font-semibold text-zinc-200">
                              {log.workflow?.customer?.name || "System"}
                            </span>
                            : <span className="capitalize">{log.event_type.replace(/_/g, " ")}</span>
                          </p>
                          <p className="text-zinc-600 mt-0.5">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Drawer: Detailed Workflow view */}
      {selectedRisk && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
          <div className="w-full max-w-xl bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto flex flex-col relative shadow-2xl">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/30">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-500">Recovery Workflow details</span>
                <h2 className="text-lg font-bold text-zinc-100 mt-1">{selectedRisk.customer?.name}</h2>
              </div>
              <button
                onClick={() => setSelectedRisk(null)}
                className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1 text-sm text-zinc-300">
              
              {/* Account summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950/40 p-4 border border-zinc-800 rounded-xl">
                  <span className="text-xs text-zinc-500 block">Subscription</span>
                  <strong className="text-zinc-100 mt-1 block">{selectedRisk.subscription?.plan_name} Plan</strong>
                  <span className="text-xs text-zinc-500 capitalize">{selectedRisk.subscription?.status} billing</span>
                </div>
                <div className="bg-zinc-950/40 p-4 border border-zinc-800 rounded-xl">
                  <span className="text-xs text-zinc-500 block">Amount At Risk</span>
                  <strong className="text-zinc-100 mt-1 block text-lg">{formatINR(selectedRisk.amount_at_risk)}</strong>
                  <span className="text-xs text-zinc-500">First attempt decline</span>
                </div>
              </div>

              {/* AI Diagnosis Insights */}
              <div className="bg-gradient-to-tr from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-blue-500/5 text-blue-400 rounded-bl-xl border-l border-b border-zinc-800">
                  <Zap className="h-5 w-5" />
                </div>
                <h4 className="font-semibold text-zinc-200 flex items-center gap-1.5 mb-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-blue-400" />
                  Local AI Agent Diagnosis
                </h4>
                
                <div className="space-y-3 mt-4 text-xs text-zinc-400">
                  <div>
                    <span className="text-zinc-500 font-medium">Auto-Calculated Reason:</span>
                    <p className="mt-0.5 text-zinc-300 font-medium leading-relaxed">{selectedRisk.reason}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="text-zinc-500 block">Recoverability Index:</span>
                      <strong className="text-emerald-400 text-sm">{selectedRisk.recoverability_score}/100</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Risk Category:</span>
                      <strong className="text-rose-400 uppercase text-xs tracking-wider">{selectedRisk.risk_level}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Intervention Status Info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-zinc-200">Intervention Log</h4>
                <div className="bg-zinc-950/50 rounded-xl border border-zinc-800/80 p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedRisk.status === "recovered"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-purple-500/10 text-purple-400"
                    }`}>
                      {selectedRisk.status === "recovered" ? "Payment Recovered" : "Automated Recovery Mail Sent"}
                    </span>
                  </div>

                  <div className="border-t border-zinc-800/60 pt-3">
                    <span className="text-xs text-zinc-500">Intervention Trigger Type:</span>
                    <span className="text-xs text-zinc-300 block font-semibold mt-0.5">Automated Dunning Email Intervention (Simulated)</span>
                  </div>

                  <div className="border-t border-zinc-800/60 pt-3 flex gap-3 text-xs text-zinc-400">
                    <Mail className="h-5 w-5 text-zinc-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-zinc-300 block">Dunning Email Details</span>
                      <p className="mt-0.5 leading-relaxed">
                        A personalized billing recovery message was sent to <strong className="text-zinc-200">{selectedRisk.customer?.email}</strong> prompting card update with a secure, server-side CTA payment link.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation resolution panel */}
              {selectedRisk.status !== "recovered" && (
                <div className="bg-zinc-950/30 p-4 border border-dashed border-zinc-800 rounded-xl flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Info className="h-4.5 w-4.5 text-zinc-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Simulate a customer clicking the update-payment link inside their email, changing card details, and resolving the billing failure.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => handleSimulateRecovery(selectedRisk.id)}
                    disabled={recoveringId !== null}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    <Check className="h-4.5 w-4.5" />
                    {recoveringId ? "Saving..." : "Simulate Customer Payment Success"}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
