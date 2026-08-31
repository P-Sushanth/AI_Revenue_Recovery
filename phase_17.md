# AI Revenue Recovery — Phase 17 Implementation Specification

## Phase 17 — Interactive Raw Bank Log AI Explainer & Live Demo Engine

---

# 1. Objective

Build an interactive, live demonstration capability — the **Raw Bank Log AI Explainer** — allowing local testing and presentation of how the local Ollama LLM (`qwen3.5:9b`) dynamically parses, interprets, and acts on raw, unstructured, non-standardized bank decline strings from payment processors.

The goal of Phase 17 is to clearly demonstrate the indispensability of AI in the application:
* Show how the system interprets messy, non-standardized bank error messages that standard `if/else` rules cannot parse.
* Provide an interactive local playground on the dashboard for real-time testing.
* Display structured LLM extractions (Technical Cause, Customer Explanation, Recommended Action, Confidence, Urgency).

---

# 2. Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────┐
│                 LOCAL DEMO DASHBOARD                    │
│                                                         │
│  Raw Bank Log AI Analyzer UI Card                        │
│  ├── Preset Buttons (HDFC Velocity Cap, RBI Freeze, etc)│
│  └── Custom Raw Message Input Field                     │
└────────────────────────────┬────────────────────────────┘
                             │ POST /api/demo/analyze-raw-log
                             ▼
┌─────────────────────────────────────────────────────────┐
│                NEXT.JS API ROUTE HANDLER                 │
│         src/app/api/demo/analyze-raw-log/route.ts       │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    AI RECOVERY AGENT                    │
│     analyzeRawBankLog() in src/lib/ai/recovery-agent.ts │
│                                                         │
│  - Sanitizes raw input string                           │
│  - Builds XML-bound instruction prompt                   │
│  - Calls Local Ollama API (http://localhost:11434)      │
│  - Parses & validates output matching Zod Schema       │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    LIVE OUTPUT UI CARD                  │
│                                                         │
│  - Extracted Technical Root Cause                        │
│  - Customer-Friendly Explanation                        │
│  - AI Recommended Action & Intent                        │
│  - Confidence Level & Urgency Rating                    │
└─────────────────────────────────────────────────────────┘
```

---

# 3. Component & Technical Requirements

### 3.1 Backend AI Handler (`src/lib/ai/recovery-agent.ts`)
Add `analyzeRawBankLog(rawMessage: string)` function:
* Accepts any arbitrary raw text string.
* Formats a system & user prompt demanding structured JSON:
  ```json
  {
    "raw_input": "...",
    "technical_root_cause": "...",
    "customer_explanation": "...",
    "recommended_action": "send_payment_recovery_email" | "no_action",
    "customer_message_intent": "...",
    "urgency": "low" | "medium" | "high",
    "confidence": "low" | "medium" | "high"
  }
  ```
* Invokes local Ollama (`qwen3.5:9b`) at `temperature: 0.0`.
* Validates output using a Zod schema in `src/lib/ai/schemas.ts`.

### 3.2 API Endpoint (`src/app/api/demo/analyze-raw-log/route.ts`)
* Accepts `POST` requests with JSON `{ rawMessage: string }`.
* Calls `analyzeRawBankLog()`.
* Returns structured diagnosis JSON to the client.

### 3.3 Dashboard Interactive UI (`src/app/page.tsx`)
Add a new interactive section **"Raw Bank Log AI Explainer (Live Testing)"**:
* **Preset Buttons**:
  1. *HDFC Velocity Cap*: `"Transaction blocked by HDFC fraud system due to 24h international velocity cap"`
  2. *RBI E-Mandate Freeze*: `"Processor error 05: Do Not Honor - Cardholder account frozen under RBI e-mandate regulatory check"`
  3. *MCC Category Mismatch*: `"Issuer decline: Merchant Category Code (MCC 5734) prohibited for recurring billing on debit card"`
  4. *Expired Card Token*: `"Gateway returned Token Invalid: Card expiration date passed (08/26)"`
* **Custom Textarea Input**: Allows typing any free-form raw bank decline string.
* **"Analyze with Ollama AI" Button**: Triggers analysis with real-time loading spinner.
* **Live Result Container**: Displays extracted diagnosis cards with visual badges.

---

# 4. Implementation Steps

1. **Schema Update** (`src/lib/ai/schemas.ts`): Add `rawBankLogAnalysisSchema`.
2. **AI Agent Method** (`src/lib/ai/recovery-agent.ts`): Add `analyzeRawBankLog()`.
3. **API Handler** (`src/app/api/demo/analyze-raw-log/route.ts`): Build POST endpoint.
4. **UI Panel** (`src/app/page.tsx`): Build the interactive tester card and results layout.
5. **Verification**: Run local tests, check type safety, and verify live execution against local Ollama.
