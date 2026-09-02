# AI Revenue Recovery Engine
> An autonomous billing intervention platform that detects subscription payment failures, diagnoses root causes using a local LLM, and recovers lost recurring revenue through policy-bounded interventions.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Online-emerald?style=for-the-badge&logo=vercel)](https://ai-revenue-recovery.vercel.app)

> [!NOTE]
> **Live Demo Notice**: The live web deployment allows exploring dashboard metrics, risk scores, demo customer personas, and workflow drawers. Full end-to-end real-time AI bank log diagnosis requires a running local Ollama instance (`qwen3.5:2b`).

---

## 1. The Problem
SaaS businesses lose recurring revenue every month due to involuntary churn caused by failed subscription payments (expired credit cards, 3D-Secure authentication timeouts, temporary gateway errors, insufficient funds, and regulatory mandate blocks). 

Traditional dunning tools rely on rigid, hardcoded rules that fail to differentiate between high-LTV VIP accounts and churn-prone trial users, send generic "card declined" emails, and break when payment processors return raw, non-standardized bank error messages.

---

## 2. What the Project Does
The **AI Revenue Recovery Engine** combines deterministic payment event ingestion, an automated risk engine, local LLM diagnosis, policy guardrails, and automated recovery interventions into an end-to-end autonomous pipeline:
* **Normalizes & Ingests Webhooks**: Processes real-time webhook events from Razorpay and Stripe with strict idempotency.
* **Calculates Risk & Recoverability Scores**: Computes deterministic risk scores (0–100) and classifies revenue risks into `Critical`, `High`, `Medium`, and `Low`.
* **Diagnoses via Local AI Agent**: Runs a local Ollama LLM (`qwen3.5:2b`) to parse unstructured bank decline messages, extract root causes, and determine optimal recovery strategies.
* **Enforces Automated Policy Guardrails**: Validates AI recommendations against deterministic business policies before taking any intervention action (e.g. blocking emails for cancelled accounts).
* **Executes Automated Interventions**: Dispatches personalized recovery emails containing secure, single-click payment update links (`/update-payment`).
* **Visualizes Real-Time Metrics**: Renders a warm coffee-themed SaaS dashboard displaying real-time KPI metrics, time-series revenue trends, risk distributions, live system audit logs, and an interactive **Raw Bank Log AI Explainer**.

---

## 3. What Makes This Different
* **Unstructured Bank Log Interpretation**: Traditional dunning platforms rely exclusively on standard gateway failure codes. This system uses a local LLM to parse raw, non-standardized bank error messages (e.g., HDFC velocity caps, RBI e-mandate freezes, MCC recurring blocks).
* **Deterministic Policy Separation**: AI recommendations are treated purely as advisory inputs. An automated policy engine evaluates subscription state, contact history, and business rules before any action is executed.
* **Privacy & Local LLM Execution**: Runs local inference (`qwen3.5:2b` via Ollama) without transmitting sensitive customer financial details to third-party cloud LLM APIs.
* **Zero-Friction Self-Service Recovery**: Dispatches secure, single-click payment update links (`/update-payment`) allowing customers to resolve payment issues instantly.

---

## 4. How It Works / Workflow

```text
┌─────────────────────────┐
│ Payment Gateway Webhook │ (Razorpay / Stripe)
└────────────┬────────────┘
             │ 1. Normalize Payload & Enforce Idempotency
             ▼
┌─────────────────────────┐
│   Deterministic Risk    │ -> Calculates Risk Score (0-100) & Recoverability Index
│         Engine          │ -> Classifies Risk Level (Critical / High / Medium / Low)
└────────────┬────────────┘
             │ 2. Trigger Recovery Workflow (Status: Pending)
             ▼
┌─────────────────────────┐
│     Local AI Agent      │ -> Runs Ollama (qwen3.5:2b) at temperature 0.0
│       (Ollama)          │ -> Extracts Technical Root Cause & Customer-Friendly Translation
└────────────┬────────────┘
             │ 3. Output AI Recommendation (send_payment_recovery_email / no_action)
             ▼
┌─────────────────────────┐
│     Automated Policy    │ -> Evaluates Active Subscription & Risk Thresholds
│     Engine Guardrails   │ -> Approves or Rejects Action (Writes Audit Log)
└────────────┬────────────┘
             │ 4. Execution Dispatcher
             ▼
┌─────────────────────────┐
│    Action Executor      │ -> Dispatches Personalized Recovery Email
│                         │ -> Generates Secure Payment Update Portal Link (/update-payment)
└────────────┬────────────┘
             │ 5. Customer Updates Payment & Gateway Retries
             ▼
┌─────────────────────────┐
│ Workflow Resolution &   │ -> Subscription Restored to Active
│  Dashboard Analytics    │ -> Risk Status set to Recovered (Metrics updated in real-time)
└─────────────────────────┘
```

---

## 5. Key Features
* **Zero-Shot Raw Bank Log AI Explainer**: Interactive playground card to paste or test unstructured, messy bank decline text (e.g. HDFC velocity caps, RBI e-mandate freezes, MCC recurring blocks).
* **Multi-Provider Webhook Adapters**: Native support for Razorpay and Stripe webhooks with cryptographic HMAC signature verification and idempotency checks.
* **Automated Policy Guardrails**: Deterministic rules preventing accidental email spamming or policy violations.
* **Interactive Self-Service Checkout Portal**: Server-rendered `/update-payment` customer card update page that simulates payment retry and atomic database recovery.
* **Local LLM Inference**: Runs local Qwen 9B LLM via Ollama without sending sensitive customer financial data to third-party cloud APIs.
* **Dynamic SaaS Dashboard**: Polished warm coffee light theme with Bklit charts, real-time KPI metrics, search/filtering, and live timeline audit trails.

---

## 6. Engineering Decisions

* **Local LLM Inference over Cloud APIs**: Selected local Ollama (`qwen3.5:2b`) execution to process sensitive raw payment logs without transmitting financial data to external cloud providers.
* **Deterministic Policy Engine Gate**: AI recommendations are treated as advisory inputs. An automated policy engine evaluates subscription status and contact history before any recovery action is dispatched.
* **Decoupled Gateway Adapters**: Implemented standard parser interfaces mapping provider-specific webhook payloads (Razorpay, Stripe) into a unified domain schema.
* **Idempotent Event Ingestion**: Utilized unique event hashes and database constraints to prevent duplicate processing of re-sent webhooks.
* **Strict Runtime Type Safety**: Enforced runtime Zod validation across database entities, webhook payloads, and LLM JSON outputs.

---

## 7. Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS APP ROUTER                            │
│                                                                        │
│  Dashboard UI (src/app/page.tsx)                                       │
│  ├── KPI Metric Cards & Bklit Trend Charts                             │
│  ├── Interactive Demo Simulation Wizard                                │
│  ├── Raw Bank Log AI Explainer Playground                              │
│  ├── Filterable At-Risk Customer Table                                 │
│  └── Slide-out Workflow Details Drawer                                 │
│                                                                        │
│  API Route Handlers (src/app/api/*)                                    │
│  ├── /api/webhooks/razorpay & /api/webhooks/stripe                    │
│  ├── /api/demo/simulate-loop & /api/demo/analyze-raw-log              │
│  ├── /api/demo/health & /api/demo/seed                                 │
│  └── /api/dashboard/metrics                                            │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌────────────────────────────────────────┐ ┌─────────────────────────────┐
│          SUPABASE POSTGRES DB          │ │          OLLAMA             │
│                                        │ │   http://localhost:11434    │
│  - customers & subscriptions           │ │                             │
│  - payment_events & revenue_risks      │ │   Model: qwen3.5:2b         │
│  - recovery_workflows & audit_logs     │ │   Temperature: 0.0          │
└────────────────────────────────────────┘ └─────────────────────────────┘
```

---

## 8. Tech Stack
* **Framework**: Next.js 16 (App Router, React 19, TypeScript)
* **Styling**: Vanilla CSS, Tailwind CSS v4, Lucide Icons, Custom Coffee Light Design Token System (`#F7F2EC`)
* **Typography**: Google Fonts — **Outfit** (Headings/UI) & **JetBrains Mono** (Metrics/Code/Logs)
* **Database & Auth**: Supabase (PostgreSQL, Row-Level Security, Real-time client)
* **AI & Inference**: Ollama (`qwen3.5:2b` running locally) with Zod structural response parsing
* **Data Validation**: Zod runtime schemas for database, payment payloads, and LLM responses
* **Testing**: Vitest & Vite tsconfig paths (Unit and Integration test suites)
* **Payment Adapters**: Razorpay & Stripe SDK Webhook Parsers with HMAC Signature Verification

---

## 9. AI / Agent Design
The AI agent in `src/lib/ai/recovery-agent.ts` is engineered for **constrained structured output**:
* **System Prompt Isolation**: Untrusted bank messages and customer names are wrapped inside explicit `<raw_log>` XML delimiters to prevent prompt injection.
* **Deterministic Decoding**: Runs with `temperature: 0.0` and `response_format: { type: "json_object" }` to force strict JSON schema outputs.
* **Schema Validation**: LLM JSON output is validated at runtime using Zod schemas (`aiRecommendationSchema` and `rawBankLogAnalysisSchema`).
* **Timeout Resilience**: Configured with a 120-second abort controller and preflight health checking (`/api/demo/health`) to handle initial model loading into GPU/CPU memory gracefully.

---

## 10. Revenue Recovery Scenarios
The system includes 9 pre-seeded demo customer scenarios covering all risk scores and status states:

| Persona | Subscription Plan | Failure Code / Scenario | Risk Score & Level | Recommended AI Action | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Alex** | Pro (₹2,499) | Expired Card | `55` (HIGH) | `send_payment_recovery_email` | Open |
| **Sarah** | Business (₹7,999) | 3D-Secure Auth Required | `55` (HIGH) | `send_payment_recovery_email` | **Recovered (Baseline)** |
| **John** | Starter (₹499) | Insufficient Funds | `50` (HIGH) | `no_action` (Policy Blocked) | Open |
| **Maya** | Pro (₹2,499) | 4 Consecutive Card Declines | `85` (CRITICAL) | `send_payment_recovery_email` | Open |
| **Daniel** | Pro (₹2,499) | Expired Card (Subscription Cancelled) | `45` (MEDIUM) | `no_action` (Policy Blocked) | Open |
| **Clara** | Pro (₹1,499) | Gateway Processing Error (Paused) | `50` (HIGH) | `send_payment_recovery_email` | Open |
| **James** | Starter (₹999) | Card Declined (Cancelled) | `45` (MEDIUM) | `no_action` (Policy Blocked) | Open |
| **Rohan** | Basic (₹199) | Temporary Gateway Timeout | `20` (**LOW**) | `send_payment_recovery_email` | Open |
| **Anita** | Enterprise (₹12,499) | 3DS Auth Required | `65` (HIGH) | `send_payment_recovery_email` | **In Recovery** |

---

## 11. Demo / Screenshots

![Dashboard Preview](https://raw.githubusercontent.com/P-Sushanth/AI_Revenue_Recovery/main/localhost_dashboard.png?v=3)

---

## 12. Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **Ollama**: Installed locally ([ollama.com](https://ollama.com)) with the Qwen model pulled:
  ```bash
  ollama pull qwen3.5:2b
  ```
* **Supabase Account**: A PostgreSQL instance with the schema applied from [`supabase/migrations/20260827000000_init_schema.sql`](file:///c:/Users/popur/Documents/Projects/AI_Revenue_Recovery/supabase/migrations/20260827000000_init_schema.sql).

---

## 13. Environment Variables
Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# LLM Configuration
LLM_PROVIDER=local
LOCAL_LLM_API_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=qwen3.5:2b
LOCAL_LLM_TIMEOUT=120000

# Email Configuration
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL="onboarding@resend.dev"

# Razorpay Configuration (Optional for Webhooks)
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx
RAZORPAY_WEBHOOK_SECRET=xxxx
```

---

## 14. Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Local Ollama Engine**:
   ```bash
   ollama run qwen3.5:2b
   ```

3. **Start Next.js Development Server**:
   ```bash
   npm run dev
   ```

4. **Open Application**:
   Navigate to [http://localhost:3000](http://localhost:3000).

5. **Run Verification & Tests**:
   ```bash
   npm run typecheck   # TypeScript compiler check
   npm run test        # Vitest test suite execution
   ```

---

## 15. Demo Mode / Test Data

1. **Reset Database Seeds**: Click the **"Reset Seeds"** button in the header toolbar to reset and seed the 9 demo customer personas into Supabase.
2. **Run End-to-End Recovery Simulation**: Select any persona (e.g. *Alex* or *Maya*) from the Demo Simulator dropdown and click **"Run Demo"**. Watch the AI agent diagnose the risk, pass policy guardrails, and dispatch a simulated email.
3. **Simulate Payment Recovery**: Click on Alex's row in the customer table to open the Workflow Details Drawer and click **"Simulate Customer Payment Success"** (or open `/update-payment?customer_id=...` in your browser). Notice the dashboard metrics and recovery rate update in real-time.
4. **Test Raw Bank Log Explainer**: Scroll to the **Raw Bank Log AI Explainer** section on the dashboard, click any preset scenario button (e.g. *HDFC Velocity Cap* or *RBI E-Mandate Freeze*), and click **"Analyze Raw Log with Ollama AI"**.

---

## 16. Project Structure

```text
├── public/                     # Static SVG graphics & icons
├── src/
│   ├── app/
│   │   ├── api/                # API Route Handlers (Metrics, Webhooks, Demo, AI)
│   │   ├── update-payment/     # Self-service customer payment update portal
│   │   ├── layout.tsx          # Root layout & Google Fonts integration
│   │   └── page.tsx            # SaaS Revenue Recovery Dashboard UI
│   ├── components/             # Reusable UI components & Bklit charts
│   ├── lib/
│   │   ├── ai/                 # Ollama LLM connector, prompts, & Zod schemas
│   │   ├── db/                 # Supabase client initialization (Admin & RLS)
│   │   ├── demo/               # Seed data generator & fixture fixtures
│   │   ├── email/              # Email drafting client (Resend / Simulated)
│   │   ├── payments/           # Razorpay & Stripe signature & parser adapters
│   │   ├── policies/           # Policy engine guardrails
│   │   ├── recovery/           # Webhook event processing & action executor
│   │   ├── risk/               # Risk engine scoring algorithms & constants
│   │   └── schemas/            # Database domain Zod schemas
├── supabase/
│   └── migrations/             # PostgreSQL init schema SQL migration
├── tests/
│   ├── integration/            # Webhook & Workflow integration test suites
│   └── unit/                   # Risk, Policy, and Payment unit test suites
├── .env.example                # Template environment file
├── next.config.ts              # Next.js configuration
├── README.md                   # Project documentation
├── tsconfig.json               # TypeScript compiler config
└── vitest.config.ts            # Vitest unit test runner config
```

---

## 17. Limitations & Safety Boundaries
* **Policy Guardrails**: The LLM cannot directly execute payments or dispatch emails without passing deterministic policy validation checks.
* **Mock Gateway Actions**: Live payment retries are simulated in demo mode; production deployment requires active merchant accounts on Razorpay or Stripe.
* **Hardware Sensitivity**: Local LLM inference speed depends on your machine's CPU/GPU RAM; initial queries may take up to 10–15 seconds while Ollama warms up.

---

## 18. Future Improvements
* **Multi-Turn SMS & WhatsApp Agents**: Extend recovery interventions to WhatsApp Business API and SMS channels for high-LTV VIP accounts.
* **Smart Retry Window Optimization**: Train ML models to predict optimal card re-charge windows (e.g. salary dates, 1st of the month).
* **Multi-Gateway Routing**: Automatically re-route failed credit card charges to UPI / Netbanking alternatives based on historic regional success rates.

---

## 19. Why This Matters / Impact
As an illustrative mathematical example, for a hypothetical SaaS business generating $1M ARR experiencing involuntary churn, successfully recovering 15% to 20% of failed payments represents an additional $15,000 to $20,000 in retained annual revenue — achieved without additional customer acquisition costs. 

By combining local AI reasoning with deterministic safety guardrails, SaaS platforms can protect their revenue streams systematically and ethically.

---

## 20. Author
* **P. Sushanth**
* **Project**: AI Revenue Recovery Engine
* **Repository**: [GitHub — P-Sushanth/AI_Revenue_Recovery](https://github.com/P-Sushanth/AI_Revenue_Recovery)
