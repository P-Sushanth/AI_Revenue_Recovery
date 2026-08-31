# AI Revenue Recovery — Project Task List

This file tracks all completed and pending milestones for the AI Revenue Recovery system.

---

## Completed Tasks

### Phase 1 — Project Foundation
- [x] Initialize Git repository
- [x] Bootstrap Next.js 16 (App Router, TypeScript, ESLint, Tailwind CSS v4)
- [x] Configure `.env.example` and `.env.local` supporting local Ollama (`qwen3.5:9b`)
- [x] Verify tsconfig rules and strict type compiler
- [x] Install Vitest and configure path alias resolution in `vitest.config.ts`
- [x] Configure `.gitignore` to protect credentials and ignore all `.md` files

### Phase 2 — Database Schema & client
- [x] Design Postgres tables structure (`customers`, `subscriptions`, `payment_events`, `revenue_risks`, `recovery_workflows`, `recovery_actions`, `audit_logs`)
- [x] Write init migration script at `supabase/migrations/20260827000000_init_schema.sql` (Successfully executed in Supabase SQL editor)
- [x] Implement domain schemas and runtime validations in `src/lib/schemas/database.ts` using Zod
- [x] Implement standard and server-only admin client connectors in `src/lib/db/client.ts`

### Phase 3 — Seed / Demo Data
- [x] Create deterministic customer profiles and historical data generator in `src/lib/demo/demo-data.ts`
- [x] Support seeding logic for the 5 target profiles (Alex, Sarah, John, Maya, Daniel)
- [x] Build Route Handler at `/api/demo/seed` to trigger database cleanup and fresh data seeding

### Phase 4 — Risk Engine
- [x] Define scoring thresholds, level classifications, and constants in `src/lib/risk/constants.ts`
- [x] Write deterministic scoring logic for risk calculations in `src/lib/risk/risk-engine.ts`
- [x] Write deterministic recoverability scoring rules in `src/lib/risk/risk-engine.ts`
- [x] Enforce safety checks and score clamping (between 0 and 100)
- [x] Build unit test suite in `tests/unit/risk-engine.test.ts` for all scenarios
- [x] Verify tests pass successfully (10/10 tests passed)

### Phase 5 — Workflow Engine
- [x] Implement raw event structure and webhook validation in `src/lib/recovery/process-payment-event.ts` (Done)
- [x] Implement idempotency checks by querying database for duplicate provider event IDs (Done)
- [x] Implement event processing flow: automatically trigger risk calculations and insert `revenue_risks` (Done)
- [x] Initialize `recovery_workflows` record starting in state `pending` on payment failure (Done)
- [x] Implement transaction audit logging (e.g. logging `risk_detected` event) (Done)

### Phase 6 — AI Engine (Local Qwen Integration)
- [x] Implement local Ollama API connector at `src/lib/ai/recovery-agent.ts` supporting standard Qwen prompt shapes (Done)
- [x] Design structured JSON prompt demanding strict responses matching target diagnosis schema (Done)
- [x] Implement Zod schema validation for AI recommendations in `src/lib/ai/schemas.ts` (Done)
- [x] Implement fallback execution path (gracefully mark workflow failed on AI parse errors) (Done)
- [x] Log LLM decision outputs in `audit_logs` (Done)

### Phase 7 — Policy Engine
- [x] Write policy guardrails in `src/lib/policies/recovery-policy.ts` (Done)
- [x] Restrict email dispatch based on criteria: active subscriptions, medium/high/critical risk levels, and non-empty email addresses (Done)
- [x] Enforce rejection rules (e.g. cancelled subscription results in `no_action`) (Done)

### Phase 8 — Action Executor
- [x] Create dispatcher for interventions in `src/lib/recovery/action-executor.ts` (Done)
- [x] Build simulated email sender for MVP mode (and support live Resend email client toggle) in `src/lib/email/recovery-email.ts` (Done)
- [x] Prevent duplicate execution of intervention actions on the same workflow (Done)

### Phase 9 — Dashboard UI & Simulation View
- [x] Build analytical KPI cards fetching values from Postgres (Revenue at Risk, Recoverable, Recovered, Active Workflows) (Done)
- [x] Build interactive tables to view risks and workflow logs (Done)
- [x] Design Workflow Details timeline showing: Event normalized -> Risk engine run -> AI diagnosed -> Policy checked -> Action dispatched (Done)
- [x] Build front-end button to trigger a live payment failure demo run and visualize the step-by-step progress (Done)
- [x] Build action button to simulate payment recovery (marking the workflow recovered and seeding a success payment event) (Done)

- [x] Write signature verification (HMAC-SHA256) and adapter parser to handle real Razorpay payloads in production mode (Done)

### Phase 10 — Razorpay Webhook Adapter
- [x] Integrate Razorpay payload mapping and verify signature checks (Done)

### Phase 11 — Razorpay Webhook Refactoring & Unit Tests
- [x] Create types for provider abstraction in `src/lib/payments/types.ts` (Done)
- [x] Create cryptographic signature verifier in `src/lib/payments/razorpay/signature.ts` (Done)
- [x] Create minor-unit amount converter in `src/lib/payments/razorpay/amount.ts` (Done)
- [x] Create Razorpay event payload parser in `src/lib/payments/razorpay/parser.ts` (Done)
- [x] Refactor API webhook endpoint at `src/app/api/webhooks/razorpay/route.ts` to use modular helpers (Done)
- [x] Create unit tests for signature validation, parser mappings, and amount handling in `tests/unit/razorpay/` (Done)
- [x] Run full validation check (`npm run typecheck` and `npm run test` and production build) (Done)

