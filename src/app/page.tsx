"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Search,
  User,
  Mail,
  Zap,
  ShieldCheck,
  Check,
  X,
  ChevronRight,
  Database,
  ArrowUpRight,
  Info,
  BarChart3,
  Filter,
  Sparkles,
  Terminal,
  FileText,
  Send,
  Lock,
  MessageSquare,
  Bot,
} from "lucide-react";

// Bklit UI components
import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { XAxis } from "@/components/charts/x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";

interface DashboardData {
  metrics: {
    revenueAtRisk: number;
    recoverableRevenue: number;
    recoveredRevenue: number;
    activeWorkflows: number;
    recoveredWorkflows?: number;
    totalWorkflows?: number;
    recoveryRate: number;
  };
  risks: any[];
  recentActivity: any[];
  failureChartData: { name: string; value: number }[];
  trendChartData: { date: string; monthLabel: string; recovered: number; atRisk: number }[];
  riskDistributionData: { name: string; value: number }[];
  recoveryOutcomesData: { name: string; value: number; color?: string }[];
}

const getCustomerIdByCase = (c: string) => {
  switch (c) {
    case "alex": return "11111111-1111-1111-1111-111111111111";
    case "sarah": return "22222222-2222-2222-2222-222222222222";
    case "john": return "33333333-3333-3333-3333-333333333333";
    case "maya": return "44444444-4444-4444-4444-444444444444";
    case "daniel": return "55555555-5555-5555-5555-555555555555";
    case "clara": return "66666666-6666-6666-6666-666666666666";
    case "james": return "77777777-7777-7777-7777-888888888888";
    case "rohan": return "88888888-8888-8888-8888-888888888888";
    case "anita": return "99999999-9999-9999-9999-999999999999";
    default: return "11111111-1111-1111-1111-111111111111";
  }
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "amount" | "score" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selected Risk drawer
  const [selectedRisk, setSelectedRisk] = useState<any | null>(null);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

  // Seeding and Decline Simulation state
  const [seeding, setSeeding] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Guided Demo wizard timeline states
  const [demoStep, setDemoStep] = useState(0);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [policyRejected, setPolicyRejected] = useState(false);
  const [selectedCase, setSelectedCase] = useState("alex");

  // Preflight health check states
  const [ollamaReachable, setOllamaReachable] = useState<boolean | null>(null);
  const [modelInstalled, setModelInstalled] = useState<boolean | null>(null);
  const [targetModel, setTargetModel] = useState("qwen3.5:2b");
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [isHostedDemo, setIsHostedDemo] = useState(false);

  // Raw Bank Log AI Explainer state
  const [rawBankLog, setRawBankLog] = useState("");
  const [analyzingRawLog, setAnalyzingRawLog] = useState(false);
  const [rawAnalysisResult, setRawAnalysisResult] = useState<any>(null);
  const [rawAnalysisError, setRawAnalysisError] = useState<string | null>(null);

  const handleAnalyzeRawLog = async (logText?: string) => {
    const textToAnalyze = logText !== undefined ? logText : rawBankLog;
    if (!textToAnalyze.trim()) return;

    if (logText !== undefined) {
      setRawBankLog(logText);
    }

    setAnalyzingRawLog(true);
    setRawAnalysisError(null);

    try {
      const res = await fetch("/api/demo/analyze-raw-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawMessage: textToAnalyze }),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Analysis failed.");
      }
      setRawAnalysisResult(result.data);
    } catch (err: any) {
      setRawAnalysisError(err.message || "Failed to analyze raw bank log.");
    } finally {
      setAnalyzingRawLog(false);
    }
  };

  // Dynamic AI-Generated Email Preview Modal state
  const [emailDrawerOpen, setEmailDrawerOpen] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailData, setEmailData] = useState<any>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleOpenEmailPreview = async (workflowId?: string | null) => {
    let targetId = workflowId || currentWorkflowId;

    // If no workflow ID provided, fallback to first active workflow in table
    if (!targetId && data?.risks && data.risks.length > 0) {
      targetId = (data.risks[0] as any)?.workflows?.[0]?.id || null;
    }

    if (!targetId) {
      alert("Please run a demo simulation first or select a customer to preview their AI-generated recovery email.");
      return;
    }

    setEmailDrawerOpen(true);
    setEmailLoading(true);
    setEmailError(null);

    try {
      const result = await safeFetchJson(`/api/workflows/${targetId}/email-preview`);
      if (!result.success) {
        throw new Error(result.error?.message || result.error || "Failed to generate AI email preview.");
      }
      setEmailData(result.data);
    } catch (err: any) {
      setEmailError(err.message || "Failed to load AI email copy.");
    } finally {
      setEmailLoading(false);
    }
  };

  // Interactive "Ask the AI Billing Agent" Chat Drawer state
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [chatHistories, setChatHistories] = useState<Record<string, Array<{ role: "user" | "assistant"; content: string }>>>({});
  const [chatLoadingStates, setChatLoadingStates] = useState<Record<string, boolean>>({});
  const [chatWorkflowId, setChatWorkflowId] = useState<string | null>(null);
  const [chatCustomerName, setChatCustomerName] = useState<string>("");
  const [chatPlanName, setChatPlanName] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [chatModelUsed, setChatModelUsed] = useState<string>("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const pipelineLogsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pipelineLogsRef.current) {
      pipelineLogsRef.current.scrollTop = pipelineLogsRef.current.scrollHeight;
    }
  }, [simulationLogs]);

  const currentMessages = useMemo(() => {
    if (!chatWorkflowId) return [];
    return chatHistories[chatWorkflowId] || [];
  }, [chatHistories, chatWorkflowId]);

  const currentLoading = useMemo(() => {
    if (!chatWorkflowId) return false;
    return !!chatLoadingStates[chatWorkflowId];
  }, [chatLoadingStates, chatWorkflowId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentMessages, currentLoading]);

  const handleOpenAgentChat = async (workflowId?: string | null, customerName?: string, planName?: string) => {
    let targetId = workflowId || currentWorkflowId;

    if (!targetId && data?.risks && data.risks.length > 0) {
      const cleanSearch = (customerName || "").split("(")[0].trim().toLowerCase();
      const matchingRisk = data.risks.find((r: any) => r.customer?.name?.toLowerCase().includes(cleanSearch)) || data.risks[0];
      const wf = matchingRisk?.workflows;
      targetId = Array.isArray(wf) ? wf[0]?.id : (wf as any)?.id || null;
      customerName = customerName || matchingRisk?.customer?.name;
      planName = planName || matchingRisk?.subscription?.plan_name;
    }

    if (!targetId && data?.risks) {
      for (const r of data.risks) {
        const wf = (r as any).workflows;
        const id = Array.isArray(wf) ? wf[0]?.id : wf?.id;
        if (id) {
          targetId = id;
          break;
        }
      }
    }

    const cleanCustomerName = (customerName || "Customer").split("(")[0].trim();
    const cleanPlanName = (planName || "Pro").split("(")[0].trim();
    const key = targetId || "demo-workflow";

    setChatWorkflowId(key);
    setChatCustomerName(cleanCustomerName || "Customer");
    setChatPlanName(cleanPlanName || "Pro");
    setChatDrawerOpen(true);

    // Initialize isolated conversation history for this targetId if not present
    setChatHistories((prev) => {
      if (prev[key]) return prev;
      const greeting = `Hi! How can I assist with **${cleanCustomerName}**'s billing recovery today?`;
      return {
        ...prev,
        [key]: [{ role: "assistant", content: greeting }],
      };
    });
  };

  const handleSendChatMessage = async (promptOverride?: string) => {
    const textToSend = promptOverride !== undefined ? promptOverride : chatInput;
    const targetKey = chatWorkflowId;
    if (!textToSend.trim() || !targetKey || chatLoadingStates[targetKey]) return;

    const existingMessages = chatHistories[targetKey] || [];
    const updatedMessages = [...existingMessages, { role: "user" as const, content: textToSend }];

    // Isolated state update for this target customer workflow
    setChatHistories((prev) => ({
      ...prev,
      [targetKey]: updatedMessages,
    }));
    if (promptOverride === undefined) setChatInput("");

    setChatLoadingStates((prev) => ({
      ...prev,
      [targetKey]: true,
    }));

    try {
      const result = await safeFetchJson(`/api/workflows/${targetKey}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!result.success) {
        throw new Error(result.error?.message || result.error || "Failed to get response from AI Billing Agent.");
      }
      setChatHistories((prev) => ({
        ...prev,
        [targetKey]: [...(prev[targetKey] || updatedMessages), { role: "assistant", content: result.data.reply }],
      }));
      if (result.data.model_used) {
        setChatModelUsed(result.data.model_used);
      }
    } catch (err: any) {
      setChatHistories((prev) => ({
        ...prev,
        [targetKey]: [
          ...(prev[targetKey] || updatedMessages),
          { role: "assistant", content: `❌ Error communicating with AI Agent: ${err.message}` },
        ],
      }));
    } finally {
      setChatLoadingStates((prev) => ({
        ...prev,
        [targetKey]: false,
      }));
    }
  };

  const safeFetchJson = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      if (!text) {
        return { success: false, error: { message: `Server returned empty response (${res.status})` } };
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: false, error: { message: `Invalid JSON response from server (${res.status})` } };
      }
    } catch (err: any) {
      return { success: false, error: { message: err.message || "Network request failed" } };
    }
  };

  const checkSystemHealth = async () => {
    setCheckingHealth(true);
    try {
      const result = await safeFetchJson("/api/demo/health");
      if (result.success && result.health) {
        setOllamaReachable(result.health.reachable);
        setModelInstalled(result.health.modelAvailable);
        setTargetModel(result.health.model || "qwen3.5:2b");
        setIsHostedDemo(Boolean(result.health.isHostedDemo));
      } else {
        setOllamaReachable(false);
        setModelInstalled(false);
        setIsHostedDemo(false);
      }
    } catch (err) {
      setOllamaReachable(false);
      setModelInstalled(false);
      setIsHostedDemo(false);
    } finally {
      setCheckingHealth(false);
    }
  };

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await safeFetchJson("/api/dashboard/metrics");
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
    checkSystemHealth();
  }, []);

  // Polling for simulation recovery success
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (demoStep === 5 || demoStep === 6) {
      intervalId = setInterval(async () => {
        try {
          const result = await safeFetchJson("/api/dashboard/metrics");
          if (result.success && result.data) {
            setData(result.data);

            // Check if the current workflow is resolved
            const currentWorkflow = result.data.risks?.find(
              (r: any) => r.workflows?.[0]?.id === currentWorkflowId
            );

            if (currentWorkflow && currentWorkflow.status === "recovered") {
              setDemoStep(7); // Transition to success step
              if (intervalId) clearInterval(intervalId);
            }
          }
        } catch (err) {
          console.error("Error polling metrics:", err);
        }
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [demoStep, currentWorkflowId]);

  // Handle Seeding
  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      let result: any = null;
      try {
        const text = await res.text();
        result = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error(`Server returned status ${res.status}. Seeding operation may take a moment to complete. Please try refreshing.`);
      }

      if (result.success) {
        alert("Database seeded successfully with customer profiles!");
        setDemoStep(0);
        setSimulationLogs([]);
        setAiUnavailable(false);
        setPolicyRejected(false);
        fetchData(false);
      } else {
        alert("Seeding failed: " + (result.message || result.error?.message || "Unexpected error"));
      }
    } catch (err: any) {
      alert("Error seeding: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const getCaseLabel = (c: string) => {
    switch (c) {
      case "alex": return "Alex (Pro Plan ₹2499, Expired Card)";
      case "sarah": return "Sarah (Business Plan ₹7999, 3D-Secure Auth Required)";
      case "john": return "John (Starter Plan ₹499, Insufficient Funds)";
      case "maya": return "Maya (Pro Plan ₹2499, 4th Consecutive Failure)";
      case "daniel": return "Daniel (Pro Plan ₹2499, Cancelled Status)";
      case "clara": return "Clara (Pro Plan ₹1499, Paused - Processing Error)";
      case "james": return "James (Starter Plan ₹999, Cancelled - Card Declined)";
      default: return "Alex";
    }
  };

  // Run Guided Decline & Recovery Simulation
  const handleRunSimulation = async () => {
    setSimulating(true);
    setDemoStep(1);
    setAiUnavailable(false);
    setPolicyRejected(false);
    setSimulationLogs(["Initializing billing decline event trigger...", `Customer profile: ${getCaseLabel(selectedCase)}`]);

    try {
      // Step 1: Normalization
      await new Promise((resolve) => setTimeout(resolve, 800));
      setDemoStep(2);
      const codeMap: Record<string, string> = {
        sarah: "authentication_required",
        anita: "authentication_required",
        john: "insufficient_funds",
        clara: "processing_error",
        rohan: "processing_error",
        maya: "card_declined",
        james: "card_declined",
        daniel: "expired_card",
        alex: "expired_card",
      };
      const code = codeMap[selectedCase] || "expired_card";
      setSimulationLogs(prev => [...prev, `✓ Normalized Razorpay decline payload (${code})`, "Inserting risk analysis into database..."]);

      // Step 2: Risk Scoring
      await new Promise((resolve) => setTimeout(resolve, 800));
      setDemoStep(3);
      const scoreMap: Record<string, { score: string; index: string }> = {
        clara: { score: "40/100 (MEDIUM)", index: "85/100 (HIGH)" },
        james: { score: "30/100 (MEDIUM)", index: "40/100 (MEDIUM)" },
        john: { score: "60/100 (HIGH)", index: "50/100 (MEDIUM)" },
        maya: { score: "90/100 (CRITICAL)", index: "85/100 (HIGH)" },
        daniel: { score: "70/100 (HIGH)", index: "20/100 (LOW)" },
        rohan: { score: "20/100 (LOW)", index: "90/100 (HIGH)" },
        anita: { score: "80/100 (HIGH)", index: "75/100 (HIGH)" },
        sarah: { score: "50/100 (HIGH)", index: "80/100 (HIGH)" },
        alex: { score: "55/100 (HIGH)", index: "85/100 (HIGH)" },
      };
      const score = scoreMap[selectedCase]?.score || "55/100 (HIGH)";
      const index = scoreMap[selectedCase]?.index || "85/100 (HIGH)";
      setSimulationLogs(prev => [...prev, `✓ Risk score calculated: ${score}`, `✓ Recoverability index: ${index}`, "Workflow registered: STATUS PENDING"]);

      // Step 3: LLM / Heuristic Analysis (Calls /api/demo/simulate-loop)
      setSimulationLogs(prev => [
        ...prev,
        isHostedDemo
          ? "Invocating Autonomous AI Agent Diagnosis (Cloud Mode)..."
          : "Invocating local Ollama Qwen model... (Please wait)"
      ]);

      const res = await fetch(`/api/demo/simulate-loop?case=${selectedCase}`, { method: "POST" });
      let result: any = null;
      try {
        const text = await res.text();
        result = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error(`Server returned invalid response (Status ${res.status}). Local Ollama may have timed out loading the model into memory. Please retry.`);
      }

      if (result.success) {
        const step3 = result.step_3_local_ai_agent || {};
        const step4 = result.step_4_policy_and_executor || {};

        setSimulationLogs(prev => [
          ...prev,
          `✓ AI Diagnosis complete: "${step3.diagnosis || "Diagnosis generated"}"`,
          `✓ AI Recommendation: ${step3.recommended_action || "send_payment_recovery_email"} (Urgency: ${step3.urgency || "medium"})`,
          `✓ Policy Engine checked: ${step4.policy_allowed ? "ACTION AUTHORIZED" : "ACTION BLOCKED"}`,
          `✓ Action outcome: ${step4.action_executed || "None"} (${step4.action_status || "n/a"})`,
          step4.policy_allowed
            ? `✓ Email dispatched: CTA link encrypted server-side`
            : `ℹ Policy guardrail active: ${step4.execution_summary || "Intervention blocked per policy"}`,
          `✓ Workflow registered: ID ${step3.workflow_id || "active"}`
        ]);

        if (step3.workflow_id) {
          setCurrentWorkflowId(step3.workflow_id);
        }

        if (step4.action_status === "rejected" || !step4.policy_allowed) {
          setPolicyRejected(true);
          setDemoStep(4);
        } else {
          setDemoStep(5); // Transition to waiting for customer recovery
        }

        await fetchData(false);
      } else {
        const errorMsg = result.error?.message || result.message || "An unexpected error occurred.";
        const isOffline =
          errorMsg.toLowerCase().includes("ollama") ||
          errorMsg.toLowerCase().includes("fetch failed") ||
          errorMsg.toLowerCase().includes("econnrefused");

        if (isOffline) {
          setAiUnavailable(true);
          setSimulationLogs(prev => [...prev, "❌ AI Unavailable: Could not reach recovery model."]);
        } else {
          setSimulationLogs(prev => [...prev, `❌ Simulation Notice: ${errorMsg}`]);
        }
        setDemoStep(1);
      }
    } catch (err: any) {
      setSimulationLogs(prev => [...prev, `❌ Connection error: ${err.message || "Request failed"}`]);
      setDemoStep(1);
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
        setSelectedRisk((prev: any) => prev ? { ...prev, status: "recovered" } : null);
        fetchData(false);
        if (demoStep === 5 || demoStep === 6) {
          setDemoStep(7);
        } else {
          alert(`Success: ${result.message}`);
        }
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

  // Sorting handler
  const handleSort = (field: "name" | "amount" | "score") => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Filtering and Sorting logic
  let filteredRisks = data?.risks.filter(risk => {
    const nameMatch = risk.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = risk.customer?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const statusMatch = statusFilter === "all" || risk.status === statusFilter;
    const levelMatch = riskFilter === "all" || risk.risk_level === riskFilter;
    return (nameMatch || emailMatch) && statusMatch && levelMatch;
  }) || [];

  if (sortBy) {
    filteredRisks = [...filteredRisks].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      if (sortBy === "amount") {
        valA = Number(a.amount_at_risk || 0);
        valB = Number(b.amount_at_risk || 0);
      } else if (sortBy === "score") {
        valA = Number(a.risk_score || 0);
        valB = Number(b.risk_score || 0);
      } else if (sortBy === "name") {
        valA = a.customer?.name || "";
        valB = b.customer?.name || "";
      }

      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#F7F2EC] text-neutral-900 font-sans selection:bg-[#E2D4C5] selection:text-neutral-900 pb-16">

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-neutral-900 p-2.5 rounded-xl shadow-sm">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                RecoverAI
              </h1>
              <p className="text-xs text-neutral-500">Autonomous Billing Intervention & Risk Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedDatabase}
              disabled={seeding}
              aria-label="Reset simulation seeds"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 rounded-lg transition border border-neutral-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              <Database className="h-4 w-4" />
              {seeding ? "Resetting..." : "Reset Seeds"}
            </button>

            <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-1">
              <select
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
                disabled={simulating}
                aria-label="Select demo customer simulation case"
                className="bg-transparent text-xs font-semibold text-neutral-700 px-3 py-1.5 focus:outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="alex" className="bg-white text-neutral-800">Alex (Expired Card - Success)</option>
                <option value="sarah" className="bg-white text-neutral-800">Sarah (3DS Auth Needed - Success)</option>
                <option value="john" className="bg-white text-neutral-800">John (Policy Blocked)</option>
                <option value="maya" className="bg-white text-neutral-800">Maya (Multiple Declines - Success)</option>
                <option value="daniel" className="bg-white text-neutral-800">Daniel (Cancelled Sub - Policy Blocked)</option>
                <option value="clara" className="bg-white text-neutral-800">Clara (Paused - Medium Risk)</option>
                <option value="james" className="bg-white text-neutral-800">James (Cancelled - Medium Risk)</option>
                <option value="rohan" className="bg-white text-neutral-800">Rohan (Low Risk - ₹199 Basic)</option>
                <option value="anita" className="bg-white text-neutral-800">Anita (In Recovery - ₹12,499 Ent)</option>
              </select>
              <button
                onClick={handleRunSimulation}
                disabled={simulating}
                aria-label="Run demo recovery process"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white rounded transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                <Zap className="h-3.5 w-3.5" />
                {simulating ? "Processing..." : "Run Demo"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        {/* Hosted Demo Mode Notice for visitors who don't clone the repo */}
        {isHostedDemo && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-amber-900 text-sm">Cloud Demonstration Mode Active</span>
                <p className="text-neutral-600 text-xs mt-0.5 leading-relaxed">
                  Autonomous AI heuristics are enabled so you can run end-to-end simulations and test raw bank logs without cloning the repository or starting Ollama.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/90 border border-amber-200 px-2.5 py-1 rounded-lg">
                Zero Setup Required
              </span>
            </div>
          </div>
        )}

        {/* Offline & Fail warning Callouts (only when NOT in hosted demo mode) */}
        {!isHostedDemo && ollamaReachable === false && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex gap-4 text-rose-900">
            <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-rose-800">AI Service Reachability Error</h4>
              <p className="text-sm text-neutral-600 mt-1 leading-relaxed">
                Could not connect to the local Ollama API on <strong className="text-neutral-800">http://localhost:11434</strong>.
                Please start Ollama locally before running the simulation.
              </p>
              <button
                onClick={checkSystemHealth}
                disabled={checkingHealth}
                className="mt-3 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg border border-rose-200 transition disabled:opacity-50"
              >
                {checkingHealth ? "Re-checking..." : "Re-check Connection"}
              </button>
            </div>
          </div>
        )}

        {!isHostedDemo && ollamaReachable === true && modelInstalled === false && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex gap-4 text-amber-900">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-amber-800">AI Model Unavailable</h4>
              <p className="text-sm text-neutral-600 mt-1 leading-relaxed">
                Ollama is reachable, but the model <strong className="text-neutral-800">{targetModel}</strong> was not found.
                Please run <code className="font-mono text-neutral-800 bg-neutral-100 px-1 py-0.5 rounded border border-neutral-200">ollama pull {targetModel}</code> inside your command prompt to install it.
              </p>
              <button
                onClick={checkSystemHealth}
                disabled={checkingHealth}
                className="mt-3 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200 transition disabled:opacity-50"
              >
                {checkingHealth ? "Re-checking..." : "Re-check Connection"}
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Fallback if checking failed during simulation execution */}
        {aiUnavailable && ollamaReachable !== false && modelInstalled !== false && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex gap-4 text-rose-900">
            <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-rose-800">AI Diagnosis Failed</h4>
              <p className="text-sm text-neutral-600 mt-1 leading-relaxed">
                The local AI agent returned an error or timed out during the simulation run.
                Please verify that your Ollama server is running and responsive.
              </p>
            </div>
          </div>
        )}

        {policyRejected && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex gap-4 text-amber-900">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-800">Recovery Not Approved</h4>
              <p className="text-sm text-neutral-600 mt-1 leading-relaxed">
                The customer did not meet the recovery policy requirements (e.g., restricted country codes or inclusion bounds).
                No action was executed.
              </p>
            </div>
          </div>
        )}

        {/* Live Demo wizard checklist */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-900"></div>
          <div className="flex justify-between items-center mb-5 border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${demoStep > 0 ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"}`}></span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Live Demo Recovery Journey</h3>
            </div>
            {demoStep > 0 && (
              <button
                onClick={() => { setDemoStep(0); setSimulationLogs([]); }}
                className="text-neutral-400 hover:text-neutral-700 transition text-xs font-medium"
              >
                Clear Demo Run
              </button>
            )}
          </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Checklist details */}
              <div className="lg:col-span-3 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${demoStep >= 1 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                    }`}>
                    {demoStep >= 2 ? <Check className="h-3.5 w-3.5" /> : "1"}
                  </div>
                  <span className={`text-sm ${demoStep >= 1 ? "text-neutral-800 font-medium" : "text-neutral-400"}`}>
                    Decline event normalized and logged
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${demoStep >= 2 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                    }`}>
                    {demoStep >= 3 ? <Check className="h-3.5 w-3.5" /> : "2"}
                  </div>
                  <span className={`text-sm ${demoStep >= 2 ? "text-neutral-800 font-medium" : "text-neutral-400"}`}>
                    Risk score computed & registered
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${demoStep >= 3 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                    }`}>
                    {demoStep >= 4 ? <Check className="h-3.5 w-3.5" /> : "3"}
                  </div>
                  <span className={`text-sm ${demoStep >= 3 ? "text-neutral-800 font-medium" : "text-neutral-400"}`}>
                    {isHostedDemo ? "Autonomous Cloud AI Diagnosis complete" : "Local Ollama AI Diagnosis complete"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${demoStep >= 4 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                    }`}>
                    {demoStep >= 5 ? <Check className="h-3.5 w-3.5" /> : "4"}
                  </div>
                  <span className={`text-sm ${demoStep >= 4 ? "text-neutral-800 font-medium" : "text-neutral-400"}`}>
                    Safety recovery policy approved recommended action
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${demoStep >= 5 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                    }`}>
                    {demoStep >= 7 ? <Check className="h-3.5 w-3.5" /> : "5"}
                  </div>
                  <span className={`text-sm ${demoStep >= 5 ? "text-neutral-800 font-medium" : "text-neutral-400"}`}>
                    Intervention triggered: Recovery email dispatched to client
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${demoStep >= 7 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-100 text-neutral-500 border border-neutral-300 animate-pulse"
                    }`}>
                    {demoStep >= 7 ? <Check className="h-3.5 w-3.5" /> : "6"}
                  </div>
                  <span className={`text-sm ${demoStep >= 5 ? "text-neutral-800 font-medium" : "text-neutral-400"}`}>
                    {demoStep === 7 ? "Outcome: Payment recovered successfully" : "Outcome: Waiting for customer card update..."}
                  </span>
                </div>
              </div>

              {/* Interaction details */}
              <div className="lg:col-span-2 bg-neutral-50 border border-neutral-200 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                {demoStep === 0 ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 w-full">
                    <div className="h-12 w-12 rounded-2xl bg-neutral-100 text-neutral-500 flex items-center justify-center border border-neutral-200 shadow-2xs">
                      <Zap className="h-6 w-6 text-neutral-700" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-sm">Ready for Simulation</h4>
                      <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">
                        Select a customer scenario from the top bar and click <strong className="text-neutral-800">"Run Demo"</strong> to trigger autonomous recovery.
                      </p>
                    </div>
                  </div>
                ) : simulating || demoStep < 5 ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 w-full">
                    <div className="h-12 w-12 rounded-2xl bg-neutral-900 text-amber-400 flex items-center justify-center border border-neutral-800 shadow-sm">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-sm">AI Recovery Engine Executing...</h4>
                      <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">
                        Normalizing decline codes, scoring churn risk, and querying local LLM agent in real-time.
                      </p>
                    </div>
                    <div className="w-full bg-neutral-200/80 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-neutral-900 h-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, (demoStep / 5) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">Step {demoStep} of 5 in progress...</span>
                  </div>
                ) : demoStep < 7 ? (
                  <>
                    <Mail className="h-10 w-10 text-neutral-700 mb-3 animate-bounce" />
                    <h4 className="font-semibold text-neutral-800 text-sm">Customer Action Required</h4>
                    <p className="text-xs text-neutral-500 mt-2 max-w-sm leading-relaxed">
                      We sent a dunning recovery email with a secure link to update payment details.
                      Click below to open the portal and submit card details.
                    </p>
                    <a
                      href={`/update-payment?customer_id=${getCustomerIdByCase(selectedCase)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      Open Checkout Portal
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                    {currentWorkflowId && (
                      <>
                        <button
                          onClick={() => handleOpenEmailPreview(currentWorkflowId)}
                          className="mt-2 w-full py-2 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                          Preview AI-Generated Email Copy
                        </button>
                        <button
                          onClick={() => handleOpenAgentChat(currentWorkflowId, getCaseLabel(selectedCase), "Plan")}
                          className="mt-1.5 w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/70 rounded-lg text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Bot className="h-3.5 w-3.5 text-amber-700" />
                          Ask AI Billing Agent
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-12 w-12 text-emerald-600 mb-3" />
                    <h4 className="font-bold text-emerald-600 text-sm uppercase tracking-wider">Recovery Succeeded!</h4>
                    <strong className="text-neutral-900 text-2xl mt-1.5 font-bold">
                      {formatINR(selectedCase === "sarah" ? 7999 : selectedCase === "john" ? 499 : selectedCase === "clara" ? 1499 : selectedCase === "james" ? 999 : 2499)} Recovered
                    </strong>
                    <p className="text-xs text-neutral-500 mt-2 max-w-xs leading-relaxed">
                      Customer updated their billing info successfully.
                      The workflow has been set to <strong>Completed</strong> and subscription status is restored to <strong>Active</strong>.
                    </p>
                    <button
                      onClick={() => { setDemoStep(0); setSimulationLogs([]); }}
                      className="mt-4 px-4 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded text-xs transition"
                    >
                      Dismiss Demo Panel
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Terminal log panel */}
            <div className="mt-6 border-t border-neutral-100 pt-4 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Pipeline logs</span>
              <div ref={pipelineLogsRef} className="font-mono text-xs bg-neutral-50 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5 border border-neutral-200 custom-scrollbar text-neutral-600">
                {simulationLogs.length === 0 ? (
                  <div className="text-neutral-400 italic text-[11px]">[System] Ready for simulation trigger. Select scenario above and click "Run Demo".</div>
                ) : (
                  simulationLogs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-neutral-400">[{index + 1}]</span>
                      <span className={log.startsWith("✓") ? "text-emerald-600 font-medium" : log.startsWith("❌") ? "text-rose-600 font-medium" : ""}>
                        {log}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">

          {/* Card 1: Revenue at Risk */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 transition relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-3 text-neutral-100 group-hover:text-neutral-200 transition">
              <AlertTriangle className="h-12 w-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Revenue at Risk</p>
            {loading ? (
              <div className="h-8 bg-neutral-100 animate-pulse rounded w-24 mt-2"></div>
            ) : (
              <h3 className="text-3xl font-bold mt-2 text-amber-600">{formatINR(data?.metrics.revenueAtRisk || 0)}</h3>
            )}
            <p className="text-xs text-neutral-400 mt-1">Pending recovery interventions</p>
          </div>

          {/* Card 2: Recoverable */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 transition relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-3 text-neutral-100 group-hover:text-neutral-200 transition">
              <TrendingUp className="h-12 w-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Recoverable Revenue</p>
            {loading ? (
              <div className="h-8 bg-neutral-100 animate-pulse rounded w-24 mt-2"></div>
            ) : (
              <h3 className="text-3xl font-bold mt-2 text-blue-600">{formatINR(data?.metrics.recoverableRevenue || 0)}</h3>
            )}
            <p className="text-xs text-neutral-400 mt-1">Weighted by AI recoverability score</p>
          </div>

          {/* Card 3: Recovered */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 transition relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-3 text-neutral-100 group-hover:text-neutral-200 transition">
              <CheckCircle className="h-12 w-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Revenue Recovered</p>
            {loading ? (
              <div className="h-8 bg-neutral-100 animate-pulse rounded w-24 mt-2"></div>
            ) : (
              <h3 className="text-3xl font-bold mt-2 text-emerald-600">{formatINR(data?.metrics.recoveredRevenue || 0)}</h3>
            )}
            <p className="text-xs text-neutral-400 mt-1">Saved from billing failures</p>
          </div>

          {/* Card 4: Active Loops */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 transition relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-3 text-neutral-100 group-hover:text-neutral-200 transition">
              <Zap className="h-12 w-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Active Workflows</p>
            {loading ? (
              <div className="h-8 bg-neutral-100 animate-pulse rounded w-24 mt-2"></div>
            ) : (
              <h3 className="text-3xl font-bold mt-2 text-neutral-700">{data?.metrics.activeWorkflows}</h3>
            )}
            <p className="text-xs text-neutral-400 mt-1">Currently in-flight loops</p>
          </div>

          {/* Card 5: Recovery rate */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 transition relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-3 text-neutral-100 group-hover:text-neutral-200 transition">
              <ArrowUpRight className="h-12 w-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Recovery Rate</p>
            {loading ? (
              <div className="h-8 bg-neutral-100 animate-pulse rounded w-24 mt-2"></div>
            ) : (
              <h3 className="text-3xl font-bold mt-2 text-neutral-900">{data?.metrics.recoveryRate}%</h3>
            )}
            <p className="text-xs text-neutral-500 font-medium mt-1">
              {data?.metrics.recoveredWorkflows ?? 0} / {data?.metrics.totalWorkflows ?? 0} workflows recovered
            </p>
          </div>
        </div>

        {/* Time-Series Trend Chart (LineChart) */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-semibold text-neutral-800 text-sm uppercase tracking-wider">Revenue Recovery Over Time</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Chronological trends of recovered revenue vs. unresolved revenue at risk</p>
          </div>

          <div className="h-64 relative" role="region" aria-label="Line chart showing Revenue Recovery trends over time">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : data && data.trendChartData.length > 0 ? (
              <LineChart
                data={data.trendChartData}
                xDataKey="date"
                aspectRatio=""
                className="h-full"
                status={loading ? "loading" : "ready"}
              >
                <Grid horizontal strokeDasharray="4,4" stroke="rgba(255,255,255,0.06)" />
                <XAxis />
                <Line dataKey="recovered" stroke="#10b981" strokeWidth={3} />
                <Line dataKey="atRisk" stroke="#f59e0b" strokeWidth={3} />
                <ChartTooltip />
              </LineChart>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-600">
                No historical payment data available. Reset database seeds to populate.
              </div>
            )}
          </div>
        </div>

        {/* Two-Column charts: Risk Level (BarChart) and Outcomes (PieChart) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Risk Level Distribution (BarChart) */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="font-semibold text-neutral-800 text-sm uppercase tracking-wider">Risk Level Distribution</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Active customer accounts grouped by churn risk score level</p>
            </div>

            <div className="h-64 relative" role="region" aria-label="Bar chart showing Customer Risk Level distribution">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                  <RefreshCw className="h-8 w-8 animate-spin text-neutral-500" />
                </div>
              ) : data && data.riskDistributionData.length > 0 ? (
                <BarChart
                  data={data.riskDistributionData}
                  xDataKey="name"
                  aspectRatio=""
                  className="h-full"
                  status={loading ? "loading" : "ready"}
                >
                  <BarXAxis />
                  <Bar dataKey="value" fill="#171717" />
                  <ChartTooltip />
                </BarChart>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  No risk metrics recorded.
                </div>
              )}
            </div>
          </div>

          {/* Recovery Outcomes (PieChart) */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="font-semibold text-neutral-800 text-sm uppercase tracking-wider">Intervention Outcomes</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Current statuses of triggered automated interventions</p>
            </div>

            <div className="h-64 flex justify-center items-center relative" role="region" aria-label="Pie chart showing Recovery Intervention Outcomes">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                  <RefreshCw className="h-8 w-8 animate-spin text-neutral-500" />
                </div>
              ) : data && data.recoveryOutcomesData.length > 0 ? (
                <PieChart
                  data={data.recoveryOutcomesData.map(slice => ({
                    label: slice.name,
                    value: slice.value,
                    color: slice.color
                  }))}
                  innerRadius={60}
                  cornerRadius={4}
                  padAngle={0.02}
                  size={180}
                >
                  {data.recoveryOutcomesData.map((slice: any, index: number) => (
                    <PieSlice key={slice.name} index={index} color={slice.color} />
                  ))}
                  <PieCenter defaultLabel="Total Outcomes" />
                </PieChart>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  No recovery outcomes tracked.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Raw Bank Log AI Explainer (Live Demo Component) */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-neutral-900 p-2.5 rounded-xl text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-2">
                  Raw Bank Log AI Explainer
                  <span className="bg-neutral-100 text-neutral-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-neutral-200 uppercase">Interactive Playground</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Test how local Ollama AI interprets raw, unstructured, non-standardized bank decline text in real-time.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input column */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
                  Sample Raw Bank Decline Scenarios
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = "Transaction blocked by HDFC fraud system due to 24h international velocity cap";
                      setRawBankLog(text);
                      handleAnalyzeRawLog(text);
                    }}
                    className="text-left text-xs p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium transition flex items-center justify-between group"
                  >
                    <span className="truncate">HDFC Velocity Cap</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = "Processor error 05: Do Not Honor - Cardholder account frozen under RBI e-mandate regulatory check";
                      setRawBankLog(text);
                      handleAnalyzeRawLog(text);
                    }}
                    className="text-left text-xs p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium transition flex items-center justify-between group"
                  >
                    <span className="truncate">RBI E-Mandate Freeze</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = "Issuer decline: Merchant Category Code (MCC 5734) prohibited for recurring billing on debit card";
                      setRawBankLog(text);
                      handleAnalyzeRawLog(text);
                    }}
                    className="text-left text-xs p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium transition flex items-center justify-between group"
                  >
                    <span className="truncate">MCC Recurring Block</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = "Gateway returned Token Invalid: Card expiration date passed (08/26)";
                      setRawBankLog(text);
                      handleAnalyzeRawLog(text);
                    }}
                    className="text-left text-xs p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium transition flex items-center justify-between group"
                  >
                    <span className="truncate">Expired Card Token</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
                  Custom Raw Decline Log Input
                </label>
                <textarea
                  rows={3}
                  value={rawBankLog}
                  onChange={(e) => setRawBankLog(e.target.value)}
                  placeholder="Paste or type any raw processor/bank decline error message here..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAnalyzeRawLog()}
                disabled={analyzingRawLog || !rawBankLog.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
              >
                {analyzingRawLog ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Ollama Qwen AI Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze Raw Log with Ollama AI
                  </>
                )}
              </button>
            </div>

            {/* Result column */}
            <div className="lg:col-span-6 bg-neutral-50 border border-neutral-200 rounded-xl p-5 flex flex-col justify-between">
              {rawAnalysisError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-900 rounded-xl p-4 text-xs">
                  <strong className="font-bold text-rose-800 block mb-1">Analysis Error:</strong>
                  {rawAnalysisError}
                </div>
              )}

              {!rawAnalysisResult && !rawAnalysisError && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
                  <Terminal className="h-10 w-10 mb-3 text-neutral-300" />
                  <p className="text-xs font-medium text-neutral-500">No active log analyzed yet</p>
                  <p className="text-[11px] text-neutral-400 mt-1 max-w-xs leading-relaxed">
                    Click a preset scenario above or enter a custom raw bank decline message to run local AI diagnosis.
                  </p>
                </div>
              )}

              {rawAnalysisResult && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-neutral-200/60 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-neutral-700" />
                      AI Extracted Diagnosis
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                      Confidence: {rawAnalysisResult.confidence}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Extracted Technical Cause</span>
                    <p className="text-xs font-semibold text-neutral-800 mt-0.5 leading-relaxed">
                      {rawAnalysisResult.technical_root_cause}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Customer-Friendly Translation</span>
                    <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed bg-white border border-neutral-200 rounded-lg p-3">
                      "{rawAnalysisResult.customer_explanation}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Recommended Action</span>
                      <span className="inline-block mt-1 px-2.5 py-1 bg-neutral-900 text-white font-mono text-[10px] font-bold rounded-md">
                        {rawAnalysisResult.recommended_action}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Urgency Rating</span>
                      <span className="inline-block mt-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold rounded-md capitalize">
                        {rawAnalysisResult.urgency} Urgency
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* At-Risk Customers Table & Timeline logs */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Customer Table */}
          <div className="col-span-1 lg:col-span-3 space-y-6">

            {/* Filter Toolbar */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search customer email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition"
                />
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {/* Status selector */}
                <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-xl p-1">
                  <Filter className="h-3 w-3 text-neutral-400 ml-2" />
                  {["all", "open", "in_recovery", "recovered"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize transition ${statusFilter === st
                          ? "bg-white text-neutral-900 border border-neutral-200"
                          : "text-neutral-500 hover:text-neutral-900"
                        }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>

                {/* Risk Selector */}
                <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-xl p-1">
                  <BarChart3 className="h-3 w-3 text-neutral-400 ml-2" />
                  {["all", "critical", "high", "medium", "low"].map((rk) => (
                    <button
                      key={rk}
                      onClick={() => setRiskFilter(rk)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize transition ${riskFilter === rk
                          ? "bg-white text-neutral-900 border border-neutral-200"
                          : "text-neutral-500 hover:text-neutral-900"
                        }`}
                    >
                      {rk}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="font-semibold text-neutral-800 text-xs uppercase tracking-wider">At-Risk Customers & Workflows</h3>
                <button onClick={() => fetchData(false)} className="text-neutral-400 hover:text-neutral-700 transition">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/50 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-3 cursor-pointer select-none hover:text-neutral-900" onClick={() => handleSort("name")}>
                        Customer {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer select-none hover:text-neutral-900" onClick={() => handleSort("amount")}>
                        Amount at Risk {sortBy === "amount" && (sortOrder === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-neutral-900" onClick={() => handleSort("score")}>
                        Risk {sortBy === "score" && (sortOrder === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-4 py-3">AI Action</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs">
                    {loading ? (
                      [1, 2, 3].map((i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-4"><div className="h-4 bg-neutral-100 rounded w-28"></div></td>
                          <td className="px-4 py-4 text-right"><div className="h-4 bg-neutral-100 rounded w-14 ml-auto"></div></td>
                          <td className="px-4 py-4 text-center"><div className="h-4 bg-neutral-100 rounded w-12 mx-auto"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-neutral-100 rounded w-24"></div></td>
                          <td className="px-4 py-4 text-right"><div className="h-4 bg-neutral-100 rounded w-16 ml-auto"></div></td>
                        </tr>
                      ))
                    ) : filteredRisks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-neutral-400 font-medium">
                          No matching revenue risks found. Click "Run Recovery Demo" to trigger a simulation.
                        </td>
                      </tr>
                    ) : (
                      filteredRisks.map((risk) => (
                        <tr
                          key={risk.id}
                          onClick={() => setSelectedRisk(risk)}
                          className="hover:bg-neutral-50/60 cursor-pointer transition group border-b border-neutral-100 last:border-b-0"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="bg-neutral-100 h-7 w-7 rounded-full flex items-center justify-center text-neutral-500 border border-neutral-200/50 shrink-0">
                                <User className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-neutral-900 group-hover:text-neutral-900 transition truncate">
                                  {risk.customer?.name}
                                </h4>
                                <p className="text-[10px] text-neutral-500 truncate">
                                  {risk.subscription?.plan_name} Plan • {risk.payment_event?.failure_code?.replace(/_/g, " ") || "failed"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-neutral-900 whitespace-nowrap">
                            {formatINR(risk.amount_at_risk)}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${risk.risk_level === "critical"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : risk.risk_level === "high"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : risk.risk_level === "medium"
                                      ? "bg-amber-50/70 text-amber-800 border border-amber-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                            >
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {risk.risk_score} - {risk.risk_level}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-neutral-700 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] font-medium text-neutral-800 bg-neutral-100 border border-neutral-200/60 px-2 py-0.5 rounded">
                                {risk.workflows?.[0]?.recommended_action === "send_payment_recovery_email" || (risk.workflows as any)?.recommended_action === "send_payment_recovery_email"
                                  ? "Send Recovery Email"
                                  : risk.workflows?.[0]?.recommended_action === "no_action" || (risk.workflows as any)?.recommended_action === "no_action"
                                  ? "No Action"
                                  : "Pending AI"}
                              </span>
                              {(() => {
                                const wfId = Array.isArray(risk.workflows) ? risk.workflows[0]?.id : (risk.workflows as any)?.id || null;
                                return (
                                  <>
                                    {wfId && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEmailPreview(wfId);
                                        }}
                                        title="Preview AI-Generated Email Copy"
                                        className="p-1 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/60 rounded transition inline-flex items-center"
                                      >
                                        <Mail className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAgentChat(wfId, risk.customer?.name, risk.subscription?.plan_name);
                                      }}
                                      title="Ask AI Billing Agent about this customer"
                                      className="p-1 text-amber-600 hover:text-amber-900 hover:bg-amber-100/60 rounded transition inline-flex items-center"
                                    >
                                      <Bot className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${risk.status === "recovered"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : risk.status === "in_recovery"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-neutral-50 text-neutral-700 border-neutral-200"
                                  }`}
                              >
                                {risk.status === "recovered" ? (
                                  <>
                                    <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                                    <span>Recovered</span>
                                  </>
                                ) : risk.status === "in_recovery" ? (
                                  <>
                                    <Mail className="h-3 w-3 shrink-0 text-purple-600" />
                                    <span>In Recovery</span>
                                  </>
                                ) : (
                                  <>
                                    <Info className="h-3 w-3 shrink-0 text-neutral-500" />
                                    <span className="capitalize">{risk.status}</span>
                                  </>
                                )}
                              </span>
                              <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600 group-hover:translate-x-0.5 transition shrink-0" />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Live Activity Timeline */}
          <div className="col-span-1 space-y-6">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-neutral-800 text-xs uppercase tracking-wider mb-4">Live System Logs</h3>
              <div className="space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar">
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex gap-3 pl-3 pb-3 border-l border-neutral-100">
                      <div className="h-3 bg-neutral-100 rounded w-16"></div>
                      <div className="h-3 bg-neutral-100 rounded w-24"></div>
                    </div>
                  ))
                ) : data?.recentActivity.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">No recent logs recorded.</p>
                ) : (
                  data?.recentActivity.map((log) => (
                    <div key={log.id} className="flex gap-3 text-xs border-l border-neutral-200 pl-3 pb-3 relative">
                      <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-neutral-200 border border-neutral-300"></div>
                      <div>
                        <p className="text-neutral-600 leading-relaxed">
                          <span className="font-semibold text-neutral-800">
                            {log.workflow?.customer?.name || "System"}
                          </span>
                          : <span className="capitalize text-neutral-700">{log.event_type.replace(/_/g, " ")}</span>
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-1">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Drawer: Detailed Workflow view */}
      {selectedRisk && (
        <div
          onClick={() => setSelectedRisk(null)}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex justify-end transition-opacity"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white border-l border-neutral-200 h-full overflow-y-auto flex flex-col relative shadow-2xl"
          >

            {/* Drawer Header */}
            <div className="p-6 border-b border-neutral-200 flex justify-between items-center bg-neutral-50/50">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Recovery Workflow details</span>
                <h2 className="text-lg font-bold text-neutral-900 mt-1">{selectedRisk.customer?.name}</h2>
              </div>
              <button
                onClick={() => setSelectedRisk(null)}
                className="text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1 text-xs text-neutral-700">

              {/* Account summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-xl">
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold tracking-wider">Subscription</span>
                  <strong className="text-neutral-900 mt-1 block">{selectedRisk.subscription?.plan_name} Plan</strong>
                  <span className="text-[10px] text-neutral-500 capitalize">{selectedRisk.subscription?.status} billing</span>
                </div>
                <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-xl">
                  <span className="text-[10px] text-neutral-500 block uppercase font-bold tracking-wider">Amount At Risk</span>
                  <strong className="text-neutral-900 mt-1 block text-lg font-mono">{formatINR(selectedRisk.amount_at_risk)}</strong>
                  <span className="text-[10px] text-neutral-500">First attempt decline</span>
                </div>
              </div>

              {/* AI Diagnosis Insights */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-neutral-100/50 text-neutral-700 rounded-bl-xl border-l border-b border-neutral-200">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex justify-between items-center mb-2 pr-8">
                  <h4 className="font-semibold text-neutral-800 flex items-center gap-1.5">
                    <ShieldCheck className="h-4.5 w-4.5 text-neutral-700" />
                    AI Agent Intelligence
                  </h4>
                  {selectedRisk.workflows?.[0]?.id && (
                    <button
                      onClick={() => {
                        const wfId = Array.isArray(selectedRisk.workflows) ? selectedRisk.workflows[0]?.id : (selectedRisk.workflows as any)?.id || null;
                        handleOpenAgentChat(wfId, selectedRisk.customer?.name, selectedRisk.subscription?.plan_name);
                      }}
                      className="px-2 py-0.5 bg-amber-100/90 hover:bg-amber-200 text-amber-900 border border-amber-300/60 rounded font-semibold text-[10px] transition inline-flex items-center gap-1 shadow-2xs"
                    >
                      <Bot className="h-3 w-3 text-amber-700" />
                      <span>Ask AI Agent</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3 mt-4 text-xs text-neutral-600">
                  <div>
                    <span className="text-neutral-500 font-semibold text-[10px] uppercase tracking-wider block">Diagnosis Summary</span>
                    <p className="mt-1 text-neutral-800 font-medium leading-relaxed bg-white border border-neutral-200 rounded-lg p-2.5 text-xs">
                      {selectedRisk.reason}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase font-bold tracking-wider">Recoverability Index</span>
                      <strong className="text-emerald-600 text-sm">{selectedRisk.recoverability_score}/100</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase font-bold tracking-wider">Risk Category</span>
                      <strong className="text-rose-600 uppercase text-xs tracking-wider">{selectedRisk.risk_level}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Payment History */}
              <div className="space-y-2">
                <h4 className="font-semibold text-neutral-800">Customer Payment History</h4>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
                  {!selectedRisk.customer?.payment_events || selectedRisk.customer.payment_events.length === 0 ? (
                    <p className="text-neutral-400 text-center py-2">No historical payments recorded.</p>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                      {selectedRisk.customer.payment_events
                        .sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                        .map((event: any) => (
                          <div key={event.id} className="flex justify-between items-center text-xs py-1.5 border-b border-neutral-200/50 last:border-b-0">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${event.status === "succeeded"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                {event.status === "succeeded" ? "Success" : "Failed"}
                              </span>
                              <span className="font-mono font-semibold text-neutral-800">{formatINR(event.amount)}</span>
                              <span className="text-neutral-400 text-[10px] capitalize">
                                {event.failure_code ? `(${event.failure_code.replace(/_/g, " ")})` : ""}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400 font-medium">
                              {new Date(event.occurred_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Intervention Status Info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-neutral-800">Intervention Log</h4>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-medium text-xs">Action Status</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${selectedRisk.status === "recovered"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-neutral-50 text-neutral-700 border-neutral-200"
                      }`}>
                      {selectedRisk.status === "recovered" ? "Payment Recovered" : "Automated Recovery Mail Sent"}
                    </span>
                  </div>

                  <div className="border-t border-neutral-200/60 pt-2.5 flex justify-between items-center text-xs">
                    <span className="text-neutral-500">Trigger Type</span>
                    <span className="text-neutral-800 font-semibold">Dunning Email Intervention</span>
                  </div>

                  <div className="border-t border-neutral-200/60 pt-2.5 flex justify-between items-center text-xs">
                    <span className="text-neutral-500">Recipient Email</span>
                    <span className="text-neutral-800 font-mono font-medium">{selectedRisk.customer?.email}</span>
                  </div>
                </div>
              </div>

              {/* Simulation resolution panel */}
              {selectedRisk.status !== "recovered" && (
                <div className="bg-neutral-50/50 border border-dashed border-neutral-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Info className="h-4.5 w-4.5 text-neutral-400 shrink-0 mt-0.5" />
                    <p className="text-neutral-500 leading-relaxed">
                      Simulate a customer clicking the update-payment link inside their email, changing card details, and resolving the billing failure.
                    </p>
                  </div>

                  {selectedRisk.workflows?.[0]?.id && (
                    <button
                      onClick={() => handleOpenEmailPreview(selectedRisk.workflows[0].id)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg font-semibold text-xs transition shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      Preview AI-Generated Recovery Email
                    </button>
                  )}

                  <button
                    onClick={() => handleSimulateRecovery(selectedRisk.workflows?.[0]?.id)}
                    disabled={recoveringId !== null}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-semibold transition disabled:opacity-50"
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

      {/* AI-Generated Recovery Email Modal */}
      {emailDrawerOpen && (
        <div
          onClick={() => setEmailDrawerOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-neutral-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-[#FDFBF7]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200 shadow-sm shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm">AI-Generated Recovery Outreach</h3>
                  <p className="text-neutral-500 text-xs mt-0.5">
                    Synthesized by LLM tailored to customer LTV, plan tier, and failure reason.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEmailDrawerOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 bg-neutral-100 hover:bg-neutral-200 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs text-neutral-700 bg-neutral-50/40">
              {emailLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-neutral-500">
                  <RefreshCw className="h-8 w-8 text-neutral-700 animate-spin" />
                  <p className="font-medium text-sm text-neutral-700">Synthesizing personalized recovery email with AI...</p>
                  <p className="text-xs text-neutral-400">Analyzing customer profile, failure code, and psychographic tone.</p>
                </div>
              ) : emailError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-2">
                  <p className="font-semibold">Failed to generate AI email</p>
                  <p className="text-xs text-rose-600">{emailError}</p>
                </div>
              ) : emailData ? (
                <>
                  {/* AI Metadata & Audit Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">AI Model</span>
                      <span className="font-semibold text-neutral-800 text-[11px] mt-0.5 block truncate" title={emailData.model_used}>
                        {emailData.model_used}
                      </span>
                    </div>
                    <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Tone Persona</span>
                      <span className="font-semibold text-amber-800 text-[11px] mt-0.5 block truncate">
                        {emailData.tone}
                      </span>
                    </div>
                    <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Urgency Rating</span>
                      <span className={`font-semibold text-[11px] mt-0.5 block uppercase tracking-wider ${emailData.urgency_badge === "high" ? "text-rose-600" : emailData.urgency_badge === "medium" ? "text-amber-700" : "text-emerald-700"
                        }`}>
                        {emailData.urgency_badge} Priority
                      </span>
                    </div>
                    <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Data Privacy</span>
                      <span className="font-semibold text-emerald-700 text-[11px] mt-0.5 block truncate">
                        Zero PII Leaked
                      </span>
                    </div>
                  </div>

                  {/* Mock Email Client Container */}
                  <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                    {/* Email Headers */}
                    <div className="px-5 py-3.5 bg-neutral-50/80 border-b border-neutral-100 space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400 w-12 font-medium">From:</span>
                        <span className="font-medium text-neutral-800">
                          RecoverAI Billing Operations &lt;billing@recoverai.internal&gt;
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400 w-12 font-medium">To:</span>
                        <span className="font-mono text-neutral-700">
                          {emailData.customer_name} &lt;{emailData.customer_email}&gt;
                        </span>
                      </div>
                      <div className="flex items-start gap-2 pt-0.5">
                        <span className="text-neutral-400 w-12 font-medium shrink-0 mt-0.5">Subject:</span>
                        <strong className="text-neutral-900 font-semibold text-xs leading-snug">
                          {emailData.subject}
                        </strong>
                      </div>
                      {emailData.preview_text && (
                        <div className="flex items-start gap-2 text-[10px] text-neutral-500 pt-0.5">
                          <span className="w-12 text-neutral-400 shrink-0 font-medium">Snippet:</span>
                          <span className="italic">{emailData.preview_text}</span>
                        </div>
                      )}
                    </div>

                    {/* Email Message Content */}
                    <div className="p-6 space-y-4">
                      {/* Internal Email Header */}
                      <div className="border-b border-neutral-100 pb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-neutral-900 text-white flex items-center justify-center font-bold text-xs">
                            R
                          </div>
                          <span className="font-bold text-neutral-900 text-xs">Acme SaaS Billing</span>
                        </div>
                        <span className="text-[10px] text-neutral-400">
                          Plan: {emailData.plan_name} • {emailData.amount_formatted}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-neutral-900 leading-snug">
                        {emailData.headline}
                      </h4>

                      <div className="space-y-2.5 text-xs text-neutral-700 leading-relaxed">
                        {emailData.body_paragraphs?.map((paragraph: string, idx: number) => (
                          <p key={idx}>{paragraph}</p>
                        ))}
                      </div>

                      {/* CTA Button Mockup */}
                      <div className="pt-2 pb-1">
                        <button
                          type="button"
                          className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-2 transition"
                        >
                          <Lock className="h-3.5 w-3.5 text-neutral-300" />
                          <span>{emailData.call_to_action_label}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400" />
                        </button>
                      </div>

                      {/* Email Footer */}
                      <div className="border-t border-neutral-100 pt-3 text-[10px] text-neutral-400 flex items-center justify-between">
                        <span>Encrypted with TLS 1.3 • Tokenized one-time checkout link</span>
                        <span className="font-mono">Ref: {emailData.plan_name?.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-neutral-100 bg-white flex items-center justify-end">
              <button
                onClick={() => setEmailDrawerOpen(false)}
                className="px-4 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive "Ask the AI Billing Agent" Chat Drawer Modal */}
      {chatDrawerOpen && (
        <div
          onClick={() => setChatDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end transition-opacity animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white border-l border-neutral-200 h-full flex flex-col relative shadow-2xl overflow-hidden"
          >
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-neutral-200 flex justify-between items-center bg-[#FDFBF7]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-neutral-900 text-amber-400 flex items-center justify-center border border-neutral-800 shadow-sm shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">Ask AI Billing Agent</h2>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Live Dossier • {chatCustomerName} ({chatPlanName} plan)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChatDrawerOpen(false)}
                className="text-neutral-400 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preset Question Chips */}
            <div className="p-4 bg-neutral-50/60 border-b border-neutral-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                Suggested Strategic Inquiries
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSendChatMessage("Why was this recovery approved or blocked by policy?")}
                  className="text-[11px] bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 px-2.5 py-1 rounded-lg font-medium transition shadow-2xs text-left"
                >
                  "Why was this recovery approved or blocked by policy?"
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChatMessage("What is the best strategy to prevent this customer from churning?")}
                  className="text-[11px] bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 px-2.5 py-1 rounded-lg font-medium transition shadow-2xs text-left"
                >
                  "What is the best strategy to prevent churn?"
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChatMessage("Should we execute an immediate manual retry or wait?")}
                  className="text-[11px] bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 px-2.5 py-1 rounded-lg font-medium transition shadow-2xs text-left"
                >
                  "Should we execute a retry or wait?"
                </button>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs bg-white" ref={chatScrollRef}>
              {currentMessages.map((msg: { role: "user" | "assistant"; content: string }, idx: number) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-neutral-400">
                      <Bot className="h-3 w-3 text-amber-600" />
                      <span className="font-semibold text-neutral-800">AI Billing Agent</span>
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-neutral-900 text-white font-medium rounded-tr-none shadow-sm"
                        : "bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-tl-none shadow-2xs"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="space-y-2">
                        {msg.content.split("\n\n").map((para: string, pIdx: number) => (
                          <div key={pIdx} className="space-y-1">
                            {para.split("\n").map((line: string, lIdx: number) => {
                              const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
                              const cleanLine = isBullet ? line.trim().replace(/^[-•]\s*/, "") : line;
                              const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

                              return (
                                <p key={lIdx} className={isBullet ? "flex items-start gap-1.5 pl-2 text-neutral-700" : "text-neutral-800"}>
                                  {isBullet && <span className="text-neutral-400 font-bold shrink-0">•</span>}
                                  <span>
                                    {parts.map((part: string, partIdx: number) => {
                                      if (part.startsWith("**") && part.endsWith("**")) {
                                        return (
                                          <strong key={partIdx} className="font-bold text-neutral-900">
                                            {part.slice(2, -2)}
                                          </strong>
                                        );
                                      }
                                      return part;
                                    })}
                                  </span>
                                </p>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {currentLoading && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-neutral-400">
                    <Bot className="h-3 w-3 text-amber-600" />
                    <span className="font-semibold text-neutral-800">Thinking...</span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl rounded-tl-none p-3.5 text-xs text-neutral-500 flex items-center gap-2 shadow-2xs">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-neutral-600" />
                    <span>Analyzing billing context and policy engine constraints...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Footer Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="p-4 border-t border-neutral-200 bg-neutral-50/70 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Ask AI agent about ${chatCustomerName}'s billing issue or churn risk...`}
                disabled={currentLoading}
                className="flex-1 bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition shadow-2xs disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={currentLoading || !chatInput.trim()}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm shrink-0"
              >
                <span>Send</span>
                <Send className="h-3.5 w-3.5 text-amber-400" />
              </button>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
