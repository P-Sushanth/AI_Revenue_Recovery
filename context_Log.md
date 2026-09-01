# Context Log — AI Revenue Recovery Project

This document records the incremental progress, architecture decisions, and current implementation status of the AI Revenue Recovery system.

---

## 1. Project Overview & Objectives
The goal of this project is to build an end-to-end agentic AI Revenue Recovery system that:
1. Detects revenue at risk from failed subscription payments.
2. Diagnoses why the payment failed using a local LLM (`qwen3.5:9b` running via Ollama).
3. Recommends recovery actions bounded by deterministic policy guardrails.
4. Executes recovery interventions (sending simulated recovery emails).
5. Logs audit trails and measures outcomes on a visual dashboard.

---

## 2. Completed Milestones

### Phase 1: Project Foundation (Complete)
* **Git Initialization**: Empty git repository initialized.
* **Next.js 16 Bootstrap**: Bootstrapped Next.js App Router project with TypeScript, Tailwind CSS v4, and ESLint.
* **Directory Structure**: Established clean standard layout with `src/app`, `src/lib`, `src/components`, `supabase/`, and `tests/`.
* **Dependencies Configured**:
  * Core: `@supabase/supabase-js`, `zod`, `lucide-react`, `recharts`
  * Dev: `vitest`, `vite-tsconfig-paths`
* **Configuration Files**: Set up `tsconfig.json` paths and created [vitest.config.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/vitest.config.ts) for path alias resolution.
* **Environment Setup**: Created `.env.example` and configured `.env.local` pointing to the user's Supabase instance and local Ollama model (`qwen3.5:9b`).

### Phase 2: Database Schema & Client (Complete)
* **SQL Schema Migration**: Created database initialization script at [20260827000000_init_schema.sql](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/supabase/migrations/20260827000000_init_schema.sql). The user successfully ran this in their Supabase SQL editor.
  * *Tables Created*: `customers`, `subscriptions`, `payment_events`, `revenue_risks`, `recovery_workflows`, `recovery_actions`, `audit_logs`.
  * *Idempotency*: Set unique constraint on `payment_events(provider, external_event_id)`.
  * *Performance*: Added search indexes for metrics calculations and history lookups.
  * *Automatic Timestamps*: Trigger functions for updating `updated_at` columns on row modification.
* **Zod & TypeScript Definitions**: Implemented domain models and strict schema validations in [database.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/schemas/database.ts).
* **Supabase Client Utility**: Configured standard and server-only admin clients in [client.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/db/client.ts).

### Phase 3: Seeding & Demo Data Setup (Complete)
* **Seed Logic**: Implemented [demo-data.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/demo/demo-data.ts) to clean all records and seed 5 specific customer personas (Alex, Sarah, John, Maya, Daniel) with their respective subscriptions and historical payment event logs.
* **Seed API Endpoint**: Created a route handler at [route.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/demo/seed/route.ts) supporting GET/POST requests to `/api/demo/seed` to trigger database seeding.

### Phase 4: Deterministic Risk Engine (Complete)
* **Scoring Constants**: Extracted thresholds and weights into [constants.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/risk/constants.ts).
* **Deterministic Calculations**: Wrote core computations inside [risk-engine.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/risk/risk-engine.ts):
  * `calculateRiskScore`: Scored based on failure, attempts, history, active status, failure code surcharge. Capped at 100.
  * `calculateRecoverabilityScore`: Scored based on history, active status, failure code, and failure/cancellation penalties. Clamped between 0 and 100.
  * `classifyRiskLevel`: Returns `low`, `medium`, `high`, or `critical` risk level.
  * `analyzePaymentRisk`: Main orchestration returning complete risk analysis results.
* **Unit Testing**: Implemented [risk-engine.test.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/unit/risk-engine.test.ts) testing all 5 customer scenarios and boundary score clamping.

### Phase 5: Workflow Engine (Complete)
* **Event Normalization**: Implemented `processPaymentEvent` inside [process-payment-event.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/recovery/process-payment-event.ts) to parse raw provider payloads and save normalized payment events.
* **Idempotency Guard**: Added checks querying `(provider, external_event_id)` to filter duplicate deliveries instantly.
* **Auto-Resolution Flow**: Successful payments automatically transition related open risks to `recovered` and workflows to `completed`.
* **State Transition & Audit logging**: Kicks off a workflow state `pending` and logs a `risk_detected` audit entry on failed payments.
* **Simulation API**: Created Route Handler at [payment-failure/route.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/demo/payment-failure/route.ts) to simulate Stripe decline webhooks.