---

## Pending Tasks

### Phase 12 — Stripe Webhook Adapter & Customer Checkout Loop
- [x] Add Stripe webhook secret configuration to `.env.example`
- [x] Implement cryptographic Stripe signature verifier in `src/lib/payments/stripe/signature.ts`
- [x] Implement cent amount converter in `src/lib/payments/stripe/amount.ts`
- [x] Implement Stripe webhook event parser in `src/lib/payments/stripe/parser.ts`
- [x] Implement Stripe webhook route handler in `src/app/api/webhooks/stripe/route.ts`
- [x] Write unit tests for Stripe verifier, parser, and amount converter in `tests/unit/stripe/`
- [x] Write integration tests for Stripe webhook routing in `tests/integration/stripe-webhook.test.ts`
- [x] Build `/update-payment` frontend checkout page at `src/app/update-payment/page.tsx`
- [x] Verify checkout form triggers successful webhook resolution and database updates
- [x] Run full project validation (`npm run typecheck` and `npm run test` and `npm run build`)

### Phase 13 — End-to-End Recovery Validation & Demo
- [x] Verify Razorpay payment failure event routing to `payment_events`, `revenue_risks`, and `recovery_workflows`
- [x] Validate Ollama qwen3.5:9B AI response structure and Zod schema mapping
- [x] Confirm Policy engine evaluates recommendation and approves action
- [x] Verify Action Executor dispatches recovery email (simulated and live modes)
- [x] Ensure duplicate events are ignored at API boundaries (Idempotency)
- [x] Test the checkout page `/update-payment` payment submission flow
- [x] Verify successful payment normalization and matching to correct active workflow
- [x] Verify workflow transitions to `completed`, risk to `recovered`, and subscription to `active`
- [x] Verify dashboard analytical metrics and audit timeline reflect recovered state
- [x] Write integration test coverage for the end-to-end Razorpay/Stripe recovery cycle
- [x] Execute full validation checks (`npm run typecheck`, `npm run test`, and `npm run build`)

### Phase 14 — Product Polish, Dashboard & Hackathon Demo UX
- [x] Refactor dashboard visual layout to a premium, dark-themed SaaS revenue operations panel
- [x] Add the Revenue trend line chart using Recharts (Revenue at Risk vs Recovered Revenue)
- [x] Add visual charts for Risk Distribution and Recovery Outcomes
- [x] Format and polish the At-Risk Customer table with status/urgency badges and sorting/filtering controls
- [x] Integrate explicit loading states, skeletons, and robust error frames (including AI-unavailable and Policy-denied states)
- [x] Build a guided Demo Progress timeline component on the dashboard showing live execution steps
- [x] Ensure dashboard metrics refresh dynamically in place upon payment resolution
- [x] Run full project validation (`npm run typecheck` and `npm run test` and `npm run build`)

### Phase 15 — Hackathon Hardening & Demo Readiness
- [x] Add 15-second timeout and connection error handler to local Ollama inference in `src/lib/ai/recovery-agent.ts`
- [x] Sanitize customer-controlled fields and wrap them in XML delimiters within Ollama prompts
- [x] Implement production lock-out guards for demo endpoints (`/api/demo/*`)
- [x] Audit Stripe and Razorpay webhook routes for raw body verification and signature compliance
- [x] Harden webhook idempotency checks in `src/lib/recovery/process-payment-event.ts` against duplicate successes/failures
- [x] Integrate ARIA labels, semantic headers, keyboard accessibility indicators, and visual badge markers in `src/app/page.tsx`
- [x] Run full project validation (`npm run typecheck` and `npm run test` and `npm run build`)

### Phase 16 — Final Demo Environment, QA & Hackathon Readiness
- [x] Implement checkOllamaHealth in `src/lib/ai/recovery-agent.ts` checking reachability and model availability
- [x] Create server GET route `/api/demo/health` querying Ollama preflight status
- [x] Update `src/app/page.tsx` to fetch Ollama health on load/click and display specific Offline vs. Model Missing warnings
- [x] Global console cleanup of developmental logs across routes and controllers
- [x] Validate final project compile typechecks, Vitest tests, and Turbopack builds
- [x] Verify manual end-to-end simulation run (AI diagnosis, Policy check, Email dispatch, Card update checkout, and metrics resolution)

### Phase 17 — Interactive Raw Bank Log AI Explainer & Live Demo Engine
- [x] Add `rawBankLogAnalysisSchema` in `src/lib/ai/schemas.ts` for unstructured decline parsing
- [x] Implement `analyzeRawBankLog()` in `src/lib/ai/recovery-agent.ts` to call local Ollama (`qwen3.5:9b`)
- [x] Create API Route `src/app/api/demo/analyze-raw-log/route.ts` to handle custom text requests
- [x] Add **Raw Bank Log AI Analyzer** interactive card to dashboard in `src/app/page.tsx` with preset sample buttons & custom input
- [x] Render live visual extraction cards (Technical Root Cause, Customer Translation, Recommended Action, Confidence, Urgency)
- [x] Validate implementation with `npm run typecheck` and test live Ollama response execution