-- AI Revenue Recovery Database Schema Migration

-- Enable pgcrypto for gen_random_uuid() if not enabled by default
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    country VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    external_id TEXT UNIQUE,
    plan_name TEXT NOT NULL,
    amount NUMERIC(15, 4) NOT NULL, -- Storing exact decimal amounts
    currency VARCHAR(10) NOT NULL,
    status TEXT CHECK (status IN ('active', 'past_due', 'cancelled', 'paused')) NOT NULL,
    billing_interval TEXT NOT NULL,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Payment Events Table
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    amount NUMERIC(15, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status TEXT CHECK (status IN ('succeeded', 'failed', 'pending')) NOT NULL,
    failure_code TEXT,
    failure_message TEXT,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_payment_event_idempotency UNIQUE (provider, external_event_id)
);

-- 4. Revenue Risks Table
CREATE TABLE IF NOT EXISTS revenue_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
    payment_event_id UUID REFERENCES payment_events(id) ON DELETE CASCADE NOT NULL,
    amount_at_risk NUMERIC(15, 4) NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    reason TEXT NOT NULL,
    recoverability_score INTEGER NOT NULL CHECK (recoverability_score BETWEEN 0 AND 100),
    status TEXT CHECK (status IN ('open', 'in_recovery', 'recovered', 'lost', 'dismissed')) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Recovery Workflows Table
CREATE TABLE IF NOT EXISTS recovery_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
    revenue_risk_id UUID REFERENCES revenue_risks(id) ON DELETE CASCADE NOT NULL,
    trigger_type TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'analyzing', 'awaiting_approval', 'executing', 'completed', 'failed', 'cancelled')) NOT NULL DEFAULT 'pending',
    risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    recommended_action TEXT,
    approved_action TEXT,
    action_status TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Recovery Actions Table
CREATE TABLE IF NOT EXISTS recovery_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES recovery_workflows(id) ON DELETE CASCADE NOT NULL,
    action_type TEXT CHECK (action_type IN ('send_payment_recovery_email')) NOT NULL,
    payload JSONB,
    status TEXT NOT NULL,
    provider_message_id TEXT,
    executed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES recovery_workflows(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT CHECK (event_type IN ('risk_detected', 'ai_analysis_completed', 'policy_check_completed', 'action_approved', 'action_executed', 'action_failed', 'workflow_completed')) NOT NULL,
    actor TEXT CHECK (actor IN ('system', 'llm', 'user')) NOT NULL,
    input JSONB,
    output JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Indexes for Query Optimization
CREATE INDEX IF NOT EXISTS idx_payment_events_customer_id ON payment_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_subscription_id ON payment_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_occurred_at ON payment_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_status ON payment_events(status);

CREATE INDEX IF NOT EXISTS idx_revenue_risks_status ON revenue_risks(status);
CREATE INDEX IF NOT EXISTS idx_revenue_risks_risk_level ON revenue_risks(risk_level);
CREATE INDEX IF NOT EXISTS idx_revenue_risks_customer_id ON revenue_risks(customer_id);

CREATE INDEX IF NOT EXISTS idx_recovery_workflows_status ON recovery_workflows(status);
CREATE INDEX IF NOT EXISTS idx_recovery_workflows_created_at ON recovery_workflows(created_at);

CREATE INDEX IF NOT EXISTS idx_recovery_actions_workflow_id ON recovery_actions(workflow_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workflow_id ON audit_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Trigger functions to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_revenue_risks_updated_at BEFORE UPDATE ON revenue_risks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_recovery_workflows_updated_at BEFORE UPDATE ON recovery_workflows FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