### Phase 6: AI Engine & Local LLM Integration (Complete)
* **AI Output Zod Schemas**: Created validation structures in [schemas.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/ai/schemas.ts).
* **Local Qwen Integration**: Implemented [recovery-agent.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/ai/recovery-agent.ts) performing Ollama API calls.
* **Safeguards**: Set system prompts demanding strict structural validation and stripping markdown blocks before JSON parsing.
* **Graceful Failure Fallbacks**: If parsing fails, workflow state goes to `failed` and system actor creates error audit logs.
* **Spy Fetch Mocking**: Designed dynamic integration test suites mock-intercepting only model APIs while letting Supabase DB queries pass.

### Phase 7: Policy Engine (Complete)
* **Deterministic Guardrails**: Implemented [recovery-policy.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/policies/recovery-policy.ts) restricting email dispatches based on active subscriptions, risk classification (medium/high/critical), and formatting presence.
* **Auto-Rejection Conditions**: Gracefully maps cancelled subscriptions or low-risk failures to `no_action`.
* **Logging System Verdicts**: Automatically writes `policy_check_completed` logs detailing rule parameters.

### Phase 8: Action Executor (Complete)
* **Execution Dispatcher**: Developed dispatcher inside [action-executor.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/recovery/action-executor.ts).
* **Simulated Billing Email Client**: Created HTML email dispatch generator in [recovery-email.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/email/recovery-email.ts) (with Resend API support).
* **Double Execution Blockers**: Added check querying active action execution status to prevent sending duplicate emails.

### Phase 9: Dashboard UI & Simulation panel (Complete)
* **Analytical API Metrics**: Created dynamic KPI statistics endpoint at [metrics/route.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/dashboard/metrics/route.ts).
* **Interactive Recovery Simulation**: Exposed Dynamic POST endpoint at [recover/route.ts](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/workflows/%5Bid%5D/recover/route.ts) to simulate payment updates.
* **SaaS Interface**: Replaced standard landing page in [page.tsx](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/page.tsx) with a dark theme console showcasing live KPI metrics, filterable datatable, analytics charts, audit timeline logs, and sidebar simulations.

### Phase 10: Razorpay Webhook Adapter (Complete)
* **Razorpay Webhook Adapter**: Created webhook handler endpoint at `src/app/api/webhooks/razorpay/route.ts` to receive production dispatches.
* **Cryptographic Signature Verification**: Implemented standard secure verification of Razorpay signatures in `src/lib/payments/razorpay/signature.ts`.
* **Event Normalization**: Standardized parsed events into provider-neutral `NormalizedPaymentEvent` format inside `src/lib/payments/razorpay/parser.ts`.
* **Integration Tests**: Added `/api/webhooks/razorpay` integration test suite to verify event creation and workflow transition behaviors.

### Phase 11: Razorpay Refactoring & Unit Tests (Complete)
* **Decoupled Module Structure**: Refactored Razorpay amount conversion, event parser, and signature verifier into clean sub-modules under `src/lib/payments/razorpay/`.
* **Type Abstractions**: Created payment types inside `src/lib/payments/types.ts`.
* **Comprehensive Unit Testing**: Added tests for signature checks, paise-rupee amount conversion, and JSON payload parsing under `tests/unit/razorpay/`.
* **Build Validation**: Verified code compiled and vitest completed 38/38 tests passing.

### Phase 12: Stripe Webhook Adapter & Customer Checkout Loop (Complete)
* **Stripe Webhook Integration**: Created webhook receiver route at `src/app/api/webhooks/stripe/route.ts` to process incoming Stripe payment notifications.
* **Cryptographic Signature Verification**: Implemented standard Stripe signature check manually inside `src/lib/payments/stripe/signature.ts` with replay-attack timestamp tolerance checks.
* **Event Normalization**: Developed a payload parser mapping Stripe events (`invoice.payment_failed` and `invoice.payment_succeeded`) into standard `NormalizedPaymentEvent` objects inside `src/lib/payments/stripe/parser.ts`.
* **Simulated Checkout Update Portal**: Created frontend server page `src/app/update-payment/page.tsx` and client component `PaymentUpdateClient.tsx` that allow customers to update their card credentials and execute simulated payment resolutions atomically.
* **Full Unit/Integration Testing**: Created unit tests under `tests/unit/stripe/` and integration webhook routing tests in `tests/integration/stripe-webhook.test.ts`.

