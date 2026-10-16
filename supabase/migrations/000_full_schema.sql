-- ==============================================================================
-- KaamSaathi Full Database Schema Migration (Consolidated 001 - 005)
-- Run this script in your Supabase Project -> SQL Editor to initialize all tables.
-- ==============================================================================

-- 1. Enable Cryptographic Functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Generic Trigger Function for updating 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. CUSTOMERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1),
    phone TEXT NOT NULL CHECK (char_length(trim(phone)) >= 5),
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_customer_per_owner UNIQUE (owner_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_owner_id ON public.customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own customers" ON public.customers;
CREATE POLICY "Users can read own customers"
ON public.customers FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own customers" ON public.customers;
CREATE POLICY "Users can insert own customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own customers" ON public.customers;
CREATE POLICY "Users can update own customers"
ON public.customers FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own customers" ON public.customers;
CREATE POLICY "Users can delete own customers"
ON public.customers FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- ==============================================================================
-- 4. JOBS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL CHECK (char_length(trim(customer_name)) >= 1),
    customer_phone TEXT DEFAULT '',
    trade TEXT NOT NULL DEFAULT 'other' CHECK (trade IN ('electrical', 'plumbing', 'appliance', 'other')),
    description TEXT NOT NULL CHECK (char_length(trim(description)) >= 1),
    agreed_amount NUMERIC(12, 2) NOT NULL CHECK (agreed_amount > 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0 AND amount_paid <= agreed_amount),
    remaining_balance NUMERIC(12, 2) GENERATED ALWAYS AS (agreed_amount - amount_paid) STORED,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'partially_paid', 'completed')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_jobs_owner_id ON public.jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

DROP TRIGGER IF EXISTS set_jobs_updated_at ON public.jobs;
CREATE TRIGGER set_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own jobs" ON public.jobs;
CREATE POLICY "Users can read own jobs"
ON public.jobs FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own jobs" ON public.jobs;
CREATE POLICY "Users can insert own jobs"
ON public.jobs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
CREATE POLICY "Users can update own jobs"
ON public.jobs FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
CREATE POLICY "Users can delete own jobs"
ON public.jobs FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- ==============================================================================
-- 5. PAYMENT EVENTS TABLE & AUTOMATIC BALANCE RECONCILIATION TRIGGER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer')),
    notes TEXT DEFAULT '',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_owner_id ON public.payment_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON public.payment_events(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_at ON public.payment_events(recorded_at DESC);

CREATE OR REPLACE FUNCTION public.handle_payment_event_inserted()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid NUMERIC(12, 2);
    v_agreed NUMERIC(12, 2);
BEGIN
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
    FROM public.payment_events
    WHERE job_id = NEW.job_id;

    SELECT agreed_amount INTO v_agreed
    FROM public.jobs
    WHERE id = NEW.job_id;

    UPDATE public.jobs
    SET 
        amount_paid = v_total_paid,
        status = CASE 
            WHEN v_total_paid >= v_agreed THEN 'completed'
            WHEN v_total_paid > 0 THEN 'partially_paid'
            ELSE 'pending'
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.job_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_payment_event_insert ON public.payment_events;
CREATE TRIGGER after_payment_event_insert
AFTER INSERT ON public.payment_events
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_event_inserted();

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own payments" ON public.payment_events;
CREATE POLICY "Users can read own payments"
ON public.payment_events FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own payments" ON public.payment_events;
CREATE POLICY "Users can insert own payments"
ON public.payment_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own payments" ON public.payment_events;
CREATE POLICY "Users can delete own payments"
ON public.payment_events FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- ==============================================================================
-- 6. REMINDERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    task TEXT NOT NULL CHECK (char_length(trim(task)) >= 1),
    due_date DATE NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    trade TEXT NOT NULL DEFAULT 'other' CHECK (trade IN ('electrical', 'plumbing', 'appliance', 'other')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reminders_owner_id ON public.reminders(owner_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON public.reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(is_completed);

DROP TRIGGER IF EXISTS set_reminders_updated_at ON public.reminders;
CREATE TRIGGER set_reminders_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own reminders" ON public.reminders;
CREATE POLICY "Users can read own reminders"
ON public.reminders FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own reminders" ON public.reminders;
CREATE POLICY "Users can insert own reminders"
ON public.reminders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own reminders" ON public.reminders;
CREATE POLICY "Users can update own reminders"
ON public.reminders FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own reminders" ON public.reminders;
CREATE POLICY "Users can delete own reminders"
ON public.reminders FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- ==============================================================================
-- 7. AUDIT EVENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_owner_id ON public.audit_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_events(created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own audit events" ON public.audit_events;
CREATE POLICY "Users can read own audit events"
ON public.audit_events FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own audit events" ON public.audit_events;
CREATE POLICY "Users can insert own audit events"
ON public.audit_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);