### Phase 13: End-to-End Recovery Validation & Demo (Complete)
* **Webhook Idempotency Audits**: Hardened the Stripe and Razorpay webhook handlers to check for duplicate transaction payloads via event database queries, successfully preventing duplicate recovery runs and returning 200 OK.
* **Configurable live sender address**: Parameterized the Resend sender from-field (`RESEND_FROM_EMAIL`) in `.env.local` to allow verified email domain dispatches in live mode out-of-the-box.
* **Recovery Integration Testing**: Implemented dynamic integration tests in [`tests/integration/workflow-recover.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/integration/workflow-recover.test.ts) to verify complete workflow resolution, risk updates, subscription restoration, and user audit trails.
* **Regression & Verification**: Verified that all **61 tests passed** successfully across 15 files, TypeScript compiled cleanly, and the production build compiled routes without error.

### Phase 14: Product Polish, Dashboard & Hackathon Demo UX (Complete)
* **Registry Namespace Configured**: Initialized shadcn/ui and registered the `@bklit` UI repository to pull components from the custom Shadcn UI chart registry.
* **Bklit UI Chart Integrations**: Installed `@bklit/line-chart`, `@bklit/bar-chart`, and `@bklit/pie-chart` components. Wired them to the metrics API database data, creating beautiful, dynamic visual representations for monthly trend series, active risk grouping, and recovery outcomes.
* **Guided Demo Wizard**: Built an interactive simulation wizard directly on the dashboard page. It reports normalized details, risk scoring, Ollama AI agent analysis logs, policy checks, and email interventions in real-time, providing an easy-to-use checkout portal trigger.
* **Table Advanced Controls**: Extended the customer list table to support full text search, status filters, risk filters, and in-memory sort order by Customer Name, Amount at Risk, and Risk Score.
* **Robust Error & Offline Callouts**: Incorporated responsive error callouts for AI Unavailable states (when local Ollama is offline) and Policy Rejection states (when guardrails reject interventions). Added skeleton placeholders for initial metrics loading.

### Phase 15: Hackathon Hardening & Demo Readiness (Complete)
* **Abort Controllers & Timeout Protection**: Integrated a **15-second abort timeout** on local Ollama calls (`src/lib/ai/recovery-agent.ts`) with custom exception handling to prevent backend processing freezes if model instances hang.
* **Prompt Injection Sanitizer & Tagging**: Added parameter sanitization stripping carriage returns/quotes/tags, and enclosed variables in XML tagging blocks inside Ollama prompts.
* **Production Route Guards**: Locked all simulation paths under `/api/demo/*` returning `403 Forbidden` if `NODE_ENV === "production"` is active.
* **Real Amount Metrics Mapping**: Linked dynamic successful checks to write actual transaction recovery amounts into the database, blocking double-recovery count loops.
* **A11y Accessibility Indicators**: Configured ARIA labels, focus states, and visual icons prepended inside badge statuses in `src/app/page.tsx` so states are not communicated by color alone.

### Phase 16: Final Demo Environment, QA & Hackathon Readiness (Complete)
* **Ollama Preflight Health Utility**: Created `checkOllamaHealth()` inside `src/lib/ai/recovery-agent.ts` that hits Ollama `/api/tags` with a 3-second timeout and validates if the target model (`qwen3.5:9b`) is fully installed.
* **GET Health Endpoint**: Created `/api/demo/health/route.ts` GET route enabling the frontend dashboard to check reachability and installation states.
* **Dashboard Warnings & Recheck Trigger**: Implemented specific preflight warnings ("AI Service Reachability Error" and "AI Model Unavailable") on dashboard mount. Added an interactive "Re-check Connection" button to fetch status dynamically.
* **Logging Hygiene**: Cleared temporary developmental logs globally while preserving system error triggers.

---

## 3. Current Test and Build Verification Status
* **TypeScript Compilation**: Passed compilation successfully:
  ```bash
  npx tsc --noEmit
  # Exited with code 0 (Success)
  ```
* **Test Suite**: Passed successfully (52/52 tests running sequentially):
  ```bash
  npx vitest run
  # Test Files  13 passed (13)
  #      Tests  52 passed (52)
  #   Duration  41.79s
  ```

---

## 4. Current File Map

* **Configurations**:
  * [`tsconfig.json`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tsconfig.json)
  * [`package.json`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/package.json)
  * [`vitest.config.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/vitest.config.ts)
  * [`.env.local`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/.env.local) (active credentials)
* **Database & Migration**:
  * [`supabase/migrations/20260827000000_init_schema.sql`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/supabase/migrations/20260827000000_init_schema.sql)
  * [`src/lib/db/client.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/db/client.ts) (Supabase clients)
  * [`src/lib/schemas/database.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/schemas/database.ts) (Zod validations)
* **Demo, Seeding & Routing**:
  * [`src/lib/demo/demo-data.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/demo/demo-data.ts) (seed fixture loader)
  * [`src/app/api/demo/seed/route.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/demo/seed/route.ts) (seed endpoint)
  * [`src/app/api/demo/health/route.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/demo/health/route.ts) (Ollama preflight tags check)
  * [`src/app/api/demo/payment-failure/route.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/demo/payment-failure/route.ts) (simulated webhook)
  * [`src/app/api/demo/simulate-loop/route.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/demo/simulate-loop/route.ts) (end-to-end webhook-AI simulation)
  * [`src/app/api/dashboard/metrics/route.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/dashboard/metrics/route.ts) (real-time KPI database metrics)
  * [`src/app/api/workflows/[id]/recover/route.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/workflows/%5Bid%5D/recover/route.ts) (payment resolution simulator)
  * [`src/app/page.tsx`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/page.tsx) (SaaS UI)
* **Risk & Workflow Engines**:
  * [`src/lib/risk/constants.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/risk/constants.ts) (scoring weights)
  * [`src/lib/risk/risk-engine.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/risk/risk-engine.ts) (formulas)
  * [`src/lib/recovery/process-payment-event.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/recovery/process-payment-event.ts) (orchestrator)
  * [`src/lib/policies/recovery-policy.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/policies/recovery-policy.ts) (policy engine)
  * [`src/lib/recovery/action-executor.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/recovery/action-executor.ts) (executor runner)
  * [`src/lib/email/recovery-email.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/email/recovery-email.ts) (email drafting client)
* **AI Engine**:
  * [`src/lib/ai/schemas.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/ai/schemas.ts) (Zod parser)
  * [`src/lib/ai/recovery-agent.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/ai/recovery-agent.ts) (Ollama caller)
* **Payment Adapters**:
  * [`src/lib/payments/types.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/payments/types.ts) (provider-neutral definitions)
  * [`src/lib/payments/razorpay/signature.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/payments/razorpay/signature.ts) (Razorpay signature verification)
  * [`src/lib/payments/razorpay/parser.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/payments/razorpay/parser.ts) (Razorpay payload parser adapter)
  * [`src/app/api/webhooks/razorpay/route.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/webhooks/razorpay/route.ts) (Razorpay webhook endpoint)
  * [`src/lib/payments/stripe/signature.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/payments/stripe/signature.ts) (Stripe signature verification)
  * [`src/lib/payments/stripe/parser.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/payments/stripe/parser.ts) (Stripe payload parser adapter)
  * [`src/app/api/webhooks/stripe/route.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/api/webhooks/stripe/route.ts) (Stripe webhook endpoint)
* **Checkout Page Portal**:
  * [`src/app/update-payment/page.tsx`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/update-payment/page.tsx) (server side billing context fetch)
  * [`src/app/update-payment/PaymentUpdateClient.tsx`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/update-payment/PaymentUpdateClient.tsx) (client side card inputs & recovery simulate submit)
* **Tests**:
  * [`tests/unit/foundation.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/unit/foundation.test.ts)
  * [`tests/unit/risk-engine.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/unit/risk-engine.test.ts)
  * [`tests/unit/recovery-policy.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/unit/recovery-policy.test.ts)
  * [`tests/unit/razorpay/signature.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/unit/razorpay/signature.test.ts)
  * [`tests/unit/razorpay/parser.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/unit/razorpay/parser.test.ts)
  * [`tests/unit/stripe/signature.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/unit/stripe/signature.test.ts)
  * [`tests/unit/stripe/parser.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/unit/stripe/parser.test.ts)
  * [`tests/integration/workflow-engine.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/integration/workflow-engine.test.ts)
  * [`tests/integration/recovery-agent.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/integration/recovery-agent.test.ts)
  * [`tests/integration/action-executor.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/integration/action-executor.test.ts)
  * [`tests/integration/razorpay-webhook.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/integration/razorpay-webhook.test.ts)
  * [`tests/integration/stripe-webhook.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/integration/stripe-webhook.test.ts)
  * [`tests/integration/workflow-recover.test.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/tests/integration/workflow-recover.test.ts)

---

## 5. Next Steps
* **Hackathon-Ready System Complete & Hardened**: All phases from schema migrations and AI agents to webhook verifications, customer portals, Bklit UI visualizations, and automated test runners have been implemented and verified. The application is completely functional, regression-tested, and ready for deployment. Phase 15 has successfully secured and hardened all workflows.

### E2E Simulation Validation & Verification (Complete)
* **Local Timeout Enlargement**: Increased the client request timeout limit inside `src/lib/ai/recovery-agent.ts` from 15 seconds to 45 seconds by default to accommodate slower local Ollama Qwen CPU/GPU inference.
* **Subscription Status Transitions**: Added automated status transitions in `src/lib/recovery/process-payment-event.ts`. Payment failure events now transition the target customer's subscription to `past_due`, enabling checkout portal inputs to display correctly. Successful payments transition status back to `active`.
* **Verification Outcome**: Programmatically triggered the full end-to-end recovery simulation for Maya, successfully retrieved the secure email checkout link, completed card updating with successful checkout execution, and verified the dashboard metrics dynamically updated in place.

---

## 6. Real-Time Webhook E2E Testing (Razorpay)

We fully integrated and verified the local development environment with the cloud-hosted Razorpay Sandbox dashboard in Test Mode. 

### Local System Execution Setup
1. **Ollama LLM Instance**: Ollama was run locally with Qwen 9B:
   ```bash
   ollama run qwen3.5:9b
   ```
2. **Next.js Dev Server**: Started the application in development mode:
   ```powershell
   cmd /c npm run dev
   ```
   * *Local Endpoint*: `http://localhost:3000`
3. **Public Secure Tunneling**: Exposed port 3000 to the public internet using **VS Code Port Forwarding**:
   * Port `3000` forwarded with **Port Visibility** set to **Public** to allow inbound Razorpay webhook requests.
   * *Tunnel Address*: `https://qcgs545d-3000.inc1.devtunnels.ms`
4. **Webhook URL Settings in Razorpay**: Configured the webhook endpoint in Razorpay Dashboard Test Mode:
   * *URL*: `https://qcgs545d-3000.inc1.devtunnels.ms/api/webhooks/razorpay`
   * *Secret*: `2005Sushanth_22`
   * *Subscribed Events*: `payment.failed`, `payment.captured`

### Enhancements & Bug Fixes
* **Auto-Creation Fallback Handler**: Updated [`process-payment-event.ts`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/lib/recovery/process-payment-event.ts) to support on-the-fly profile registration. If a webhook triggers with an email not pre-seeded in the database (e.g. default Razorpay test email `void@razorpay.com`), the handler automatically inserts a customer and subscription record into Supabase, avoiding webhook `500` failures.
* **Checkout Page Portal Logic**: Fixed a bug in [`PaymentUpdateClient.tsx`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/update-payment/PaymentUpdateClient.tsx) and [`page.tsx`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/src/app/update-payment/page.tsx) where checkout links displayed "Account Fully Paid" for active workflows because the status had transitioned to `completed` upon email dispatch. Added `completed` status to the client-side portal lookup to allow overdue card updates.

### Phase 17: Interactive Raw Bank Log AI Explainer & Live Playground (Complete)
* **Unstructured Bank Log Explainer**: Implemented an interactive testing playground on the dashboard allowing real-time AI diagnosis of raw, non-standardized bank decline text (e.g., HDFC international velocity limits, RBI e-mandate freezes, MCC recurring blocks).
* **AI Analysis Schema & Engine Method**: Defined `rawBankLogAnalysisSchema` in `src/lib/ai/schemas.ts` and created `analyzeRawBankLog()` in `src/lib/ai/recovery-agent.ts` calling local Ollama (`qwen3.5:9b`).
* **API Handler & Timeout Resilience**: Created Route Handler `/api/demo/analyze-raw-log/route.ts` with `maxDuration = 120` and increased LLM timeout to 120 seconds to accommodate local GPU/CPU model loading into memory without aborting.

### Recent UI Refactoring & Dataset Expansion (Complete)
* **Coffee Light Theme & Typography Overhaul**: Redesigned dashboard visuals with a warm latte `#F7F2EC` theme, sleek light neutral panels, and integrated **Outfit** (headings) and **JetBrains Mono** (numbers/logs) typography.
* **Seed Pre-Population Fix**: Updated `src/lib/demo/demo-data.ts` to pre-populate default AI recommendations (`send_payment_recovery_email` or `no_action`) upon database reset, eliminating `"Pending AI recommendations..."` fallback placeholders.
* **Drawer Component Refactoring**: Cleaned up the Recovery Workflow Details Drawer in `src/app/page.tsx`, removing duplicated historical payment items, formatting clean single-line history rows, and condensing intervention logs into high-density key-value pairs.
* **Full Dataset Coverage (Low Risk & In Recovery)**: Added customer personas **Rohan** (`rohan@example.com`, Low Risk score 20, ₹199 Basic) and **Anita** (`anita@example.com`, In Recovery status, ₹12,499 Enterprise) to ensure all 4 risk levels (`critical`, `high`, `medium`, `low`) and 3 statuses (`open`, `in_recovery`, `recovered`) are represented in the seed dataset.


